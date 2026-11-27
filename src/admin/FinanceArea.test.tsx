import {render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {describe,it,expect,vi} from 'vitest';
import {FinanceArea} from './FinanceArea';
import type {MonetizationStatus} from './monetization';
import type {SandboxBillingRepository} from '../billing/types';
const status:MonetizationStatus={monthlyCents:1990,initialFree:true,newContractsEnabled:false,contractingReady:false,revision:0,checkoutEnabled:false,enforcementEnabled:false,automaticConversion:false,subscriptions:0,productionBindings:0,pendingPayments:0,sandboxContracts:1,productionReconciledPayments:0};
const policy={status:vi.fn(async()=>status),set:vi.fn(async()=>status)};
function setup(initial='/admin?sec=finance',billing?:SandboxBillingRepository){return render(<MemoryRouter initialEntries={[initial]}><FinanceArea policyRepository={policy} billingRepository={billing??null}/></MemoryRouter>);}
describe('Financeiro: fontes, ambientes e navegação sem ativação',()=>{
 it('keeps unavailable revenue distinct from real zero stored records',async()=>{
  setup();expect(await screen.findByText(/0 assinaturas registradas/)).toBeVisible();
  expect(screen.getAllByText('Indisponível')).toHaveLength(9);expect(screen.queryByText('R$ 0,00')).not.toBeInTheDocument();
  expect(policy.set).not.toHaveBeenCalled();expect(screen.getByText(/não medem consultas à API/)).toBeVisible();
 });
 it('navigates through the five finance destinations without invoking creation',async()=>{
  setup();fireEvent.click(screen.getByRole('button',{name:'Assinaturas'}));
  expect(await screen.findByRole('table',{name:'Contratos financeiros'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Pagamentos'}));expect(screen.getByRole('table',{name:'Pagamentos conciliados'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Configurações de cobrança'}));expect(await screen.findByText('Plataforma gratuita, sem prazo')).toBeVisible();
  expect(policy.set).not.toHaveBeenCalled();
 });
 it('does not present contract-pending counts as pending payments or reprice legacy contracts',async()=>{
  const billing={available:true,admin:vi.fn(async()=>({environment:'sandbox',realRevenueAvailable:false,contracts:[{requestId:'a',businessId:'local',amountCents:1999,method:'CREDIT_CARD',state:'active',createdAt:'2026-11-20',firstDueDate:'2026-11-21',checkoutUrl:null}],payments:[{paymentId:'p',requestId:'a',amountCents:1999,refundedCents:0,status:'PENDING',settled:false,dueDate:'2026-11-21',updatedAt:'2026-11-21'}],summary:{testContracts:1,active:1,pending:99,overdue:99,cancelled:0,refunded:0,confirmedPayments:0,receivedCents:0,eventsPending:8}}))} as unknown as SandboxBillingRepository;
  setup(undefined,billing);fireEvent.change(screen.getByLabelText('Ambiente financeiro'),{target:{value:'sandbox'}});
  await waitFor(()=>expect(billing.admin).toHaveBeenCalled());
  await waitFor(()=>expect(screen.getByText('Pagamentos pendentes').parentElement).toHaveTextContent('1'));
  expect(screen.queryByText('99')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Assinaturas'}));
  expect(within(screen.getByRole('table')).getByText(/19,99/)).toBeVisible();
  fireEvent.change(screen.getByLabelText('Ambiente financeiro'),{target:{value:'production'}});
  expect(screen.queryByText(/19,99/)).not.toBeInTheDocument();
 });
 it('reports missing source without manufacturing healthy metrics',async()=>{
  render(<MemoryRouter><FinanceArea policyRepository={{...policy,status:async()=>{throw Error('SETUP_REQUIRED');}}}/></MemoryRouter>);
  expect(await screen.findByText(/Fonte indisponível/)).toBeVisible();expect(screen.queryByText(/0 assinaturas registradas/)).not.toBeInTheDocument();
 });
});
