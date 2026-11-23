// Headless desktop/mobile viewport QA on synthetic local repositories. No remote requests allowed.
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE ?? 'puppeteer-core');
const output = resolve(process.env.QA_OUTPUT ?? 'work/profile-editor-qa');
await mkdir(output, { recursive: true });
const server = await createServer({ root: resolve('scripts/fixtures/profile-editor'), configFile: resolve('vite.config.ts'), define: { 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '""' }, publicDir: resolve('public'), server: { host: '127.0.0.1', port: 5199, strictPort: true, fs: { allow: [resolve('.')] } } });
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
      if (section === 'Prévia' && [393,1280].includes(width)) await (await page.$('.profile-preview')).screenshot({ path: resolve(output, `profile-view-${width}.png`) });
      if ([320,393,768,1280].includes(width)) await page.screenshot({ path: resolve(output, `${width}-${section}.png`), fullPage: true });
    }
  }
  await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:5199' + path);
  await page.waitForSelector('#edit-business-bio');
  const click = async text => {
    await page.evaluate(text => { const node = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === text && e.getClientRects().length); if (!node) throw new Error('Button not found: ' + text); node.click(); }, text);
  };
  const fill = async (selector, value) => { await page.click(selector); await page.$eval(selector, element => element.select()); await page.type(selector, value); };
  const shot = async name => page.screenshot({ path: resolve(output, name + '.png'), fullPage: true });
  const counter = async name => page.$eval(`[data-demo-counter="${name}"]`, e => e.textContent);
  await fill('#edit-business-bio', 'Bio sintética ainda não salva');
  await shot('percurso-1-perfil');
  await tab('Atendimento'); await fill('#edit-instagram', 'demonstracao_revisada');
  await shot('percurso-2-atendimento');
  await tab('Conteúdo'); await page.waitForSelector('.service-list');
  await click('Adicionar serviço'); await page.waitForSelector('dialog[open]');
  assert.equal(await page.$('form form'), null);
  await fill('#service-name', 'Serviço técnico sintético');
  await page.select('#service-category', 'eletrica');
  await click('Salvar serviço'); await page.waitForFunction(() => document.body.innerText.includes('Serviço técnico sintético') && !document.querySelector('dialog[open]'));
  await tab('Fotos de trabalhos'); await page.waitForSelector('.portfolio-grid');
  const before = await page.$$eval('.portfolio-grid > li', nodes => nodes.length);
  await click('Adicionar foto de trabalho'); await page.waitForSelector('#portfolio-file');
  assert.equal(await page.$('form form'), null);
  await (await page.$('#portfolio-file')).uploadFile(resolve('scripts/fixtures/profile-editor/synthetic-photo.png'));
  await page.waitForSelector('img[alt="Prévia da fotografia selecionada"]');
  await shot('percurso-3-foto-antes-de-cancelar');
  assert.match(await counter('uploads de trabalhos'), /: 0/);
  await click('Cancelar');
  assert.equal(await page.$('dialog[open]'), null);
  assert.equal(await page.$$eval('.portfolio-grid > li', nodes => nodes.length), before);
  assert.match(await counter('uploads de trabalhos'), /: 0/);
  await shot('percurso-3-foto-cancelada');
  await tab('Publicações'); await page.waitForFunction(() => document.body.innerText.includes('Nova publicação'));
  await click('Nova publicação'); await page.waitForSelector('#post-title');
  assert.equal(await page.$('form form'), null);
  await fill('#post-title', 'Trabalho sintético em rascunho');
  await fill('#post-description', 'Descrição sintética para revisão da central, sem publicação.');
  await page.waitForSelector('dialog input[type="checkbox"]');
  await page.click('dialog input[type="checkbox"]');
  await click('Salvar rascunho'); await page.waitForFunction(() => document.body.innerText.includes('Trabalho sintético em rascunho') && !document.querySelector('dialog[open]'));
  assert.match(await counter('publicações'), /: 1/);
  await shot('percurso-3-publicacao-em-memoria');
  await tab('Prévia'); await page.waitForSelector('.social-preview-header');
  assert.equal(await page.$$eval('.social-profile-bio', nodes => nodes.some(e => e.textContent.includes('Bio sintética ainda não salva'))), false);
  await shot('percurso-4-previa-salva');
  await tab('Perfil');
  assert.equal(await page.$eval('#edit-business-bio', e => e.value), 'Bio sintética ainda não salva');
  assert.match(await counter('perfil'), /: 0/);
  const [chooser] = await Promise.all([page.waitForFileChooser(), page.click('button[aria-label="Alterar foto principal"]')]);
  await chooser.accept([resolve('scripts/fixtures/profile-editor/synthetic-photo.png')]);
  await page.waitForSelector('img[alt="Prévia da nova foto principal"]');
  await shot('retrato-separado-antes-de-cancelar'); await click('Cancelar');
  assert.match(await counter('uploads de retrato'), /: 0/);
  await writeFile(resolve(output, 'percurso.json'), JSON.stringify({ environment: 'Chrome headless local, synthetic memory repositories', steps: ['Perfil: edição não salva', 'Atendimento: edição preservada', 'Conteúdo: criar serviço em memória', 'Conteúdo: selecionar foto, prévia e cancelar sem upload', 'Conteúdo: salvar publicação draft em memória', 'Prévia: somente dados gravados', 'Perfil: texto preservado e retrato separado cancelado'], fileUploads: 0, externalRequests: blocked, nestedForms: 0, route: await page.$eval('[data-demo-route]', e => e.textContent) }, null, 2));
  assert.deepEqual(errors, []);
  assert.deepEqual(blocked, []);
  await writeFile(resolve(output, 'layout.json'), JSON.stringify({ environment: 'Headless Chrome, emulated viewports; synthetic data, no physical device and no remote Storage', results, errors, blocked }, null, 2));
  console.log(JSON.stringify({ layouts: results.length, errors, blocked, output }));
} finally { await browser?.close(); await server.close(); }
