// Renderização local isolada. Não acessa Supabase nem sessões reais. Não é teste físico.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'vite';
const output=resolve(process.env.QA_OUTPUT ?? '../outputs/business-presence');
const temporary=await mkdtemp(join(tmpdir(),'pereirao-presence-qa-'));
const entry=resolve('src/test/__presence_local_qa.tsx');
const html=resolve('__presence_local_qa.html');
let server,chrome,ws;
const pending=new Map();let sequence=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;const timeout=setTimeout(()=>{pending.delete(id);reject(new Error(method+' timed out'));},15000);pending.set(id,{resolve:v=>{clearTimeout(timeout);resolve(v);},reject:e=>{clearTimeout(timeout);reject(e);}});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
try{
 await mkdir(output,{recursive:true});
 await writeFile(entry,`import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import{App}from'../app/App';import{createWorkFixtures,fixtureImage}from'./workFixtures';import{marketplaceFixture,publicProviderFixture}from'./marketplaceFixtures';import{PresenceProvider}from'../businessPresence/PresenceProvider';import{emptyLocation,CONSENT}from'../businessPresence/model';import type {Presence,PresenceRepository}from'../businessPresence/model';import'../styles/main.scss';const q=new URLSearchParams(location.search),f=createWorkFixtures(true),company=q.get('solo')!=='1';const original=f.professional.getEditable;f.professional.getEditable=async(id)=>{const r=await original(id);return{...r,input:{...r.input,type:company?'empresa':'autonomo'},business:{...r.business,type:company?'empresa':'autonomo'}};};let data:Presence={location:{...emptyLocation,mode:'both',street:'Rua de demonstração local',number:'100',postal_code:'79980000',neighborhood:'Centro',city_id:'mundo-novo-ms',city:'Mundo Novo',state:'MS',public_address:true,version:1},members:Array.from({length:Number(q.get('count')??3)},(_,i)=>({id:String(i),name:i===0?'Integrante com nome longo de demonstração local':'Integrante local '+(i+1),profession:'Atendimento e especialidade declarada',specialties:['Corte','Atendimento personalizado'],whatsapp:'',bio:'Dados sintéticos locais para conferir a composição. Nenhuma pessoa real cadastrada.',position:i,active:true,photo_path:i===0?'fixture':null,version:1,consent_version:CONSENT}))};const presence:PresenceRepository={read:async()=>structuredClone(data),command:async(_id,command,payload)=>{if(command==='save')data.members.push({...payload,version:1} as Presence['members'][number]);return structuredClone(data);},upload:async()=>{},image:async()=>fixtureImage};const marketplace=marketplaceFixture();marketplace.getProvider=async()=>({...publicProviderFixture,type:company?'empresa':'autonomo'});createRoot(document.getElementById('root')!).render(<PresenceProvider value={presence}><MemoryRouter initialEntries={[q.get('route')||'/conta/profissional/00000000-0000-4000-8000-000000000001/equipe-localizacao']}><p style={{fontSize:12,textAlign:'center'}}>DEMONSTRAÇÃO LOCAL — dados sintéticos; sem Supabase</p><App authGateway={f.gateway} professionalRepository={f.professional} workRepository={f.work} marketplaceRepository={marketplace}/></MemoryRouter></PresenceProvider>);`);
 server=await createServer({define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""'},server:{host:'127.0.0.1',port:5198,strictPort:true}});
 await writeFile(html,'<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/test/__presence_local_qa.tsx"></script></body></html>');
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
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});

 const results=[];
 const open=async(query)=>{await call('Page.navigate',{url:'http://127.0.0.1:5198/__presence_local_qa.html?'+query});for(let n=0;n<100;n++){if(await evaluate("!!document.querySelector('.presence-editor fieldset,.social-profile-header')"))return;await sleep(100);}throw new Error('UI did not load');};
 const capture=async(name,width)=>{if(name.startsWith('member-form')){const png=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,name+'.png'),Buffer.from(png.data,'base64'));return;}const metrics=await call('Page.getLayoutMetrics');const png=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.min(metrics.cssContentSize.height,6000),scale:1}});await writeFile(join(output,name+'.png'),Buffer.from(png.data,'base64'));};
 for(const width of [320,360,375,390,393,430,768,1024,1280,1440]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:852,deviceScaleFactor:1,mobile:width<768});
  for(const count of [0,1,3,10]){
   await open('count='+count);await sleep(100);
   const state=await evaluate("({scrollWidth:document.documentElement.scrollWidth,cards:document.querySelectorAll('.team-grid>li').length,cuts:[...document.querySelectorAll('.team-grid>li,.presence-editor input:not(.visually-hidden),.presence-editor select')].filter(e=>{const r=e.getBoundingClientRect();return r.width&& (r.left<0||r.right>innerWidth+1)}).length})");
   assert.ok(state.scrollWidth<=width,'overflow '+width);assert.equal(state.cards,count);assert.equal(state.cuts,0);results.push({width,count,...state});
   if([393,1440].includes(width)&&[0,3,10].includes(count))await capture('editor-'+count+'-'+width,width);
  }
  await open('count=3');await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Adicionar integrante').click()");await sleep(100);
  assert.ok(await evaluate("(()=>{const r=document.querySelector('dialog').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;})()"),'modal within viewport');
  if([393,1440].includes(width))await capture('member-form-'+width,width);
  await open('route='+encodeURIComponent('/prestadores/prestador-simulado')+'&count=3');
  await evaluate("[...document.querySelectorAll('[role=tab]')].find(b=>b.textContent==='Sobre').click()");await sleep(150);
  assert.equal(await evaluate("document.querySelectorAll('.team-grid>li').length"),3);assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"));
  if([393,1440].includes(width))await capture('public-profile-'+width,width);
 }
 // Short viewport approximates available space, not a real iPhone keyboard.
 await call('Emulation.setDeviceMetricsOverride',{width:393,height:360,deviceScaleFactor:1,mobile:true});await open('count=1');await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Adicionar integrante').click()");await sleep(150);
 assert.ok(await evaluate("(()=>{const d=document.querySelector('dialog'),r=d.getBoundingClientRect();d.querySelector('.work-modal__body').scrollTop=9999;return r.top>=0&&r.bottom<=innerHeight+1;})()"),'short viewport modal bounded');await capture('member-form-short-393',393);
 assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(blocked.length,0,JSON.stringify(blocked));await writeFile(join(output,'layout.json'),JSON.stringify({type:'Chromium local emulation; no physical devices, sessions or remote data',results,errors,blocked},null,2));console.log(JSON.stringify({output,widths:[...new Set(results.map(r=>r.width))],cases:results.length,errors,blocked}));
}finally{ws?.close();if(chrome&&chrome.exitCode===null){const exited=new Promise(r=>chrome.once('exit',r));chrome.kill();await Promise.race([exited,sleep(3000)]);}await server?.close();await rm(entry,{force:true});await rm(html,{force:true});await rm(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
