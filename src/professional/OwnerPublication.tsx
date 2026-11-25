import {useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Modal} from '../components/Modal';
import type {BusinessRow} from '../lib/database.types';
import type {ProfessionalRepository} from './types';
import {professionalError} from './validation';
export function OwnerPublication({business,repository,onChanged}:{business:BusinessRow;repository:ProfessionalRepository|null;onChanged:()=>void}){
 const [action,setAction]=useState<'publish'|'unpublish'|'delete'|null>(null),[pending,setPending]=useState(false),[error,setError]=useState('');const busy=useRef(false),navigate=useNavigate();
 if(!repository?.publication)return null;
 async function confirm(){if(!action||busy.current||!repository?.publication)return;busy.current=true;setPending(true);setError('');try{await repository.publication(business.id,action,business.status);setAction(null);if(action==='delete')navigate('/conta',{replace:true});else onChanged();}catch(e){setError(professionalError(e));}finally{busy.current=false;setPending(false);}}
 return <section aria-label="Publicação do perfil" className="owner-publication">
 <button className="button button--secondary" onClick={()=>{setError('');setAction(business.status==='published'?'unpublish':'publish');}}>{business.status==='published'?'Retirar perfil do ar':'Publicar meu perfil'}</button>
 <button className="text-link" onClick={()=>{setError('');setAction('delete');}}>Excluir perfil profissional</button>
 {action&&<Modal title={action==='publish'?'Publicar seu perfil?':action==='delete'?'Excluir perfil profissional?':'Retirar perfil do ar?'} locked={pending} onClose={()=>setAction(null)}>
 <p>{business.name}</p><p>{action==='publish'?'Qualquer visitante poderá ver sua bio, apresentação, contatos, serviços ativos e fotos de trabalhos, e encontrar você na busca. Seus posts em rascunho continuam privados até você publicá-los separadamente. Confirme que tem autorização para divulgar essas informações e imagens.':action==='delete'?'O perfil e seus trabalhos sairão do ar. O histórico e os vínculos existentes serão preservados para integridade. Esta ação não exclui sua conta.':'O perfil, seus contatos e serviços deixam a busca. Seus posts públicos continuam no feed até você retirá-los separadamente.'}</p>
 {error&&<p role="alert">{error}</p>}<div className="work-actions"><button className="button button--secondary" disabled={pending} onClick={()=>setAction(null)}>Cancelar</button><button className="button button--primary" disabled={pending} onClick={()=>void confirm()}>{pending?'Aguarde…':'Confirmar'}</button></div>
 </Modal>}
 </section>;
}
