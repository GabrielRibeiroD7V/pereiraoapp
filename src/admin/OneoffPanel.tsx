import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Modal } from "../components/Modal";
interface RequestView {
 id:string;environment:"sandbox"|"production";method:"PIX"|"CREDIT_CARD";state:string;
 checkout_id:string|null;payment_id:string|null;amount_cents:number;net_cents:number|null;
 diagnostic:string|null;provider_status:string|null;refunded_cents:number;
}
interface Status {environment:"sandbox"|"production";enabledUntil:string|null;items:RequestView[];maxTotalCents:number;maxPerMethod:number;sandboxReady:boolean;eventsPending:number;eventsIgnored:number;lastEventReceivedAt:string|null}
export interface OneoffApi {call(body:Record<string,unknown>):Promise<{data:unknown;writeEnabled?:boolean}>}
const api:OneoffApi={async call(body){
 if(!supabase)throw Error('SETUP_REQUIRED');const s=await supabase.auth.getSession();if(!s.data.session)throw Error('AUTH_REQUIRED');
 const r=await fetch('/api/admin-oneoff-billing',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.data.session.access_token},body:JSON.stringify(body)});
 const result=await r.json();if(!r.ok)throw Error(result.code??'UNAVAILABLE');return result;
}};
const money=(n:number|null)=>n==null?'Indisponível':(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const labels:Record<string,string>={authorized:'Autorizado; checkout ainda não criado',creating:'Criação em andamento; não repetir',uncertain:'Criação incerta; conciliar antes de qualquer ação',pending:'Pendente',paid:'Pagamento confirmado por conciliação',refused:'Pagamento recusado',overdue:'Vencido',refunded:'Estornado',partially_refunded:'Estorno parcial',cancelled:'Cancelado',expired:'Checkout expirado',refund_pending:'Estorno em andamento',disputed:'Pagamento em disputa'};
const errorText=(e:unknown)=>{
 const code=e instanceof Error?e.message:'';
 return code==='SETUP_REQUIRED'?'Aguarda migração e configuração segura do servidor.':code==='DISABLED'?'Operação desligada neste ambiente.':code==='RECONCILIATION_REQUIRED'?'Resultado incerto. Não crie outro checkout: atualize a situação e faça a conciliação.':code==='MISMATCH'?'Divergência na conciliação; não confirmado.':code==='CONFLICT'?'Operação já reservada ou alteração concorrente. Atualize a situação.':code==='BUSY'?'Conciliação recente/em andamento. Aguarde e atualize.':'Não foi possível concluir. Atualize a situação; não repita a criação.';
};
export function OneoffPanel({repository=api}:{repository?:OneoffApi}){
 const [data,setData]=useState<Status|null>(null),[write,setWrite]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),
 [method,setMethod]=useState<'PIX'|'CREDIT_CARD'>('PIX'),[customer,setCustomer]=useState(''),[consent,setConsent]=useState(false),
 [reason,setReason]=useState(''),[windowConsent,setWindowConsent]=useState(false),[create,setCreate]=useState<RequestView|null>(null),[creationConsent,setCreationConsent]=useState(false);
 const lock=useRef(false),id=useRef('');
 const refresh=useCallback(async()=>{const r=await repository.call({action:'status'});setData(r.data as Status);setWrite(r.writeEnabled===true);},[repository]);
 useEffect(()=>{let live=true;repository.call({action:'status'}).then(r=>{if(live){setData(r.data as Status);setWrite(r.writeEnabled===true);}}).catch(e=>{if(live)setError(errorText(e));});return()=>{live=false;};},[repository]);
 async function action(body:Record<string,unknown>){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await repository.call({...body,environment:data?.environment});await refresh();return true;}catch(e){setError(errorText(e));return false;}finally{lock.current=false;setBusy(false);}}
 const enabled=!!data?.enabledUntil&&new Date(data.enabledUntil).getTime()>Date.now();
 return <section className="admin-oneoff" aria-label="Testes avulsos Asaas">
  <h3>Testes avulsos — Pix e cartão de crédito</h3>
  <p>Área administrativa. Dois testes únicos de R$ 19,90, teto total R$ 39,80 por ambiente. Não são assinaturas e não modificam a gratuidade dos profissionais.</p>
  <p>O cartão é informado exclusivamente no checkout hospedado do Asaas. Não informe cartão, CPF ou credenciais neste painel.</p>
  <div className="finance-metrics"><div><span>Pix avulso planejado</span><strong>R$ 19,90</strong><small>Uma cobrança, sem recorrência</small></div><div><span>Crédito avulso planejado</span><strong>R$ 19,90</strong><small>Checkout hospedado Asaas</small></div><div><span>Teto por ambiente</span><strong>R$ 39,80</strong><small>Não representa valor recebido</small></div></div>
  {error&&<p role="alert">{error}</p>}
  {!data&&!error&&<p role="status">Carregando situação…</p>}
  <button className="button button--secondary" disabled={busy} onClick={()=>void action({action:'status'})}>Atualizar situação</button>
  {data&&<>
   <p><strong>Ambiente: {data.environment==='production'?'Production — dinheiro real':'Sandbox — simulação financeira'}</strong></p>
   <p>{write?'Servidor permite o modo de teste; cada criação ainda exige autorização própria.':'Criação desligada no servidor. Este painel não autoriza um teste real.'}</p>
   {data.environment==='production'&&!data.sandboxReady&&<p>Criação real também bloqueada até a homologação avulsa de Pix e cartão no Sandbox, com entrega de webhook e conciliação.</p>}
   <p>Eventos aguardando conciliação: {data.eventsPending}. Eventos sem vínculo ignorados: {data.eventsIgnored}. Último evento recebido: {data.lastEventReceivedAt?new Date(data.lastEventReceivedAt).toLocaleString('pt-BR'):'Nenhum'}.</p>
   <p>Janela administrativa: {enabled?'aberta até '+new Date(data.enabledUntil!).toLocaleString('pt-BR'):'fechada'}. Desligar não cancela checkouts já emitidos.</p>
   <fieldset disabled={busy}>
    <legend>1. Janela de testes</legend>
    <label>Justificativa<textarea value={reason} maxLength={500} onChange={e=>setReason(e.target.value)}/></label>
    <label><input type="checkbox" checked={windowConsent} onChange={e=>setWindowConsent(e.target.checked)}/>Confirmo esta decisão administrativa; abrir a janela não cria checkout.</label>
    <button className="button button--secondary" disabled={!windowConsent||reason.trim().length<5||(!enabled&&(!write||data.environment==='production'&&!data.sandboxReady))} onClick={()=>void action({action:'configure',enabled:!enabled,reason,confirmation:'CONFIRMAR TESTE AVULSO'})}>{enabled?'Desligar novas criações':'Abrir janela por uma hora'}</button>
   </fieldset>
   <form onSubmit={e=>{e.preventDefault();if(!id.current)id.current=crypto.randomUUID();void action({action:'authorize',requestId:id.current,method,customerId:customer.trim(),payerConsent:consent,confirmation:'AUTORIZO TESTE AVULSO 19,90'}).then(ok=>{if(ok){id.current='';setConsent(false);}});}}>
    <fieldset disabled={busy||!write||!enabled}>
     <legend>2. Autorizar uma operação específica</legend>
     <label>Modalidade<select value={method} onChange={e=>{setMethod(e.target.value as typeof method);id.current='';}}><option value="PIX">Pix avulso — R$ 19,90</option><option value="CREDIT_CARD">Crédito avulso — R$ 19,90</option></select></label>
     <label>ID do pagador existente no Asaas<input value={customer} onChange={e=>{setCustomer(e.target.value);id.current='';}} placeholder="cus_…" autoComplete="off" required pattern="cus_[A-Za-z0-9_-]+"/></label>
     <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Confirmo o pagador consentido e autorizo somente esta modalidade avulsa de R$ 19,90.</label>
     <button className="button button--secondary" disabled={!consent||data.items.some(x=>x.method===method)}>Registrar autorização — não cria checkout</button>
    </fieldset>
   </form>
   {!data.items.length&&<p>Nenhuma operação registrada neste ambiente.</p>}
   {data.items.map(r=><article key={r.id} className="form-notice" data-state={r.state}>
    <h4>{r.method==='PIX'?'Pix':'Cartão de crédito'} — {money(r.amount_cents)}</h4><p>{labels[r.state]??'Situação indisponível'}</p>
    {r.diagnostic&&<p role="alert">{r.diagnostic==='mismatch'?'Divergência: resultado exige revisão.':'Conciliação necessária; não repetir criação.'}</p>}
    <dl><dt>Operação</dt><dd style={{overflowWrap:'anywhere'}}>{r.id}</dd><dt>Checkout</dt><dd style={{overflowWrap:'anywhere'}}>{r.checkout_id??'Não confirmado'}</dd><dt>Pagamento</dt><dd style={{overflowWrap:'anywhere'}}>{r.payment_id??'Não identificado'}</dd><dt>Bruto do pagamento</dt><dd>{money(r.payment_id?r.amount_cents:null)}</dd><dt>Líquido observado na API</dt><dd>{money(r.net_cents)}</dd><dt>Descontos/taxas observados (bruto − líquido)</dt><dd>{money(r.net_cents==null?null:r.amount_cents-r.net_cents)}</dd><dt>Estorno confirmado</dt><dd>{money(r.refunded_cents)}</dd></dl>
    {r.state==='authorized'&&<button className="button button--primary" disabled={busy||!write||!enabled} onClick={()=>{setCreate(r);setCreationConsent(false);}}>Revisar criação do checkout</button>}
    {r.checkout_id&&<a className="button button--secondary" href={(data.environment==='sandbox'?'https://sandbox.asaas.com':'https://asaas.com')+'/checkoutSession/show?id='+r.checkout_id} target="_blank" rel="noopener noreferrer">Abrir checkout oficial do Asaas</a>}
    <button className="button button--secondary" disabled={busy} onClick={()=>void action({action:'reconcile',requestId:r.id})}>Conciliar pela API — somente leitura no Asaas</button>
   </article>)}
   <button className="button button--secondary" disabled={busy} onClick={()=>void action({action:'retry'})}>Reprocessar eventos persistidos</button>
   <p>Não reiniciar uma tentativa incerta. Cancelamento/estorno devem ser decididos separadamente no Asaas; a conciliação preserva o histórico e não libera outra cota.</p>
  </>}
  {create&&<Modal title="Confirmar checkout avulso" locked={busy} onClose={()=>setCreate(null)}>
   <p>{create.method==='PIX'?'Pix':'Cartão de crédito'}: R$ 19,90, uma única cobrança. {data?.environment==='production'?'Este é um teste com dinheiro real.':'Este é um teste Sandbox.'} Não haverá assinatura.</p>
   <label><input type="checkbox" checked={creationConsent} onChange={e=>setCreationConsent(e.target.checked)}/>Confirmo a criação deste checkout e o consentimento do pagador.</label>
   <div className="work-actions"><button className="button" disabled={busy} onClick={()=>setCreate(null)}>Cancelar sem criar</button><button className="button button--primary" disabled={busy||!creationConsent||!write||!enabled} onClick={()=>void action({action:'create',requestId:create.id,confirmation:'CRIAR CHECKOUT AVULSO 19,90'}).then(ok=>{if(ok)setCreate(null);})}>Criar somente este checkout avulso</button></div>
  </Modal>}
 </section>;
}
