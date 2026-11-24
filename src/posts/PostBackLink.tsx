import {Link,useLocation,useNavigate} from 'react-router-dom';
export function PostBackLink({fallback}:{fallback:string}){
 const location=useLocation(),navigate=useNavigate();
 const origin=location.state?.postOrigin;
 const safe=origin&&typeof origin.key==='string'&&typeof origin.path==='string'&&/^\/(?:$|buscar(?:\?|$)|prestadores\/[^/?]+$|conta(?:\/|$))/.test(origin.path)&&!origin.path.startsWith('//');
 return safe?<button type="button" className="back-link" onClick={()=>navigate(-1)}>Voltar</button>:<Link className="back-link" to={fallback}>Voltar ao perfil</Link>;
}
