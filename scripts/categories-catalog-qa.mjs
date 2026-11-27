// Renderização local isolada. Não acessa Supabase nem sessões reais. Não é teste físico.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'vite';
const output=resolve(process.env.QA_OUTPUT ?? '../outputs/categories-16');
const temporary=await mkdtemp(join(tmpdir(),'pereirao-categories-qa-'));
const entry=resolve('src/test/__categories_local_qa.tsx');
const html=resolve('__categories_local_qa.html');
let server,chrome,ws;
const pending=new Map();let sequence=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;const timeout=setTimeout(()=>{pending.delete(id);reject(new Error(method+' timed out'));},15000);pending.set(id,{resolve:v=>{clearTimeout(timeout);resolve(v);},reject:e=>{clearTimeout(timeout);reject(e);}});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
try{
 await mkdir(output,{recursive:true});
 await writeFile(entry,`import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import{App}from'../app/App';import{marketplaceFixture}from'./marketplaceFixtures';import{categoryCatalog16}from'./categoryCatalog';import{createWorkFixtures}from'./workFixtures';import{emptyRegistration}from'../professional/validation';import'../styles/main.scss';const f=createWorkFixtures();f.professional.getCatalog=async()=>({categories:categoryCatalog16,cities:[{id:'mundo-novo-ms',name:'Mundo Novo',state_code:'MS'}]});const original=f.professional.getEditable;f.professional.getEditable=async(id)=>{const row=await original(id);return {...row,input:{...emptyRegistration,name:row.business.name,categoryId:'climatizacao',cityId:'mundo-novo-ms'}};};const repo=marketplaceFixture();repo.getCategories=async()=>categoryCatalog16;repo.search=async(_,page)=>({items:[],page,hasNext:false});createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={[new URLSearchParams(location.search).get('route')||'/']}><div style={{fontSize:12,textAlign:'center'}}>Catálogo sintético local — sem dados de produção</div><App authGateway={f.gateway} professionalRepository={f.professional} workRepository={f.work} marketplaceRepository={repo}/></MemoryRouter>);`);
 server=await createServer({define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""'},server:{host:'127.0.0.1',port:5198,strictPort:true}});
 await writeFile(html,'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/test/__categories_local_qa.tsx"></script></body></html>');
 await server.listen();
 chrome=spawn(process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${temporary}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','about:blank'],{stdio:'ignore'});
 let port;
 for(let n=0;n<100;n++){try{port=(await readFile(join(temporary,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(100);}}
 assert.ok(port,'Chrome headless unavailable');
 const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 const blocked=[],errors=[];
 ws.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const p=pending.get(data.id);if(p){pending.delete(data.id);data.error?p.reject(new Error(JSON.stringify(data.error))):p.resolve(data.result);}return;}if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.text);if(data.method==='Fetch.requestPaused'){const{requestId,request}=data.params;const allowed=new URL(request.url).origin==='http://127.0.0.1:5198';if(!allowed)blocked.push(new URL(request.url).origin);void call(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId}:{requestId,errorReason:'BlockedByClient'}).catch(error=>{if(!error.message.includes('Invalid InterceptionId'))errors.push(error.message);});}});
 await call('Runtime.enable');await call('Page.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 const results=[];
 for(const width of [320,375,390,393,430,768,1024,1280,1440]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:852,deviceScaleFactor:1,mobile:width<768});
  await call('Page.navigate',{url:'http://127.0.0.1:5198/__categories_local_qa.html'});
  let ready=false;for(let i=0;i<100;i++){try{ready=await evaluate("document.querySelectorAll('.all-categories a').length===16");}catch{}if(ready)break;await sleep(100);}assert.ok(ready,'16 local categories loaded');
  if(width===393){const png=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'home-393.png'),Buffer.from(png.data,'base64'));}
  await evaluate("document.querySelector('.all-categories summary').focus();");await call('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await call('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});assert.ok(await evaluate("document.querySelector('.all-categories').open"),'summary opens with keyboard');
  const state=await evaluate(`(()=>{const brand=document.querySelector('.app-header .brand').getBoundingClientRect();return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,centerError:Math.abs(brand.left+brand.width/2-innerWidth/2),popular:document.querySelectorAll('.category-grid .category-tile').length,links:[...document.querySelectorAll('.all-categories a')].map(el=>{const r=el.getBoundingClientRect();return{name:el.textContent,width:r.width,height:r.height,left:r.left,right:r.right}}),tabs:document.querySelectorAll('.main-nav__link').length,focused:document.activeElement.tagName};})()`);
  assert.equal(state.width,width);assert.ok(state.scrollWidth<=width,'overflow at '+width);assert.ok(state.centerError<1,'brand center at '+width);assert.equal(state.popular,6);assert.equal(state.tabs,4);assert.equal(state.focused,'SUMMARY');
  for(const link of state.links)assert.ok(link.left>=0&&link.right<=width+1&&link.width>=44&&link.height>=44,JSON.stringify(link));
  results.push(state);
  if([393,1280].includes(width)){const metrics=await call('Page.getLayoutMetrics');const png=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:metrics.cssContentSize.height,scale:1}});await writeFile(join(output,`categories-open-${width}.png`),Buffer.from(png.data,'base64'));}
 }
 const forms=[];
 for(const width of [320,393,1280]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:852,deviceScaleFactor:1,mobile:width<768});
  for(const mode of ['registration','editing']){
   const route=mode==='registration'?'/conta/profissional/cadastro':'/conta/profissional/00000000-0000-4000-8000-000000000001/editar';
   await call('Page.navigate',{url:'http://127.0.0.1:5198/__categories_local_qa.html?route='+encodeURIComponent(route)});
   const condition=mode==='registration'?"!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Continuar'))":"document.querySelectorAll('#edit-category option').length===17";
   let ready=false;for(let n=0;n<100;n++){try{ready=await evaluate(condition);}catch{}if(ready)break;await sleep(100);}assert.ok(ready,mode+' ready');
   if(mode==='registration')await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Continuar')).click()");
   for(let n=0;n<50;n++){if(await evaluate(mode==='registration'?"document.querySelectorAll('.category-picker input[type=radio]').length===16":"document.querySelectorAll('#edit-category option').length===17"))break;await sleep(100);}
   const state=await evaluate(`(()=>{const labels=[...document.querySelectorAll('.category-picker__grid label,.specialty-picker__options label')];return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,labels:labels.map(l=>{const r=l.getBoundingClientRect();return{left:r.left,right:r.right,text:l.textContent}})};})()`);
   assert.ok(state.scrollWidth<=width,mode+' overflow '+width);for(const label of state.labels)assert.ok(label.left>=0&&label.right<=width+1,JSON.stringify(label));forms.push({mode,...state});
   if(width===393||width===1280){const metrics=await call('Page.getLayoutMetrics');const png=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:metrics.cssContentSize.height,scale:1}});await writeFile(join(output,`${mode}-${width}.png`),Buffer.from(png.data,'base64'));}
  }
 }
 assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(blocked.length,0,JSON.stringify(blocked));await writeFile(join(output,'layout.json'),JSON.stringify({type:'local Chromium emulation; synthetic catalog; no Supabase; no physical devices',results,forms,errors,blocked},null,2));console.log(JSON.stringify({widths:results.map(r=>r.width),output,errors,blocked}));
}finally{ws?.close();if(chrome&&chrome.exitCode===null){const exited=new Promise(r=>chrome.once('exit',r));chrome.kill();await Promise.race([exited,sleep(3000)]);}await server?.close();await rm(entry,{force:true});await rm(html,{force:true});await rm(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
