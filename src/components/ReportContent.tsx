import {useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {useAuth} from '../auth/AuthProvider';
import {supabase} from '../lib/supabase';
import {Modal} from './Modal';
export function ReportContent({kind,id}:{kind:'business'|'post'|'personal_post';id:string}){
 const {session}=useAuth(),location=useLocation();const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[pending,setPending]=useState(false),[message,setMessage]=useState('');
 if(!session)return <Link className="text-link" to={`/entrar?next=${encodeURIComponent(location.pathname+location.search)}`}>Entrar para denunciar conteúdo</Link>;
 return <><button className="text-link" onClick={()=>setOpen(true)}>Denunciar conteúdo</button>{open&&<Modal title="Denunciar conteúdo" locked={pending} onClose={()=>setOpen(false)}><p>A denúncia será analisada pela moderação. Não inclua dados pessoais desnecessários.</p><label>Motivo<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000}/></label>{message&&<p role="status">{message}</p>}<button className="button" disabled={pending||reason.trim().length<10} onClick={()=>{if(!supabase){setMessage('Indisponível neste momento.');return;}setPending(true);void supabase.rpc('report_content',{kind,target:id,reason:reason.trim()}).then(({error})=>{setPending(false);setMessage(error?'Não foi possível enviar. Confirme seu e-mail e tente novamente mais tarde.':'Denúncia registrada.');});}}>Enviar denúncia</button></Modal>}</>;
}
