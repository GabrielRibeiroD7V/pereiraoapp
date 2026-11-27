import { createContext, useContext, useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleDollarSign, CreditCard, ReceiptText, FlaskConical, Settings2 } from 'lucide-react';
import { useBilling } from '../billing/BillingProvider';
import type { SandboxBillingRepository } from '../billing/types';
import { usePublicQuery } from '../marketplace/usePublicQuery';
import { AdminSubscriptionsPanel } from '../subscriptions/SubscriptionViews';
import { SandboxFinancePanel } from '../billing/BillingViews';
import { OneoffPanel } from './OneoffPanel';
import type { OneoffApi } from './OneoffPanel';
import { MonetizationPanel } from './MonetizationPanel';
import { monetizationRepository } from './monetization';
import type { MonetizationRepository } from './monetization';

export const FinanceSources = createContext<{policy?:MonetizationRepository;oneoff?:OneoffApi}>({});
const tabs = [
  ['overview', 'Visão financeira', CircleDollarSign],
  ['subscriptions', 'Assinaturas', CreditCard],
  ['payments', 'Pagamentos', ReceiptText],
  ['tests', 'Testes Asaas', FlaskConical],
  ['settings', 'Configurações de cobrança', Settings2],
] as const;
export type FinanceTab = typeof tabs[number][0];
const unavailable = 'Indisponível';
const money = (value?: number | null) => value == null ? unavailable : (value / 100).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('pt-BR') : unavailable;
const method = (value?: string) => value === 'PIX' ? 'Pix' : value === 'CREDIT_CARD' ? 'Cartão de crédito' : unavailable;
const statusNames: Record<string,string> = {active:'Ativa',pending:'Pendente',overdue:'Vencido',cancelled:'Cancelado',refunded:'Estornado',uncertain:'Conciliação necessária',CONFIRMED:'Confirmado',RECEIVED:'Recebido',PENDING:'Pendente',OVERDUE:'Vencido',REFUNDED:'Estornado'};
function Table({label,headers,rows}:{label:string;headers:string[];rows:React.ReactNode[][]}) {
  return <div className="admin-table-scroll" role="region" aria-label={label} tabIndex={0}>
    <table><caption>{label}</caption><thead><tr>{headers.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.length ? rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length}>Nenhum registro retornado pela fonte consultada.</td></tr>}</tbody></table>
  </div>;
}
export function FinanceArea({initialTab,revision=0,policyRepository:policyOverride,billingRepository,oneoffRepository}:{initialTab?:FinanceTab;revision?:number;policyRepository?:MonetizationRepository;billingRepository?:SandboxBillingRepository|null;oneoffRepository?:OneoffApi}) {
  const sources=useContext(FinanceSources),policyRepository=policyOverride??sources.policy??monetizationRepository;
  const contextBilling=useBilling(), billing=billingRepository===undefined?contextBilling:billingRepository;
  const [params,setParams]=useSearchParams();
  const requested=params.get('tab');
  const tab=initialTab ?? (tabs.some(([id])=>id===requested)?requested as FinanceTab:'overview');
  const [environment,setEnvironment]=useState<'production'|'sandbox'>('production');
  const load=useCallback(async(signal:AbortSignal)=>{
    if(environment==='sandbox') {
      if(!billing?.available) throw new Error('SANDBOX_DISABLED');
      return {sandbox:await billing.admin(signal),policy:null};
    }
    return {policy:await policyRepository.status(signal),sandbox:null};
  },[environment,billing,policyRepository]);
  const state=usePublicQuery(`finance:${environment}:${revision}`,load);
  const snapshot=state.error?undefined:state.data;
  const sandbox=snapshot?.sandbox;
  const summary=sandbox?.summary;
  const metrics: [string,string|number][]=[
    ['Receita bruta confirmada',environment==='sandbox'?(sandbox ? money(sandbox.payments.filter(p=>p.settled).reduce((sum,p)=>sum+p.amountCents,0)) : unavailable):unavailable],
    ['Receita líquida após taxas',unavailable],['Taxas do Asaas',unavailable],
    ['Assinaturas ativas',summary?.active??unavailable],['Pagamentos confirmados',summary?.confirmedPayments??unavailable],
    ['Pagamentos pendentes',sandbox ? sandbox.payments.filter(p=>p.status==='PENDING').length : unavailable],['Pagamentos vencidos',sandbox ? sandbox.payments.filter(p=>p.status==='OVERDUE').length : unavailable],
    ['Assinaturas canceladas',summary?.cancelled??unavailable],['Divergências de conciliação',unavailable],
  ];
  function navigate(next:FinanceTab){setParams({sec:'finance',tab:next});}
  return <section className="admin-finance" aria-label="Financeiro">
    <nav className="finance-tabs" aria-label="Áreas do Financeiro">{tabs.map(([id,label,Icon])=><button key={id} aria-current={id===tab?'page':undefined} className={id===tab?'is-active':''} onClick={()=>navigate(id)}><Icon size={17} aria-hidden="true"/>{label}</button>)}</nav>
    {tab!=='tests' && tab!=='settings' && <div className="finance-toolbar"><label>Ambiente financeiro<select value={environment} onChange={e=>setEnvironment(e.target.value as typeof environment)}><option value="production">Production</option><option value="sandbox">Sandbox</option></select></label><span className={`environment-badge environment-badge--${environment}`}>{environment==='production'?'Production · dados reais':'Sandbox · dados de teste'}</span></div>}
    {tab!=='tests' && tab!=='settings' && <>
      {state.loading&&<p role="status">Consultando fontes financeiras…</p>}
      {state.error&&<div className="finance-notice" role="status">Fonte indisponível neste ambiente. Nenhum valor foi estimado. <button className="text-link" onClick={state.retry}>Tentar novamente</button></div>}
      <p className="admin-source">{environment==='production'?'Fonte: política administrativa. Ela informa totais de registros, mas não disponibiliza receita, taxas nem detalhes de contratos e pagamentos.':'Fonte: conciliação Sandbox. Valores de teste não são receita real. Ausência de registros não comprova homologação.'}</p>
    </>}
    {tab==='overview' && <>
      <div className="finance-metrics">{metrics.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong>{environment==='sandbox'&&<small>Exclusivamente Sandbox</small>}</div>)}</div>
      {snapshot?.policy&&<div className="finance-notice"><strong>Registros Production</strong><p>{snapshot.policy.subscriptions} assinaturas registradas · {snapshot.policy.productionReconciledPayments} pagamentos armazenados · {snapshot.policy.pendingPayments} pagamentos pendentes ou vencidos conciliados.</p><p>Estes totais não medem consultas à API, contratos ativos ou receita recebida.</p></div>}
      {summary&&<p className="admin-source">Eventos aguardando processamento: {summary.eventsPending}. Fila pendente não é contagem de divergências. Receita bruta não desconta estornos; líquido e taxas não são inferidos.</p>}
      <div className="finance-notice"><strong>Plataforma gratuita por tempo indeterminado</strong><p>Checkout e exigência de assinatura continuam desligados. Nenhum indicador ou navegação habilita cobranças.</p></div>
    </>}
    {tab==='subscriptions'&&<>
      <h3>Contratos e recorrência</h3><p>Referência para novas contratações futuras: R$ 19,90/mês por negócio. Contratos históricos mantêm o valor e o consentimento originais.</p>
      {environment==='production'&&<p className="finance-notice">Detalhamento de contratos Production: Indisponível na API atual. A quantidade de negócios gratuitos não representa assinaturas pagas.</p>}
      <Table label="Contratos financeiros" headers={['Profissional ou empresa','Negócio','Plano','Valor mensal contratado','Contratação','Próxima cobrança','Método','Status','Histórico de pagamentos']} rows={(sandbox?.contracts??[]).map(c=>[unavailable,c.businessId,'Teste Sandbox',money(c.amountCents),date(c.createdAt),unavailable,method(c.method),statusNames[c.state]??c.state,<span>{sandbox?.payments.filter(p=>p.requestId===c.requestId).length??0} registros nesta consulta</span>])}/>
      <p className="field-help">Próxima cobrança não é inferida do primeiro vencimento. Histórico completo exige fonte própria.</p>
      {environment==='production'&&<details className="finance-details"><summary>Gratuidade e isenções por negócio</summary><AdminSubscriptionsPanel revision={revision}/></details>}
    </>}
    {tab==='payments'&&<>
      <h3>Pagamentos e conciliação</h3><p>Uma cobrança gerada não significa pagamento recebido. Os testes avulsos permanecem separados em Testes Asaas.</p>
      {environment==='production'&&<p className="finance-notice">Detalhamento de pagamentos Production: Indisponível na API atual. Nenhum registro foi convertido em receita por esta interface.</p>}
      <Table label="Pagamentos conciliados" headers={['Cobrança Asaas','Negócio','Bruto','Taxas','Líquido','Vencimento','Confirmação','Método','Status','Webhook','Conciliação']} rows={(sandbox?.payments??[]).map(p=>{const c=sandbox?.contracts.find(c=>c.requestId===p.requestId);return [p.paymentId,c?.businessId??unavailable,money(p.amountCents),unavailable,unavailable,date(p.dueDate),unavailable,method(c?.method),p.settled && ['CONFIRMED','RECEIVED'].includes(p.status)?'Confirmado no Sandbox':statusNames[p.status]??p.status,unavailable,p.settled && ['CONFIRMED','RECEIVED'].includes(p.status)?'Conciliado pela API':'Sem confirmação de recebimento'];})}/>
      <p className="field-help">A API atual não fornece taxas, líquido, data de confirmação ou entrega de webhook por pagamento. A data de atualização não substitui a confirmação.</p>
    </>}
    {tab==='tests'&&<><OneoffPanel repository={oneoffRepository??sources.oneoff}/>{billing?.available&&<details className="finance-details"><summary>Contratos recorrentes históricos · Sandbox</summary><SandboxFinancePanel/></details>}</>}
    {tab==='settings'&&<MonetizationPanel repository={policyRepository}/>}
  </section>;
}
