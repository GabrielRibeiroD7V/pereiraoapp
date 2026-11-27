import {useAuth} from '../auth/AuthProvider';
import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {useProfessionalRepository} from '../professional/ProfessionalProvider';
import type {EditableBusiness,ProfessionalCatalog} from '../professional/types';
import {PageHeader} from '../components/PageHeader';
import {FormField} from '../components/FormField';
import {Modal} from '../components/Modal';
import {AttendanceFields} from './AttendanceFields';
import {optimizeImage} from '../work/images';
import {usePresence} from './PresenceProvider';
import {CONSENT,TEAM_LIMIT,emptyLocation,locationError} from './model';
import type {Location,TeamMember} from './model';
import {TeamPortrait} from './PresenceSections';
const errorText=(cause:unknown)=>{
 const code=(cause as {code?:string})?.code;
 if(code==='40001')return 'Os dados mudaram em outra janela. Reabra esta tela antes de salvar novamente.';
 if(code==='42501')return 'Somente o responsável com e-mail confirmado pode fazer esta alteração.';
 return cause instanceof Error?cause.message:'Não foi possível salvar. Os dados anteriores foram preservados.';
};
function newMember():TeamMember{return {id:crypto.randomUUID(),name:'',profession:'',specialties:[],whatsapp:'',bio:'',position:0,active:true,photo_path:null,version:0,consent_version:CONSENT};}
export function PresenceEditor(){
 const {session}=useAuth();
 const navigate=useNavigate();
 const [leave,setLeave]=useState<string|null>(null);
 const {businessId=''}=useParams(),professional=useProfessionalRepository(),{data,error,repository,reload}=usePresence(businessId,true,false);
 const [business,setBusiness]=useState<EditableBusiness|null>(null),[catalog,setCatalog]=useState<ProfessionalCatalog|null>(null);
 const [location,setLocation]=useState<Location>({...emptyLocation}),[member,setMember]=useState<TeamMember|null>(null),[consent,setConsent]=useState(false),[specialtiesText,setSpecialtiesText]=useState('');
 const [pending,setPending]=useState(false),[message,setMessage]=useState(''),[failure,setFailure]=useState('');
 const [photo,setPhoto]=useState<{member:TeamMember;file:Blob;url:string;id:string;path?:string}|null>(null),[photoConsent,setPhotoConsent]=useState(false);
 const lock=useRef(false),input=useRef<HTMLInputElement>(null),selected=useRef<TeamMember|null>(null);
 const [removing,setRemoving]=useState<TeamMember|null>(null);
 useEffect(()=>{let live=true;setBusiness(null);setCatalog(null);if(professional)void Promise.all([professional.getEditable(businessId),professional.getCatalog()]).then(([b,c])=>{if(live){setBusiness(b);setCatalog(c);}}).catch(c=>{if(live)setFailure(errorText(c));});return()=>{live=false;};},[professional,businessId,session?.user.id]);
 useEffect(()=>{if(data)setLocation({...emptyLocation,...data.location,city_id:data.location?.city_id??''});},[data]);
 useEffect(()=>{return()=>{if(photo)URL.revokeObjectURL(photo.url);};},[photo]);
 const dirty=!!data&&JSON.stringify(location)!==JSON.stringify({...emptyLocation,...data.location,city_id:data.location?.city_id??''});
 useEffect(()=>{if(!dirty&&!member&&!photo&&!pending)return;const leave=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);},[dirty,member,photo,pending]);
 useEffect(()=>{if(!dirty&&!member&&!photo&&!pending)return;const follow=(event:MouseEvent)=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;if(!link||link.target==='_blank')return;const url=new URL(link.href);if(url.origin!==window.location.origin)return;event.preventDefault();event.stopPropagation();if(!pending)setLeave(url.pathname+url.search+url.hash);
 };document.addEventListener('click',follow,true);return()=>document.removeEventListener('click',follow,true);},[dirty,member,photo,pending]);
 async function run(action:()=>Promise<unknown>,success:string){if(lock.current)return;lock.current=true;setPending(true);setFailure('');setMessage('');try{await action();setMessage(success);reload();}catch(cause){setFailure(errorText(cause));}finally{lock.current=false;setPending(false);}}
 async function choose(file?:File){if(!file||!selected.current||lock.current)return;lock.current=true;setPending(true);setFailure('');try{const blob=await optimizeImage(file);setPhoto({member:selected.current,file:blob,url:URL.createObjectURL(blob),id:crypto.randomUUID()});setPhotoConsent(false);}catch(cause){setFailure(errorText(cause));}finally{lock.current=false;setPending(false);}}
 async function upload(){if(!photo||!photoConsent||!repository)return;
 await run(async()=>{
  const payload={id:photo.member.id,version:photo.member.version,photo_id:photo.id,consent_version:CONSENT};
  const prepared=await repository.command(businessId,'photo_prepare',payload) as {path:string;ready:boolean};
  // Keep the same operation ID on retry; a failure never changes the previous portrait.
  if(!prepared.ready)await repository.upload(prepared.path,photo.file);
  await repository.command(businessId,'photo_finish',payload);setPhoto(null);
 },'Fotografia da equipe salva. Ela não foi adicionada ao portfólio.');}
 const company=business?.input.type==='empresa';
 function update<K extends keyof Location>(key:K,value:Location[K]){setLocation(current=>({...current,[key]:value,...(key==='mode'&&value==='home'?{public_address:false}:{})}));}
 return <div className="presence-editor"><Link className="back-link" to={`/conta/profissional/${businessId}/editar?secao=atendimento`}>Voltar à edição do mesmo perfil</Link><PageHeader title={company?"Equipe e local de atendimento":"Local de atendimento"}/>
 <p>Salvar aqui não publica seu perfil.{company&&' Integrantes não recebem acesso à conta, à administração ou às conversas.'}</p>
 {(error||failure)&&!member&&!photo&&<p className="form-error" role="alert">{failure||error}</p>}{message&&<p className="form-notice" role="status">{message}</p>}
 {!data&&!error&&<p role="status">Carregando dados salvos…</p>}
 {data&&repository&&business&&catalog&&<>
 <form className="auth-form" onSubmit={e=>{e.preventDefault();const text=locationError(location);if(text){setFailure(text);return;}void run(()=>repository.command(businessId,'location',{...location}),'Local de atendimento salvo.');}}><fieldset disabled={pending}><legend>Atendimento e endereço</legend>
 <AttendanceFields location={location} update={update} catalog={catalog}/>
 <div className="work-actions"><button className="button button--primary" disabled={pending||!dirty}>Salvar atendimento</button><button type="button" className="button button--secondary" disabled={pending||!dirty} onClick={()=>setLocation({...emptyLocation,...data.location,city_id:data.location?.city_id??''})}>Cancelar alterações</button></div>
 </fieldset></form>
 {company&&<section aria-label="Gerenciar equipe"><div className="work-toolbar"><h2>Nossa equipe</h2><button className="button button--primary" disabled={pending||dirty||data.members.length>=TEAM_LIMIT} onClick={()=>{setMember(newMember());setConsent(false);setSpecialtiesText('');}}>Adicionar integrante</button></div><p className="field-help">{dirty&&'Salve ou cancele o endereço antes de editar a equipe. '}Até {TEAM_LIMIT} integrantes. Contatos individuais usam WhatsApp; o chat do PEREIRÃO continua centralizado na empresa.</p>
 {!data.members.length&&<p>Nenhum integrante cadastrado.</p>}<ul className="team-grid">{data.members.map((item,index)=><li key={item.id}><TeamPortrait member={item} repository={repository} owner/><h3>{item.name}</h3><p>{item.profession}</p><p>{item.active?'Visível quando o perfil estiver público':'Oculto'}</p><fieldset className="team-actions" disabled={pending||dirty}><button disabled={pending} onClick={()=>{setMember({...item});setConsent(false);setSpecialtiesText(item.specialties.join(', '));}} aria-label={`Editar ${item.name}`}>Editar</button><button disabled={pending} onClick={()=>{selected.current=item;input.current?.click();}} aria-label={`Alterar foto de ${item.name}`}>Foto</button>{item.photo_path&&<button disabled={pending} onClick={()=>void run(()=>repository.command(businessId,'photo_clear',{id:item.id,version:item.version}),'Fotografia retirada da equipe.')}>Retirar foto</button>}
 {[-1,1].map(delta=><button key={delta} disabled={pending||index+delta<0||index+delta>=data.members.length} aria-label={`${delta<0?'Subir':'Descer'} ${item.name}`} onClick={()=>{const list=[...data.members];[list[index],list[index+delta]]=[list[index+delta]!,list[index]!];void run(()=>repository.command(businessId,'reorder',{ids:list.map(m=>m.id),versions:Object.fromEntries(data.members.map(m=>[m.id,m.version]))}),'Ordem atualizada.');}}>{delta<0?'↑':'↓'}</button>)}<button disabled={pending} onClick={()=>setRemoving(item)} aria-label={`Remover ${item.name}`}>Remover</button></fieldset></li>)}</ul>
 <input ref={input} type="file" className="visually-hidden" aria-label="Selecionar foto do integrante" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void choose(file);}}/>
 </section>}
 <p><Link to={`/conta/profissional/${businessId}/previa`}>Ver como cliente com os dados salvos</Link></p>
 </>}
 {member&&repository&&<Modal locked={pending} title={member.version?'Editar integrante':'Adicionar integrante'} onClose={()=>{if(!pending)setMember(null);}}><form className="auth-form" onSubmit={e=>{e.preventDefault();if(!consent)return;void run(async()=>{await repository.command(businessId,'save',{...member,specialties:specialtiesText.split(',').map(s=>s.trim()).filter(Boolean),whatsapp:member.whatsapp.replace(/\D/g,''),consent_version:CONSENT});setMember(null);},'Integrante salvo. Nenhuma permissão de acesso foi concedida.');}}><fieldset disabled={pending}>
 <FormField id="team-name" label="Nome" required minLength={2} maxLength={100} value={member.name} onChange={e=>setMember({...member,name:e.target.value})}/><FormField id="team-role" label="Função ou profissão" maxLength={100} value={member.profession} onChange={e=>setMember({...member,profession:e.target.value})}/>
 <FormField id="team-specialties" label="Especialidades (separe por vírgula; até 12)" value={specialtiesText} onChange={e=>setSpecialtiesText(e.target.value)}/>
 <FormField id="team-whatsapp" label="WhatsApp individual (opcional, país e DDD)" type="tel" maxLength={24} value={member.whatsapp} onChange={e=>setMember({...member,whatsapp:e.target.value})}/>
 <label htmlFor="team-bio">Breve apresentação (opcional)</label><textarea id="team-bio" rows={3} maxLength={600} value={member.bio} onChange={e=>setMember({...member,bio:e.target.value})}/>
 <label className="presence-consent"><input type="checkbox" checked={member.active} onChange={e=>setMember({...member,active:e.target.checked})}/>Exibir integrante quando o perfil estiver público</label>
 <label className="presence-consent"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/>Tenho autorização deste integrante para divulgar estes dados e seu número pessoal, quando informado. Declaração da empresa, sem selo de verificação.</label>
 <p className="field-help">Depois de salvar, escolha a foto diretamente no card e confirme antes do envio.</p>{failure&&<p role="alert">{failure}</p>}
 <div className="work-actions"><button className="button button--primary" disabled={pending||!consent}>Salvar integrante</button><button type="button" className="button button--secondary" disabled={pending} onClick={()=>setMember(null)}>Cancelar</button></div></fieldset></form></Modal>}
 {photo&&<Modal locked={pending} title="Confirmar foto do integrante" onClose={()=>{if(!pending)setPhoto(null);}}><img className="team-photo-preview" src={photo.url} alt="Prévia da foto escolhida"/><p>Esta foto será usada somente na equipe, separada do retrato da empresa e do portfólio.</p><label className="presence-consent"><input type="checkbox" disabled={pending} checked={photoConsent} onChange={e=>setPhotoConsent(e.target.checked)}/>O integrante autorizou a publicação desta fotografia.</label>{failure&&<p role="alert">{failure} A foto anterior permanece. Tente novamente sem escolher outro arquivo.</p>}<div className="work-actions"><button disabled={pending} onClick={()=>setPhoto(null)}>Cancelar sem enviar</button><button className="button button--primary" disabled={pending||!photoConsent} onClick={()=>void upload()}>{pending?'Enviando…':'Confirmar e enviar foto'}</button></div></Modal>}
 {removing&&repository&&<Modal locked={pending} title="Remover integrante?" onClose={()=>{if(!pending)setRemoving(null);}}><p>O integrante deixará de aparecer no perfil. Arquivos preservados para contenção não serão exibidos.</p><div className="work-actions"><button disabled={pending} onClick={()=>setRemoving(null)}>Cancelar</button><button disabled={pending} onClick={()=>void run(async()=>{await repository.command(businessId,'remove',{id:removing.id,version:removing.version});setRemoving(null);},'Integrante removido do perfil.')}>Confirmar remoção</button></div></Modal>}
 {leave&&<Modal title="Descartar alterações não salvas?" onClose={()=>setLeave(null)}><p>As alterações ainda não confirmadas não serão gravadas.</p><div className="work-actions"><button onClick={()=>setLeave(null)}>Continuar editando</button><button onClick={()=>navigate(leave)}>Descartar e sair</button></div></Modal>}
 </div>;
}
