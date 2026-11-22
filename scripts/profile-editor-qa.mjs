// Headless desktop/mobile viewport QA on synthetic local repositories. No remote requests allowed.
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE ?? 'puppeteer-core');
const output = resolve(process.env.QA_OUTPUT ?? 'work/profile-editor-qa');
await mkdir(output, { recursive: true });
const server = await createServer({ root: resolve('scripts/fixtures/profile-editor'), configFile: resolve('vite.config.ts'), publicDir: resolve('public'), server: { host: '127.0.0.1', port: 5199, strictPort: true, fs: { allow: [resolve('.')] } } });
await server.listen();
let browser;
const results = [], blocked = [], errors = [];
try {
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (['data:', 'blob:'].includes(url.protocol) || url.origin === 'http://127.0.0.1:5199') request.continue();
    else { blocked.push(url.origin); request.abort(); }
  });
  page.on('pageerror', error => errors.push(error.message));
  const path = '/conta/profissional/00000000-0000-4000-8000-000000000001/editar';
  const tab = async text => {
    await page.evaluate(text => [...document.querySelectorAll('[role="tab"]')].find(node => node.textContent === text).click(), text);
    await new Promise(resolve => setTimeout(resolve, 100));
  };
  for (const width of [320, 375, 390, 393, 430, 768, 1024, 1280, 1440]) {
    await page.setViewport({ width, height: width === 393 ? 852 : 900, deviceScaleFactor: 1 });
    await page.goto('http://127.0.0.1:5199' + path);
    await page.waitForSelector('#edit-business-bio');
    for (const section of ['Perfil', 'Atendimento', 'Conteúdo', 'Prévia']) {
      await tab(section);
      if (section === 'Prévia') await page.waitForSelector('.social-preview-header');
      const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, heading: document.querySelector('h1')?.textContent, avatarRadius: getComputedStyle(document.querySelector('.profile-editor__identity .profile-avatar')).borderRadius, tabs: [...document.querySelectorAll('[role="tablist"]')][0].getBoundingClientRect().width }));
      assert.equal(layout.avatarRadius, '50%');
      assert.ok(layout.scroll <= width, JSON.stringify({ width, section, layout }));
      const clipping = await page.evaluate(() => [...document.querySelectorAll('input:not([type="hidden"]),textarea,select,.profile-editor__actions button')].filter(e => e.getClientRects().length && !e.closest('[hidden]')).filter(e => { const r=e.getBoundingClientRect();return r.left < 0 || r.right > innerWidth + 1; }).map(e => e.id || e.textContent));
      assert.deepEqual(clipping, [], `clipped form controls ${width}/${section}`);
      results.push({ width, height: width === 393 ? 852 : 900, section, ...layout, controlsInsideViewport: true });
      if ([320,393,768,1280].includes(width)) await page.screenshot({ path: resolve(output, `${width}-${section}.png`), fullPage: true });
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(blocked, []);
  await writeFile(resolve(output, 'layout.json'), JSON.stringify({ environment: 'Headless Chrome, emulated viewports; synthetic data, no physical device and no remote Storage', results, errors, blocked }, null, 2));
  console.log(JSON.stringify({ layouts: results.length, errors, blocked, output }));
} finally { await browser?.close(); await server.close(); }
