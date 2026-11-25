import{useCallback,useEffect,useRef,useState}from'react';
import type{WorkingHours}from'./model';import{emptyHours,openAt,periodLabel,timezones,validateHours,weekdays}from'./model';
import{useHoursRepository}from'./HoursProvider';import{usePublicQuery}from'../marketplace/usePublicQuery';
import{useSectionAnchor}from'../hooks/useSectionAnchor';
const order=[1,2,3,4,5,6,0];
export function HoursFields({value,onChange,disabled=false}:{value:WorkingHours;onChange:(value:WorkingHours)=>void;disabled?:boolean}){
 function periods(day:number,rows:WorkingHours['schedule'][number]){onChange({...value,schedule:value.schedule.map((old,d)=>d===day?rows:old)});}
 return <fieldset disabled={disabled} className="working-hours-fields"><legend>Horários de atendimento (opcional)</legend>
  <label className="hours-check"><input type="checkbox" checked={value.enabled} onChange={e=>onChange({...value,enabled:e.target.checked})}/>Informar dias e horários</label>
  {value.enabled&&<><div className="form-field"><label htmlFor="hours-timezone">Fuso dos horários</label><select id="hours-timezone" value={value.timezone} onChange={e=>onChange({...value,timezone:e.target.value})}>{timezones.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
   <p className="field-help">Até dois intervalos por dia. Fim anterior ao início termina no dia seguinte; horários iguais indicam 24 horas.</p>
   {order.map(day=><div className="hours-day" key={day}>
    <label className="hours-check"><input type="checkbox" checked={!!value.schedule[day]?.length} onChange={e=>periods(day,e.target.checked?[{start:'08:00',end:'18:00'}]:[])}/>{weekdays[day]}</label>
    {!value.schedule[day]?.length?<span className="field-help">Sem atendimento</span>:<>
     {value.schedule[day]!.map((period,index)=><div className="hours-period" key={index}>
      <label>Início<span className="visually-hidden"> de {weekdays[day]}, intervalo {index+1}</span><input aria-label={`Início de ${weekdays[day]}, intervalo ${index+1}`} type="time" value={period.start} onChange={e=>periods(day,value.schedule[day]!.map((p,i)=>i===index?{...p,start:e.target.value}:p))}/></label>
      <label>Fim<span className="visually-hidden"> de {weekdays[day]}, intervalo {index+1}</span><input aria-label={`Fim de ${weekdays[day]}, intervalo ${index+1}`} type="time" value={period.end} onChange={e=>periods(day,value.schedule[day]!.map((p,i)=>i===index?{...p,end:e.target.value}:p))}/></label>
      <p className="field-help">{periodLabel(period)}</p>
      {index>0&&<button type="button" className="text-link" onClick={()=>periods(day,value.schedule[day]!.filter((_,i)=>i!==index))}>Remover segundo intervalo de {weekdays[day]}</button>}
     </div>)}
     {value.schedule[day]!.length<2&&<button type="button" className="text-link" onClick={()=>periods(day,[...value.schedule[day]!,{start:'19:00',end:'20:00'}])}>Adicionar intervalo em {weekdays[day]}</button>}
    </>}
   </div>)}
   <label className="hours-check"><input type="checkbox" checked={value.acceptsOutsideHours} onChange={e=>onChange({...value,acceptsOutsideHours:e.target.checked})}/>Aceito contatos fora desses horários</label>
  </>}
 </fieldset>;
}
export function WorkingHoursEditor({businessId,state='MS',onDirty,onBusy,onSaved}:{businessId:string;state?:string;onDirty?:(value:boolean)=>void;onBusy?:(value:boolean)=>void;onSaved?:()=>void}){
 const repository=useHoursRepository(),[value,setValue]=useState(()=>emptyHours(state)),[saved,setSaved]=useState(()=>emptyHours(state));
 const [available,setAvailable]=useState(false),[loading,setLoading]=useState(true),[pending,setPending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[attempt,setAttempt]=useState(0);
 const generation=useRef(0),dirty=JSON.stringify(value)!==JSON.stringify(saved);
 useEffect(()=>{onDirty?.(dirty);return()=>onDirty?.(false);},[dirty,onDirty]);
 useEffect(()=>{onBusy?.(pending);return()=>onBusy?.(false);},[pending,onBusy]);
 useEffect(()=>{const epoch=++generation.current;setLoading(true);setAvailable(false);setError('');
  if(!repository){setLoading(false);return;}
  void repository.get(businessId).then(result=>{if(epoch!==generation.current)return;const next=result.data??emptyHours(state);setAvailable(result.available);setSaved(next);setValue(next);}).catch(()=>{if(epoch===generation.current)setError('Não foi possível carregar os horários. Sua edição não foi enviada.');}).finally(()=>{if(epoch===generation.current)setLoading(false);});
  return()=>{generation.current++;};
 },[repository,businessId,attempt]);
 async function save(){if(!repository||!available||loading||pending||!dirty)return;const message=validateHours(value);if(message){setError(message);return;}
  const epoch=generation.current;setPending(true);setError('');setNotice('');
  try{await repository.save(businessId,value);const result=await repository.get(businessId);if(epoch!==generation.current)return;if(!result.available||!result.data)throw Error('not confirmed');setValue(result.data);setSaved(result.data);setNotice('Horários salvos. O perfil mostra apenas os dados gravados.');onSaved?.();}
  catch(cause){if(epoch===generation.current)setError(typeof cause==='object'&&cause&&'code'in cause&&cause.code==='40001'?'Os horários mudaram em outra aba. Recarregue os dados salvos antes de tentar novamente.':'Não foi possível salvar ou confirmar os horários. Seus campos foram preservados.');}
  finally{if(epoch===generation.current)setPending(false);}
 }
 return<section className="working-hours-editor" aria-label="Editar horários de atendimento">
  <p className="field-help">Os horários têm salvamento próprio. Não publicam o perfil e não alteram a disponibilidade para novos trabalhos.</p>
  {loading&&<p role="status">Carregando horários…</p>}
  {!loading&&!available&&!error&&<p role="status">Horários aguardam ativação autorizada. Os demais dados do perfil continuam disponíveis.</p>}
  {error&&<p role="alert">{error} <button type="button" className="text-link" disabled={pending} onClick={()=>setAttempt(n=>n+1)}>Descartar edição e recarregar horários</button></p>}
  {notice&&<p role="status">{notice}</p>}
  <HoursFields value={value} onChange={v=>{setValue(v);setNotice('');setError('');}} disabled={!available||loading||pending}/>
  <div className="work-actions"><button className="button button--primary" type="button" disabled={!available||!dirty||pending||loading} onClick={()=>void save()}>{pending?'Salvando horários…':'Salvar horários'}</button><button className="button button--secondary" type="button" disabled={!dirty||pending} onClick={()=>{setValue(saved);setError('');setNotice('');}}>Cancelar horários</button></div>
 </section>;
}
export function WorkingHoursDisplay({businessId,publicOnly=false}:{businessId:string;publicOnly?:boolean}){
 const repository=useHoursRepository(),[now,setNow]=useState(()=>new Date());
 const load=useCallback(()=>repository?repository.get(businessId,publicOnly):Promise.resolve({available:false,data:null}),[repository,businessId,publicOnly]);
 const result=usePublicQuery(`${businessId}:${publicOnly}`,load),value=result.data?.data;
 useSectionAnchor(!!result.data);
 useEffect(()=>{const tick=()=>setNow(new Date()),id=window.setInterval(tick,60000);window.addEventListener('focus',tick);document.addEventListener('visibilitychange',tick);return()=>{window.clearInterval(id);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',tick);};},[]);
 const configured=value?.enabled&&!validateHours(value),open=configured?openAt(value,now):null;
 return<section id="horarios" className="public-profile-section working-hours-display" aria-label="Horários de atendimento"><h2>Horários de atendimento</h2>
  {result.loading?<p role="status">Carregando horários…</p>:result.error||result.data?.available===false?<p>Horários indisponíveis no momento.</p>:!configured?<p>Horário não informado.</p>:<>
   <p className={`hours-status${open?' hours-status--open':''}`}>{open?'Aberto agora':'Fora do horário de atendimento'}</p>
   <dl className="hours-list">{order.map(day=><div key={day}><dt>{weekdays[day]}</dt><dd>{value.schedule[day]!.length?value.schedule[day]!.map(periodLabel).join(' · '):'Sem atendimento'}</dd></div>)}</dl>
   <p className="field-help">Fuso: {timezones.find(t=>t.id===value.timezone)?.label}. Horários informados pelo responsável; feriados podem variar.</p>
   <p>{value.acceptsOutsideHours?'Aceita contatos fora do horário.':'Atende aos contatos nos horários informados.'}</p>
  </>}
 </section>;
}
