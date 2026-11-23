// Inspeção local em Chromium: emulação, nunca ensaio físico ou aceitação remota.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE??'puppeteer-core');
const out=resolve(process.env.QA_OUTPUT??'work/admin-review-qa');await mkdir(out,{recursive:true});
const server=await createServer({configFile:false,root:resolve('scripts/fixtures/admin-review'),plugins:[react()],define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""'},server:{host:'127.0.0.1',port:5197,strictPort:true}});await server.listen();
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const results=[];const errors=[];
try{const page=await browser.newPage();await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());u.origin==='http://127.0.0.1:5197'||['data:','blob:'].includes(u.protocol)?r.continue():r.abort();});page.on('pageerror',e=>errors.push(e.message));
for(const width of [320,393,768,1280])for(const scenario of ['empty','multiple','long','unavailable']){
 await page.setViewport({width,height:width===393?852:900,deviceScaleFactor:1});await page.goto(`http://127.0.0.1:5197/?case=${scenario}`);await page.waitForSelector('.admin-table button');await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Analisar perfil')).click());await page.waitForSelector('.admin-review-classification');
 const state=await page.evaluate(()=>{const c=document.querySelector('.admin-review-classification'),d=c.closest('dialog'),box=d.getBoundingClientRect();return{viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,dialogWidth:d.clientWidth,dialogScroll:d.scrollWidth,left:box.left,right:box.right,columns:getComputedStyle(c.querySelector('dl')).gridTemplateColumns,labels:[...c.querySelectorAll('dt')].map(x=>x.textContent),text:c.textContent};});
 assert.ok(state.pageWidth<=width&&state.dialogScroll<=state.dialogWidth+1&&state.left>=0&&state.right<=width+1,JSON.stringify(state));assert.equal(state.labels.length,4);results.push({scenario,...state});
 if([393,1280].includes(width))await page.screenshot({path:resolve(out,`${scenario}-${width}.png`),fullPage:true});
}assert.deepEqual(errors,[]);await writeFile(resolve(out,'results.json'),JSON.stringify({environment:'Chromium local; repositórios sintéticos; sem acesso remoto ou dispositivos físicos',results,errors},null,2));console.log('16 combinações de largura/caso aprovadas; sem overflow ou erros JS.');}finally{await browser.close();await server.close();}
