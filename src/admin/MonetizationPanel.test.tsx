import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { describe,it,expect,vi } from 'vitest';
import { MonetizationPanel } from './MonetizationPanel';
import type { MonetizationStatus } from './monetization';
const state:MonetizationStatus={monthlyCents:1990,newContractsEnabled:false,contractingReady:false,initialFree:true,revision:0,checkoutEnabled:false,enforcementEnabled:false,automaticConversion:false,subscriptions:0,productionBindings:0,pendingPayments:0,sandboxContracts:1,productionReconciledPayments:0};
describe('admin monetization preparation',()=>{
 it('shows real zero counters separately from sandbox and blocks premature enablement',async()=>{
  const repo={status:vi.fn(async()=>state),set:vi.fn()};render(<MonetizationPanel repository={repo}/>);
  expect(await screen.findByText('Plataforma gratuita, sem prazo')).toBeVisible();
  expect(screen.getByText(/19,90/)).toBeVisible();
  fireEvent.click(screen.getByText('Revisar habilitação de contratações'));
  fireEvent.change(screen.getByLabelText('Justificativa'),{target:{value:'Confirmacao de teste'}});
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByText('Confirmar alteração')).toBeDisabled();expect(repo.set).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Cancelar'));expect(repo.set).not.toHaveBeenCalled();
 });
 it('requires reason and confirmation to disable, passes concurrency revision and does not cancel contracts',async()=>{
  const repo={status:vi.fn(async()=>({...state,newContractsEnabled:true,revision:8,subscriptions:2})),set:vi.fn(async()=>state)};
  render(<MonetizationPanel repository={repo}/>);fireEvent.click(await screen.findByText('Desativar novas contratações'));
  expect(screen.getByText('Confirmar alteração')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Justificativa'),{target:{value:'Contencao consentida'}});fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByText('Confirmar alteração'));
  await waitFor(()=>expect(repo.set).toHaveBeenCalledExactlyOnceWith(false,8,'Contencao consentida'));
 });
 it('does not invent integration state on failure',async()=>{
  render(<MonetizationPanel repository={{status:vi.fn(async()=>{throw {code:'SETUP_REQUIRED'};}),set:vi.fn()}}/>);
  expect(await screen.findByRole('alert')).toBeVisible();expect(screen.queryByText('Plataforma gratuita, sem prazo')).not.toBeInTheDocument();
 });
});
