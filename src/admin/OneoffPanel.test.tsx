import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { describe,it,expect,vi } from 'vitest';
import { OneoffPanel } from './OneoffPanel';
const id='00000000-0000-4000-8000-000000000981';
const state={environment:'production',enabledUntil:null,maxTotalCents:3980,maxPerMethod:1,sandboxReady:false,eventsPending:0,eventsIgnored:0,lastEventReceivedAt:null,items:[]};
describe('isolated oneoff admin panel',()=>{
 it('shows disabled production and cannot enable or authorize automatically',async()=>{
  const repo={call:vi.fn(async()=>({data:state,writeEnabled:false}))};render(<OneoffPanel repository={repo}/>);
  expect(await screen.findByText(/Production — dinheiro real/)).toBeVisible();
  expect(screen.getByText('Abrir janela por uma hora')).toBeDisabled();expect(screen.getByLabelText(/ID do pagador/)).toBeDisabled();
  expect(repo.call).toHaveBeenCalledExactlyOnceWith({action:'status'});
 });
 it('cancels creation without a server mutation; shows missing net as unavailable',async()=>{
  const repo={call:vi.fn(async()=>({data:{...state,environment:'sandbox',enabledUntil:'2099-01-01T00:00:00Z',items:[{id,environment:'sandbox',method:'PIX',state:'authorized',checkout_id:null,payment_id:null,amount_cents:1990,net_cents:null,refunded_cents:0,diagnostic:null,provider_status:null}]},writeEnabled:true}))};
  render(<OneoffPanel repository={repo}/>);fireEvent.click(await screen.findByText('Revisar criação do checkout'));
  expect(screen.getByText('Criar somente este checkout avulso')).toBeDisabled();fireEvent.click(screen.getByText('Cancelar sem criar'));
  expect(repo.call).toHaveBeenCalledExactlyOnceWith({action:'status'});expect(screen.getAllByText('Indisponível')).toHaveLength(3);
 });
 it('requires a separate creation confirmation and sends the stable request identifier',async()=>{
  const data={...state,environment:'sandbox',enabledUntil:'2099-01-01T00:00:00Z',items:[{id,environment:'sandbox',method:'CREDIT_CARD',state:'authorized',checkout_id:null,payment_id:null,amount_cents:1990,net_cents:null,refunded_cents:0,diagnostic:null,provider_status:null}]};
  const repo={call:vi.fn(async()=>({data,writeEnabled:true}))};render(<OneoffPanel repository={repo}/>);
  fireEvent.click(await screen.findByText('Revisar criação do checkout'));fireEvent.click(screen.getByLabelText('Confirmo a criação deste checkout e o consentimento do pagador.'));
  fireEvent.click(screen.getByText('Criar somente este checkout avulso'));
  await waitFor(()=>expect(repo.call).toHaveBeenCalledWith({action:'create',environment:'sandbox',requestId:id,confirmation:'CRIAR CHECKOUT AVULSO 19,90'}));
 });
 it('does not fabricate zero counters when setup is unavailable',async()=>{
  render(<OneoffPanel repository={{call:vi.fn(async()=>{throw Error('SETUP_REQUIRED');})}}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Aguarda migração');expect(screen.queryByText('Nenhuma operação registrada neste ambiente.')).not.toBeInTheDocument();
 });
});
