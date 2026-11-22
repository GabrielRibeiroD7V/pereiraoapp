// Local synthetic navigation only; neither Safari nor a physical Android test.
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE ?? 'puppeteer-core');
const out = resolve(process.env.QA_OUTPUT ?? 'work/profile-hub-qa'); await mkdir(out,{recursive:true});
const server = await createServer({root:resolve('scripts/fixtures/profile-editor'),configFile:resolve('vite.config.ts'),define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""'},publicDir:resolve('public'),server:{host:'127.0.0.1',port:5199,strictPort:true,fs:{allow:[resolve('.')]}}}); await server.listen();
let browser;const paths=[],blocked=[],errors=[],layouts=[];
try{
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const page=await browser.newPage();await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://127.0.0.1:5199'||['data:','blob:'].includes(u.protocol))r.continue();else{blocked.push(u.origin);r.abort();}});page.on('pageerror',e=>errors.push(e.message));
 const click=async(text)=>page.evaluate(text=>{const node=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()===text&&e.getClientRects().length&&!e.closest('[hidden]'));if(!node)throw Error('Missing '+text);node.click();},text);
 const route=async()=>{const path=await page.$eval('[data-demo-route]',e=>e.textContent);paths.push(path);return path;};
 for(const width of [320,375,390,393,430,768,1024,1280,1440]){
  await page.setViewport({width,height:width===393?852:900,deviceScaleFactor:1});await page.goto('http://127.0.0.1:5199/?view=profile');await page.waitForSelector('.social-preview-header');
  const state=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,circle:getComputedStyle(document.querySelector('.profile-avatar')).borderRadius,services:[...document.querySelectorAll('h2')].some(e=>e.textContent==='Serviços e preços'),bio:document.querySelector('.social-profile-bio')?.textContent}));assert.ok(state.scroll<=width);assert.equal(state.circle,'50%');assert.equal(state.services,true);layouts.push(state);
  if([393,1280].includes(width))await page.screenshot({path:resolve(out,`profile-${width}.png`),fullPage:true});
 }
 await page.setViewport({width:393,height:852,deviceScaleFactor:1});await page.goto('http://127.0.0.1:5199/?view=profile');await page.waitForSelector('.social-preview-header');await route();
 await click('Editar perfil');await page.waitForSelector('#edit-business-bio');await route();
 await page.$eval('#edit-business-bio',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.type('#edit-business-bio','Texto cancelado');await click('Cancelar alterações');await page.waitForSelector('.social-preview-header');assert.ok(!(await page.$eval('.social-profile-bio',e=>e.textContent)).includes('Texto cancelado'));await route();
 await click('Editar perfil');await page.waitForSelector('#edit-business-bio');await page.click('#edit-business-bio');await page.$eval('#edit-business-bio',e=>e.select());await page.type('#edit-business-bio','Resumo sintético salvo nesta demonstração.');await click('Salvar alterações');await page.waitForSelector('.social-preview-header');assert.match(await page.$eval('.social-profile-bio',e=>e.textContent),/Resumo sintético salvo/);await route();
 await page.evaluate(()=>document.querySelector('.profile-add').open=true);await click('Adicionar serviço');await page.waitForSelector('#service-name');await route();assert.equal(await page.$('#service-price'),null);await page.type('#service-name','Serviço sintético sob orçamento');await page.select('#service-category','eletrica');await click('Salvar serviço');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));await click('Voltar ao perfil');await page.waitForSelector('.social-preview-header');assert.match(await page.$eval('.public-services',e=>e.textContent),/Serviço sintético sob orçamento/);await route();
 const [chooser]=await Promise.all([page.waitForFileChooser(),page.click('button[aria-label="Alterar foto principal"]')]);await chooser.cancel();assert.equal(await page.$('dialog[open]'),null);assert.match(await page.$eval('[data-demo-counter="uploads de retrato"]',e=>e.textContent),/: 0/);
 await click('Mensagens');await page.waitForFunction(()=>document.querySelector('[data-demo-route]').textContent==='/mensagens');assert.equal(await route(),'/mensagens');await page.click('.main-nav__link[href="/conta"]');await page.waitForSelector('.social-preview-header');
 await click('Ver como cliente');await page.waitForSelector('.social-preview-header');await route();assert.equal(await page.$('button[aria-label="Alterar foto principal"]'),null);await page.screenshot({path:resolve(out,'client-preview-393.png'),fullPage:true});
 assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);await writeFile(resolve(out,'results.json'),JSON.stringify({kind:'Chromium local, synthetic repositories; no real account, no remote storage, no physical devices',paths,layouts,portraitUploads:0,blocked,errors},null,2));console.log(JSON.stringify({layouts:layouts.length,paths,blocked,errors}));
}finally{await browser?.close();await server.close();}
