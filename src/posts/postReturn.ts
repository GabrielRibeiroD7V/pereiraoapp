import {useEffect} from 'react';
import {useLocation,useNavigationType} from 'react-router-dom';
const positions=new Map<string,number>();
export const profileViews=new Map<string,{tab:string;page:number}>();
export function rememberPostScroll(key:string,y:number){positions.set(key,y);if(positions.size>40)positions.delete(positions.keys().next().value!);}
export function usePostScrollReturn(){
 const location=useLocation(),type=useNavigationType();
 useEffect(()=>{
  const saved=type==='POP'?positions.get(location.key):undefined;
  if(saved===undefined)return;
  let done=false,frame=0;
  const restore=()=>{if(done||document.documentElement.scrollHeight-window.innerHeight<saved-2)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(done)return;window.scrollTo(0,saved);done=true;observer.disconnect();clearTimeout(finish);});};
  const observer=new MutationObserver(restore);observer.observe(document.getElementById('main-content')??document.body,{childList:true,subtree:true});
  const finish=setTimeout(()=>{done=true;observer.disconnect();},4000);restore();
  return()=>{done=true;clearTimeout(finish);cancelAnimationFrame(frame);observer.disconnect();};
 },[location.key,type]);
}
