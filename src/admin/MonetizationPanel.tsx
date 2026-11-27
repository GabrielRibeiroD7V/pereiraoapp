import { useEffect, useRef, useState } from "react";
import { Modal } from "../components/Modal";
import { adminError } from "./types";
import { monetizationRepository } from "./monetization";
import type { MonetizationRepository, MonetizationStatus } from "./monetization";
export function MonetizationPanel({repository=monetizationRepository}:{repository?:MonetizationRepository}) {
  const [data,setData]=useState<MonetizationStatus|null>(null),[error,setError]=useState(""),
    [confirm,setConfirm]=useState(false),[reason,setReason]=useState(""),[accepted,setAccepted]=useState(false),
    [busy,setBusy]=useState(false),[revision,refresh]=useState(0),lock=useRef(false);
  useEffect(()=>{
    const controller=new AbortController();setError("");setData(null);
    repository.status(controller.signal).then(value=>{if(!controller.signal.aborted)setData(value);})
      .catch(e=>{if(!controller.signal.aborted)setError(adminError(e));});
    return ()=>controller.abort();
  },[repository,revision]);
  async function save(){
    if(!data || !accepted || reason.trim().length<5 || lock.current)return;
    lock.current=true;setBusy(true);setError("");
    try{setData(await repository.set(!data.newContractsEnabled,data.revision,reason.trim()));setConfirm(false);}
    catch(e){setError(adminError(e));}
    finally{lock.current=false;setBusy(false);}
  }
  const canEnable=!!data?.contractingReady && !data.initialFree;
  return <section aria-label="Monetização">
    {error && <p role="alert">{error} <button className="text-link" onClick={()=>refresh(n=>n+1)}>Atualizar situação</button></p>}
    {!data && !error && <p role="status">Carregando política financeira…</p>}
    {data && <>
      <h3>{data.initialFree ? "Plataforma gratuita, sem prazo" : "Política de contratações"}</h3>
      <p>Preço configurado para contratação futura: <strong>{(data.monthlyCents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}/mês por negócio</strong>.</p>
      <dl className="admin-metrics">
        <div><dt>Novas contratações</dt><dd>{data.newContractsEnabled ? "Habilitadas" : "Desligadas"}</dd></div>
        <div><dt>Checkout</dt><dd>Desligado</dd></div>
        <div><dt>Exigência de assinatura</dt><dd>Desligada</dd></div>
        <div><dt>Assinaturas reais</dt><dd>{data.subscriptions}</dd></div>
        <div><dt>Vínculos financeiros Production</dt><dd>{data.productionBindings}</dd></div>
        <div><dt>Pagamentos pendentes ou vencidos conciliados</dt><dd>{data.pendingPayments}</dd></div>
        <div><dt>Pagamentos registrados no banco (Production)</dt><dd>{data.productionReconciledPayments}</dd></div>
        <div><dt>Contratos de teste Sandbox (separados)</dt><dd>{data.sandboxContracts}</dd></div>
      </dl>
      <p>Este indicador conta registros de pagamentos armazenados; não mede chamadas ou consultas efetivas à API do Asaas.</p>
      <p>Controle administrativo preparado, mas bloqueado pela fase gratuita. Esta preparação não representa ativação operacional completa da cobrança.</p>
      <p>Asaas Production: {data.integration?.credentialsConfigured ? "credenciais presentes; homologação operacional não comprovada por esta consulta" : "configuração não confirmada"}. Receptor: {data.integration?.webhookEnabled ? "flag ligada; entrega não comprovada" : "desligado"}.</p>
      <p>Cartão recorrente: preparação Sandbox. Pix Automático e Pix mensal manual: homologação pendente. Débito: indisponível até comprovação de suporte.</p>
      <p>Habilitar novas contratações, exigir recursos pagos e executar recorrências consentidas são decisões distintas. Desligar contratações não cancela contratos existentes.</p>
      <button className="button button--secondary" onClick={()=>{setReason("");setAccepted(false);setConfirm(true);}}>{data.newContractsEnabled ? "Desativar novas contratações" : "Revisar habilitação de contratações"}</button>
      {confirm && <Modal title="Confirmar política de contratações" locked={busy} onClose={()=>setConfirm(false)}>
        {!data.newContractsEnabled && !canEnable && <p role="status">Habilitação bloqueada no servidor durante a fase gratuita. A liberação técnica e comercial exige uma entrega futura específica.</p>}
        <label>Justificativa<textarea maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} /></label>
        <label><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} />Confirmo esta alteração de novas contratações. Ela não cobra nem cancela assinaturas.</label>
        <div className="work-actions"><button className="button" disabled={busy} onClick={()=>setConfirm(false)}>Cancelar</button>
        <button className="button button--primary" disabled={busy || !accepted || reason.trim().length<5 || (!data.newContractsEnabled && !canEnable)} onClick={()=>void save()}>Confirmar alteração</button></div>
      </Modal>}
    </>}
  </section>;
}
