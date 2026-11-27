// Renderização local isolada. Não acessa Supabase nem sessões reais. Não é teste físico.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'vite';
const output=resolve(process.env.QA_OUTPUT ?? '../../outputs/admin-finance-pr99');
const temporary=await mkdtemp(join(tmpdir(),'pereirao-admin-qa-'));
const entry=resolve('src/test/__admin_local_qa.tsx');
const html=resolve('__admin_local_qa.html');
let server,chrome,ws;
const pending=new Map();let sequence=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;const timeout=setTimeout(()=>{pending.delete(id);reject(new Error(method+' timed out'));},15000);pending.set(id,{resolve:v=>{clearTimeout(timeout);resolve(v);},reject:e=>{clearTimeout(timeout);reject(e);}});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
try{
 await mkdir(output,{recursive:true});
 await writeFile(entry,`import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import{App}from'../app/App';import{createWorkFixtures}from'./workFixtures';import{adminFixture}from'./adminFixtures';import{FinanceSources}from'../admin/FinanceArea';import'../styles/main.scss';
const work=createWorkFixtures(),admin=adminFixture();
const policy={status:async()=>({monthlyCents:1990,initialFree:true,newContractsEnabled:false,contractingReady:false,revision:0,checkoutEnabled:false,enforcementEnabled:false,automaticConversion:false,subscriptions:0,productionBindings:0,pendingPayments:0,sandboxContracts:0,productionReconciledPayments:0,integration:{credentialsConfigured:false,webhookEnabled:false,validated:false}}),set:async()=>{throw Error('LOCAL_READ_ONLY')}};
const oneoff={call:async(body)=>{if(body.action!=='status')throw Error('LOCAL_READ_ONLY');return{data:{environment:'production',enabledUntil:null,items:[],maxTotalCents:3980,maxPerMethod:1,sandboxReady:false,eventsPending:0,eventsIgnored:0,lastEventReceivedAt:null},writeEnabled:false}}};
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={[new URLSearchParams(location.search).get('route')||'/admin']}><FinanceSources.Provider value={{policy,oneoff}}><div style={{fontSize:12,textAlign:'center',padding:5,background:'#fff3d7',color:'#624508'}}>Demonstração local · dados sintéticos · nenhuma operação financeira</div><App authGateway={work.gateway} professionalRepository={work.professional} workRepository={work.work} adminRepository={admin.repo}/></FinanceSources.Provider></MemoryRouter>);`);
 server=await createServer({define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""'},server:{host:'127.0.0.1',port:5198,strictPort:true}});
 await writeFile(html,'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/test/__admin_local_qa.tsx"></script></body></html>');
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
 const routes=[['overview','/admin'],['finance','/admin?sec=finance'],['subscriptions','/admin?sec=finance&tab=subscriptions'],['payments','/admin?sec=finance&tab=payments'],['oneoff','/admin?sec=finance&tab=tests'],['settings','/admin?sec=finance&tab=settings']];
 for(const width of [320,375,393,430,768,1024,1440]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:852,deviceScaleFactor:1,mobile:width<768});
  for(const [name,route] of routes){
   await call('Page.navigate',{url:'http://127.0.0.1:5198/__admin_local_qa.html?route='+encodeURIComponent(route)});
   let ready=false;for(let n=0;n<100;n++){try{ready=await evaluate("!!document.querySelector('.admin-section-heading') && ![...document.querySelectorAll('[role=status]')].some(e=>/Carregando|Consultando/.test(e.textContent))");}catch{}if(ready)break;await sleep(100);}assert.ok(ready,name+' ready');await sleep(150);
   const state=await evaluate(`(()=>{const header=document.querySelector('.admin-header');return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,brand:!!header.querySelector('img'),section:document.querySelector('.admin-section-heading').textContent,tableOverflow:[...document.querySelectorAll('.admin-table-scroll')].every(e=>e.getBoundingClientRect().right<=innerWidth+1)};})()`);
   assert.ok(state.scrollWidth<=width,name+' page overflow '+width+' '+state.scrollWidth);assert.ok(state.tableOverflow,name+' table escaped');assert.ok(state.brand);results.push({name,...state});
   if([393,1440].includes(width)){const metrics=await call('Page.getLayoutMetrics');const png=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:metrics.cssContentSize.height,scale:1}});await writeFile(join(output,`${name}-${width}.png`),Buffer.from(png.data,'base64'));}
   if(name==='overview'&&width===320){await evaluate("document.querySelector('.admin-menu-toggle').click()");assert.equal(await evaluate("document.querySelector('.admin-menu-toggle').getAttribute('aria-expanded')"),'true');await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await evaluate("document.querySelector('.admin-menu-toggle').focus()");await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});assert.equal(await evaluate("document.querySelector('.admin-menu-toggle').getAttribute('aria-expanded')"),'false');}
  }
 }
 assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(blocked.length,0,JSON.stringify(blocked));await writeFile(join(output,'layout.json'),JSON.stringify({type:'Local Chromium emulation; synthetic read-only sources; not physical devices or financial homologation',results,errors,blocked},null,2));console.log(JSON.stringify({screens:routes.length,widths:[320,375,393,430,768,1024,1440],output,errors,blocked}));
}finally{ws?.close();if(chrome&&chrome.exitCode===null){const exited=new Promise(r=>chrome.once('exit',r));chrome.kill();await Promise.race([exited,sleep(3000)]);}await server?.close();await rm(entry,{force:true});await rm(html,{force:true});await rm(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
