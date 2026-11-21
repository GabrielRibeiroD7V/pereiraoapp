// Ensaio local: motor real do PWA, interface técnica, nenhum Auth/API/banco remoto.
import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,useLocation} from 'react-router-dom';
import {PwaController} from '../../../src/pwa/controller';
import {PwaProvider,PwaGate,InstallInvitation} from '../../../src/pwa/PwaProvider';
import {Brand} from '../../../src/components/Brand';
import {MainNavigation} from '../../../src/components/MainNavigation';
import '../../../src/styles/main.scss';
import {CitySelect} from '../../../src/locations/CitySelect';
import {ServiceAreaPicker} from '../../../src/locations/ServiceAreaPicker';
import {regionalCityFixture} from '../../../src/test/regionalCities';
declare const __QA_LABEL__: string;
const mode=new URLSearchParams(location.search).get('device');
const device=mode==='ios'||mode==='ios-chrome'?{
  userAgent:mode==='ios'?'iPhone Safari':'iPhone CriOS',platform:'iPhone',maxTouchPoints:5,onLine:true,serviceWorker:navigator.serviceWorker,
}:navigator;
const controller=new PwaController(window,device as Navigator,true);controller.start();
function Qa(){
 const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot),path=useLocation();
 const [message,setMessage]=useState('Nenhuma operação remota.');
 const [history,setHistory]=useState('Histórico: aguardando restauração');
 useEffect(()=>{const show=(event:PageTransitionEvent)=>setHistory(`pageshow.persisted = ${event.persisted}`);window.addEventListener('pageshow',show);return()=>window.removeEventListener('pageshow',show);},[]);
 const [city,setCity]=useState('mundo-novo-ms'), [areas,setAreas]=useState(['guaira-pr','eldorado-ms']);
 useEffect(()=>{void controller.checkForUpdate();},[path.pathname]);
 const simulate=()=>{const event=Object.assign(new Event('beforeinstallprompt',{cancelable:true}),{prompt:async()=>{setMessage('Prompt simulado chamado no toque — não é instalação física.');},userChoice:Promise.resolve({outcome:'accepted',platform:'qa'})});window.dispatchEvent(event);};
 return <><header className="app-header"><div className="app-header__inner"><MainNavigation/><Brand/><div className="location">Mundo Novo, MS</div></div></header><main className="page-container"><p className="field-help">ENSAIO LOCAL · SEM CONEXÃO AO SUPABASE/ASAAS</p><h1>Build de teste {__QA_LABEL__}</h1><p>Motor e componentes reais do PWA. Interface técnica, sem dados operacionais.</p><p>Rota: {path.pathname}</p><p>{history}</p><p><a href="/outra-pagina">Navegação documental de teste</a></p><output id="qa-state" style={{display:"block",overflowWrap:"anywhere",fontSize:12}}>{JSON.stringify({version:state.runningVersion,published:state.publishedVersion,worker:state.worker,waiting:state.updateReady,updating:state.updating,installed:state.installed})}</output><form onSubmit={e=>e.preventDefault()}><label htmlFor="draft">Rascunho local não salvo</label><input className="search-input" id="draft" name="draft" placeholder="Texto descartável de teste"/></form><p><button className="button button--secondary" onClick={async()=>{await fetch('/qa/publish',{method:'POST'});setMessage('Versão B publicada SOMENTE neste servidor local.');}}>Publicar versão B local</button></p><p><button className="button button--secondary" onClick={simulate}>Simular oportunidade Android</button></p><p><button className="button button--secondary" onClick={()=>void controller.checkForUpdate(true)}>Verificar versão agora</button></p><p role="status">{message}</p><h2>Seleção compacta de localidades</h2><CitySelect id="qa-city" label="Cidade" cities={regionalCityFixture} value={city} onChange={setCity}/><ServiceAreaPicker cities={regionalCityFixture} originId={city} selectedIds={areas} onChange={setAreas}/></main><InstallInvitation/></>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><PwaProvider controller={controller}><PwaGate><Qa/></PwaGate></PwaProvider></BrowserRouter>);
