// Verificação visual local e sintética; sem sessão ou acesso ao Supabase.
import {createServer} from 'vite';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE??'puppeteer-core');
const out=resolve(process.env.QA_OUTPUT??'work/post-experience-qa');await mkdir(out,{recursive:true});
const server=await createServer({root:resolve('scripts/fixtures/profile-editor'),configFile:resolve('vite.config.ts'),define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""'},publicDir:resolve('public'),server:{host:'127.0.0.1',port:5199,strictPort:true,fs:{allow:[resolve('.')]}}});await server.listen();
let browser;const rows=[],errors=[],blocked=[];
try{
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const page=await browser.newPage();
 await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin==='http://127.0.0.1:5199'||['data:','blob:'].includes(u.protocol))r.continue();else{blocked.push(u.origin);r.abort();}});page.on('pageerror',e=>errors.push(e.message));
 const click=async(selector)=>page.$eval(selector,el=>el.click());
 for(const width of [320,375,390,393,430,768,1280,1440]){
  await page.setViewport({width,height:width===393?852:900,deviceScaleFactor:1});await page.goto('http://127.0.0.1:5199/?view=profile&posts=demo');await page.waitForSelector('.profile-post-tile img');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow profile '+width);
  if([393,1280].includes(width))await page.screenshot({path:resolve(out,`capas-${width}.jpg`),type:'jpeg',quality:80,fullPage:true});
  await click('.profile-post-tile');await page.waitForSelector('dialog[open] .post-content');
  const layout=await page.$eval('dialog[open]',d=>{const r=d.getBoundingClientRect(),b=d.querySelector('.work-modal__body');return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,bodyOverflow:b.scrollWidth>b.clientWidth+1,figures:d.querySelectorAll('figure').length,columns:getComputedStyle(d.querySelector('.post-content')).gridTemplateColumns};});
  assert.ok(layout.left>=0&&layout.right<=width&&layout.top>=0&&layout.bottom<=(width===393?852:900));assert.equal(layout.bodyOverflow,false);assert.equal(layout.figures,2);assert.ok(layout.right-layout.left<=610,'post width is bounded');rows.push({width,...layout});
  await click('dialog[open] [aria-label="Próxima foto"]');assert.match(await page.$eval('dialog[open] .photo-carousel__controls',e=>e.textContent),/2 \/ 2/);
  await page.waitForFunction(()=>{const t=document.querySelector('dialog[open] .photo-carousel__track');return Math.abs(t.scrollLeft-t.clientWidth)<2;});
  if([393,1280].includes(width))await page.screenshot({path:resolve(out,`post-${width}.jpg`),type:'jpeg',quality:85,fullPage:true});
  await click('dialog[open] .post-management summary');const menu=await page.$eval('dialog[open] .post-management nav',e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right};});assert.ok(menu.left>=0&&menu.right<=width);if([393,1280].includes(width))await page.screenshot({path:resolve(out,`menu-${width}.jpg`),type:'jpeg',quality:80,fullPage:true});
  await click('dialog[open] [aria-label="Fechar"]');await page.evaluate(()=>[...document.querySelectorAll('[role=tab]')].find(e=>e.textContent==='Meu feed').click());await page.waitForSelector('.private-post-feed .post-content');
  if([393,1280].includes(width))await page.screenshot({path:resolve(out,`feed-${width}.jpg`),type:'jpeg',quality:80,fullPage:true});
  await click('.private-post-feed .post-management summary');
  await page.evaluate(()=>[...document.querySelectorAll('.private-post-feed button')].find(e=>e.textContent==='Editar publicação').click());await page.waitForSelector('#post-description');
  await page.setViewport({width,height:360,deviceScaleFactor:1});await page.focus('#post-description');await page.waitForFunction(()=>document.querySelector('dialog[open]')?.dataset.shortViewport==='true');
  const keyboard=await page.$eval('dialog[open]',d=>{const r=d.getBoundingClientRect();return{top:r.top,bottom:r.bottom,short:d.dataset.shortViewport,close:!!d.querySelector('[aria-label="Fechar"]')};});assert.ok(keyboard.top>=0&&keyboard.bottom<=360,JSON.stringify({width,keyboard}));assert.equal(keyboard.short,'true');
  // Reduzir a viewport simula espaço do teclado; não reproduz o teclado ou barras reais do Safari.
  if(width===393)await page.screenshot({path:resolve(out,'teclado-simulado-393.jpg'),type:'jpeg',quality:80,fullPage:true});
  await page.evaluate(()=>[...document.querySelectorAll('dialog[open] button')].find(e=>e.textContent==='Cancelar').click());
  const writes=await page.$eval('[data-demo-counter="publicações"]',e=>e.textContent);assert.match(writes,/publicações: 0/);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);await writeFile(resolve(out,'results.json'),JSON.stringify({mode:'Chromium local; dados sintéticos; nenhum teste físico',rows,errors,blocked},null,2));console.log(JSON.stringify({widths:rows.map(r=>r.width),errors,blocked,cancelledWithoutWrites:true}));
}finally{await browser?.close();await server.close();}
