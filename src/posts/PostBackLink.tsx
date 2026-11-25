import {Link,useLocation,useNavigate} from 'react-router-dom';
export function validPostOrigin(origin:unknown):boolean{
 if(!origin||typeof origin!=='object')return false;
 const {path,key}=origin as {path?:unknown;key?:unknown};
 if(typeof key!=='string'||!key||typeof path!=='string'||!path.startsWith('/')||path.startsWith('//'))return false;
 const pathname=path.split(/[?#]/)[0]!;
 return /^\/(?:$|buscar$|conta(?:\/|$)|prestadores\/[^/?#]+(?:\/fotos\/[a-f0-9-]+)?$|pessoas\/[a-f0-9-]+$)/i.test(pathname);
}
export function PostBackLink({fallback}:{fallback:string}){
 const location=useLocation(),navigate=useNavigate();
 return validPostOrigin(location.state?.postOrigin)?<button type="button" className="back-link" onClick={()=>navigate(-1)}>Voltar</button>:<Link className="back-link" to={fallback}>Voltar ao perfil</Link>;
}
