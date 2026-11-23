import { useNavigate } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { useEffect, useRef, useState } from 'react';
import { emptyPresentation, normalizePresentation, presentationLimits, validatePresentation } from './model';
import type { Presentation } from './model';
import { usePresentationRepository } from './PresentationProvider';
export function PresentationEditor({ businessId, company, onSaved }: { businessId: string; company: boolean; onSaved: () => void }) {
  const repository = usePresentationRepository();
  const navigate = useNavigate();
  const [leave,setLeave] = useState<string|null>(null);
  const [saved,setSaved] = useState<Presentation>(emptyPresentation), [input,setInput] = useState<Presentation>(emptyPresentation);
  const [available,setAvailable] = useState(false), [pending,setPending] = useState(false), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const busy = useRef(false), generation = useRef(0);
  const dirty = JSON.stringify(saved) !== JSON.stringify(input);
  useEffect(() => { let live = true; generation.current++; setAvailable(false); setError(''); setInput(emptyPresentation); setSaved(emptyPresentation);
    if(repository) void repository.get(businessId).then(result => { if(live){setAvailable(result.available);setSaved(result.data);setInput(result.data);} }).catch(() => {if(live)setError('Não foi possível carregar a apresentação.');});
    return () => { live=false;generation.current++; };
  }, [repository,businessId]);
  useEffect(() => { if(!dirty && !pending)return; const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';}; const follow=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const link=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;if(!link||link.target==='_blank'||link.hasAttribute('download'))return;const url=new URL(link.href);if(url.origin!==location.origin)return;event.preventDefault();event.stopPropagation();if(!pending)setLeave(url.pathname+url.search+url.hash);}; window.addEventListener('beforeunload',prevent);document.addEventListener('click',follow,true); return()=>{window.removeEventListener('beforeunload',prevent);document.removeEventListener('click',follow,true);}; },[dirty,pending]);
  const labels: Record<keyof Presentation,string> = { headline: company ? 'Título da empresa' : 'Título profissional', experience: company ? 'Histórico e experiência da empresa' : 'Experiência profissional', education: company ? 'Qualificação da equipe (com atribuição)' : 'Formação', certifications:'Certificações (opcional)', professional_registration:'Registro profissional (opcional)' };
  return <section className="presentation-editor" aria-label="Apresentação profissional"><h2>Apresentação profissional</h2><p className="field-help">{company ? 'Descreva a empresa. Qualificações de pessoas devem identificar o responsável ou integrante da equipe, sem dados privados.' : 'Conte sua trajetória. Todos os campos são opcionais e devem conter apenas dados que você autoriza tornar públicos.'} Não há verificação de credenciais ou selo automático.</p>
    {!available && !error && <p role="status">Campos adicionais aguardam ativação autorizada. Seu perfil atual foi preservado.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    <form onSubmit={async event=>{event.preventDefault();if(!repository||!available||busy.current)return;const message=validatePresentation(input);if(message){setError(message);return;} const token=generation.current;busy.current=true;setPending(true);setError('');setNotice('');try{await repository.save(businessId,normalizePresentation(input));const result=await repository.get(businessId);if(token!==generation.current)return;setSaved(result.data);setInput(result.data);setNotice('Apresentação salva. Publicação e gratuidade não foram alteradas.');onSaved();}catch{if(token===generation.current)setError('Não foi possível salvar. Sua edição foi preservada.');}finally{busy.current=false;if(token===generation.current)setPending(false);}}}>
      <fieldset disabled={!available||pending}>
        <div className="form-field"><label htmlFor="presentation-headline">{labels.headline}</label><input id="presentation-headline" value={input.headline} maxLength={120} onChange={event=>setInput({...input,headline:event.target.value})}/></div>
        <details className="presentation-editor__details"><summary>Experiência, formação e credenciais (opcional)</summary>
          {(Object.keys(labels) as (keyof Presentation)[]).filter(key=>key!=='headline').map(key=><div className="form-field" key={key}><label htmlFor={`presentation-${key}`}>{labels[key]}</label><textarea id={`presentation-${key}`} rows={key==='professional_registration'?2:3} value={input[key]} maxLength={presentationLimits[key]} onChange={event=>setInput({...input,[key]:event.target.value})}/></div>)}
        </details>
      </fieldset>
      <p className="field-help">{dirty?'Alterações não salvas: a prévia continua mostrando os dados gravados.':'Somente informações salvas aparecem na prévia.'}</p>
      <div className="work-actions"><button className="button button--primary" disabled={!available||pending||!dirty}>{pending?'Salvando…':'Salvar apresentação'}</button><button type="button" className="button button--secondary" disabled={pending||!dirty} onClick={()=>{setInput(saved);setError('');navigate(`/conta/profissional/${businessId}/perfil`,{replace:true});}}>Cancelar apresentação</button></div>
    </form>{leave && <Modal title="Descartar apresentação não salva?" onClose={()=>setLeave(null)}><p>A prévia não contém as alterações ainda não gravadas.</p><div className="work-actions"><button type="button" className="button button--secondary" onClick={()=>setLeave(null)}>Continuar na apresentação</button><button type="button" className="button button--primary" onClick={()=>{const target=leave;setLeave(null);navigate(target);}}>Descartar e sair</button></div></Modal>}</section>;
}
