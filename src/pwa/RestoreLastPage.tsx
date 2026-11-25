import {useEffect,useRef} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';

const KEY='pereirao.last-page';
const SAFE=/^\/(?:conta(?:\/[^?#]*)?|buscar(?:\/[^?#]*)?|mensagens(?:\/[^?#]*)?|prestadores\/[^/?#]+(?:\/fotos\/[a-f0-9-]+)?|trabalhos\/[a-f0-9-]+|publicacoes\/[a-f0-9-]+|pessoas\/[a-f0-9-]+)$/;

// Quando o sistema reabre o ícone instalado pela start_url, recupera a última
// página da mesma sessão. Navegação explícita para Início continua intacta.
export function RestoreLastPage(){
  const location=useLocation(),navigate=useNavigate();
  const initial=useRef(true);
  useEffect(()=>{
    try {
      if(initial.current){
        initial.current=false;
        if(location.pathname==='/' && new URLSearchParams(location.search).get('source')==='pwa'){
          const previous=sessionStorage.getItem(KEY);
          if(previous && previous.startsWith('/') && !previous.startsWith('//') && SAFE.test(new URL(previous,window.location.origin).pathname)) {navigate(previous,{replace:true});return;}
        }
      }
      if(location.pathname==='/' || SAFE.test(location.pathname)) sessionStorage.setItem(KEY,location.pathname+location.search+location.hash);
    } catch { /* Navegação normal quando o armazenamento está indisponível. */ }
  },[location.pathname,location.search,location.hash,navigate]);
  return null;
}
