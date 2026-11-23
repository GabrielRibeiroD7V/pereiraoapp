// Local viewport review, never a physical iPhone/Android or production acceptance.
// Reuses an installed puppeteer-core via PUPPETEER_MODULE; no dependency install.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE ?? 'puppeteer-core');
const output = resolve(process.env.QA_OUTPUT ?? 'work/categories-qa');
await mkdir(output, { recursive: true });
const server = await createServer({ configFile: resolve('vite.config.ts'), define: {
  'import.meta.env.VITE_SUPABASE_URL': '""',
  'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '""',
}, server: { host: '127.0.0.1', port: 5198, strictPort: true } });
await server.listen();
let browser;
const results = [], blocked = [], errors = [];
try {
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:5198' || ['data:', 'blob:'].includes(url.protocol)) request.continue();
    else { blocked.push(url.origin); request.abort(); }
  });
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [320, 375, 390, 393, 430, 768, 1024, 1280, 1440]) {
    await page.setViewport({ width, height: width === 393 ? 852 : 900, deviceScaleFactor: 1 });
    await page.goto('http://127.0.0.1:5198/');
    await page.waitForSelector('.category-tile--limpeza');
    const state = await page.evaluate(() => {
      const brand = document.querySelector('.app-header .brand').getBoundingClientRect();
      const cards = [...document.querySelectorAll('.category-tile')].map(card => {
        const rect = card.getBoundingClientRect(), style = getComputedStyle(card);
        const label = card.lastElementChild.getBoundingClientRect();
        return { name: card.textContent, href: card.getAttribute('href'), width: rect.width, height: rect.height,
          background: style.backgroundColor, textColor: style.color,
          left: rect.left, right: rect.right, top: rect.top,
          titleClipped: label.left < rect.left || label.right > rect.right };
      });
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        brandCenterError: Math.abs(brand.left + brand.width / 2 - innerWidth / 2),
        mainTabs: [...document.querySelectorAll('.main-nav__link')].map(el => el.textContent), cards };
    });
    assert.equal(state.cards.length, 6);
    assert.equal(state.mainTabs.length, 3);
    assert.ok(state.scrollWidth <= width, `overflow: ${width}`);
    assert.ok(state.brandCenterError < 1, `brand center: ${width}`);
    for (const card of state.cards) {
      assert.ok(card.width >= 44 && card.height >= 44 && card.left >= 0 && card.right <= width + 1 && !card.titleClipped, JSON.stringify(card));
      assert.match(card.href, /^\/buscar\?categoria=[a-z]+$/);
    }
    assert.equal(new Set(state.cards.map(card => card.top)).size, width < 768 ? 2 : 1);
    results.push(state);
    if ([393,1280].includes(width)) {
      await page.screenshot({ path: resolve(output, `home-${width}.png`), fullPage: true });
      await (await page.$('.category-grid')).screenshot({ path: resolve(output, `categories-${width}.png`) });
    }
  }
  assert.deepEqual(blocked, [], 'remote requests must not be attempted');
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'layout.json'), JSON.stringify({ environment: 'Chromium headless local; viewport emulation, no physical devices, no remote API', results, blocked, errors }, null, 2));
  console.log(`9 viewports approved; local screenshots in ${output}`);
} finally { await browser?.close(); await server.close(); }
