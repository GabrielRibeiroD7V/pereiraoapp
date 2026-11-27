// @vitest-environment node
import { describe,it,expect,vi } from 'vitest';
import { OneoffProvider,OneoffService,oneoffConfig,oneoffSnapshot,checkoutUrl,createOneoffHandler,createOneoffWebhook } from './oneoff-billing';
import type { OneoffRequest,OneoffStore } from './oneoff-billing';
import { adminClient } from './admin-handler';
const id='00000000-0000-4000-8000-000000000981',checkout='00000000-0000-4000-8000-000000000982',actor='00000000-0000-4000-8000-000000000983';
const env={VERCEL_ENV:'preview',VITE_SUPABASE_URL:'https://yazdjiwaksamizrbqewq.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',ASSAS_API_KEY_SANDBOX:'$aact_hmlg_fixture',BILLING_RPC_SIGNING_SECRET:'S'.repeat(64),ASAAS_SANDBOX_WEBHOOK_TOKEN:'T'.repeat(64),ASAAS_ADMIN_ONEOFF_SANDBOX_ENABLED:'true',ASAAS_ADMIN_ONEOFF_WEBHOOK_ENABLED:'true'};
const operation=(method:'PIX'|'CREDIT_CARD'='PIX'):OneoffRequest=>({id,environment:'sandbox',method,customer_id:'cus_consent',state:'pending',checkout_id:checkout,payment_id:null,amount_cents:1990,currency:'BRL',net_cents:null,refunded_cents:0,diagnostic:null,provider_status:null,consent_at:'2026-11-27T12:00:00Z',created_at:'2026-11-27T12:00:00Z'});
const payment=()=>({id:'pay_fixture',customer:'cus_consent',checkoutSession:checkout,externalReference:id,billingType:'PIX',value:19.90,netValue:19.40,status:'RECEIVED',subscription:null,installment:null});
const request=(body:unknown,headers:Record<string,string>={Authorization:'Bearer fixture'})=>new Request('https://preview.example/api/admin-oneoff-billing',{method:'POST',headers,body:JSON.stringify(body)});
function fixture(){
 const client={auth:{getUser:vi.fn(async()=>({data:{user:{id:actor,email_confirmed_at:'2026-11-27'}},error:null}))},rpc:vi.fn(async()=>({data:true,error:null}))};
 const store={call:vi.fn(async(command:string):Promise<unknown>=>command==='status'?{items:[]}:command==='enqueue'?{duplicate:false,requestId:id}:command==='claim'?{request:operation(),lease:id}:{ok:true})};
 const provider={create:vi.fn(async()=>checkout),payments:vi.fn(async()=>[payment()])};
 const service=new OneoffService(store as OneoffStore,provider as unknown as OneoffProvider);
 const factory=vi.fn(()=>service),clientFactory=vi.fn(()=>client as unknown as ReturnType<typeof adminClient>);
 return {client,store,provider,service,factory,clientFactory};
}
describe('oneoff provider, fixed amount and isolation',()=>{
 it.each(['PIX','CREDIT_CARD'] as const)('requests only hosted DETACHED %s, no subscription/card fields',async method=>{
  const fetcher=vi.fn<typeof fetch>(async(_url,options)=>Response.json(options?.method==='POST'?{id:checkout}:{id:'cus_consent'}));
  const provider=new OneoffProvider(env,'sandbox',fetcher);
  expect(await provider.create(operation(method),'https://preview.example/admin?sec=oneoff')).toBe(checkout);
  const calls=fetcher.mock.calls;expect(calls).toHaveLength(2);
  expect(calls[1]?.[0]).toBe('https://api-sandbox.asaas.com/v3/checkouts');
  const init=calls[1]?.[1];expect(init?.redirect).toBe('error');
  const body=JSON.parse(String(init?.body));expect(body).toMatchObject({customer:'cus_consent',billingTypes:[method],chargeTypes:['DETACHED'],items:[{quantity:1,value:19.90}],externalReference:id});
  expect(body).not.toHaveProperty('subscription');expect(body).not.toHaveProperty('installment');expect(JSON.stringify(body)).not.toMatch(/creditCard|cvv|ccv|holderName|cardToken/);
 });
 it('rejects production writes without new independent flag even with valid key',async()=>{
  const fetcher=vi.fn<typeof fetch>();const production={...env,VERCEL_ENV:'production',ASAAS_API_KEY_PRODUCTION:'$aact_prod_fixture',BILLING_PRODUCTION_RPC_SIGNING_SECRET:'P'.repeat(64)};
  expect(oneoffConfig(production,'production').writeEnabled).toBe(false);
  await expect(new OneoffProvider(production,'production',fetcher).create(operation(),'https://pereirao.vercel.app/admin')).rejects.toThrow();
  // GET customer may be attempted; no successful preflight can reach POST when disabled.
  expect(fetcher.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
 });
 it('rejects wrong environment/key and any general financial flag',()=>{
  expect(()=>oneoffConfig(env,'production')).toThrow('DISABLED');
  expect(()=>oneoffConfig({...env,ASSAS_API_KEY_SANDBOX:'$aact_prod_wrong'},'sandbox')).toThrow('SETUP_REQUIRED');
  expect(()=>oneoffConfig({...env,VERCEL_ENV:'production',ASAAS_PRODUCTION_CHARGES_ENABLED:'true'},'production')).toThrow('DISABLED');
 });
 it('does not allow arbitrary paths, amounts, callbacks or hidden writes',async()=>{
  const fetcher=vi.fn<typeof fetch>(),p=new OneoffProvider(env,'sandbox',fetcher);
  await expect(p.call('/subscriptions',{})).rejects.toThrow();
  await expect(p.call('/customers/cus_fixture',{})).rejects.toThrow();
  await expect(p.create({...operation(),amount_cents:1999 as 1990},'https://preview.example/admin')).rejects.toThrow();
  await expect(p.create(operation(),'http://preview.example/admin')).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
 });
 it.each([true,undefined])('refuses ambiguous/incomplete payment listings (%s)',async hasMore=>{
  const p=new OneoffProvider(env,'sandbox',async()=>Response.json({data:[payment()],totalCount:1,hasMore}));
  await expect(p.payments(operation())).rejects.toThrow('MISMATCH');
 });
 it('uses documented checkout links with fixed origins',()=>{
  expect(checkoutUrl('production',checkout)).toBe('https://asaas.com/checkoutSession/show?id='+checkout);
  expect(checkoutUrl('sandbox',checkout)).toContain('https://sandbox.asaas.com/');expect(()=>checkoutUrl('sandbox','https://evil.example')).toThrow();
 });
});
describe('authoritative snapshot, no secrets/raw provider payload persisted',()=>{
 it('projects amount, method, payer and actual net; absent net remains unavailable',()=>{
  expect(oneoffSnapshot({...payment(),creditCard:{creditCardToken:'never-persist',number:'not-persisted'}},operation())).toMatchObject({amountCents:1990,netCents:1940,status:'RECEIVED',currency:'BRL'});
  expect(JSON.stringify(oneoffSnapshot(payment(),operation()))).not.toMatch(/cardToken|creditCard|number/);
  expect(oneoffSnapshot({...payment(),netValue:undefined},operation()).netCents).toBeNull();
 });
 it.each([
  {value:19.99},{value:'19.90'},{value:NaN},{value:Infinity},{customer:'cus_other'},
  {billingType:'BOLETO'},{billingType:'CREDIT_CARD'},{checkoutSession:'00000000-0000-4000-8000-000000000999'},
  {currency:'USD'},{subscription:'sub_wrong'},{installment:'ins_wrong'},{externalReference:actor},{status:'INVENTED'},{netValue:20},
 ])('rejects mismatch %j',change=>expect(()=>oneoffSnapshot({...payment(),...change},operation())).toThrow('MISMATCH'));
 it('unknown checkout recovery requires exact external reference as well as payer/value',()=>{
  expect(oneoffSnapshot(payment(),{...operation(),checkout_id:null}).checkoutId).toBe(checkout);
  expect(()=>oneoffSnapshot({...payment(),externalReference:null},{...operation(),checkout_id:null})).toThrow('MISMATCH');
 });
 it.each(['PENDING','OVERDUE','CREDIT_CARD_CAPTURE_REFUSED','DELETED','CHARGEBACK_REQUESTED'])('keeps actual non-paid status %s',status=>expect(oneoffSnapshot({...payment(),status},operation()).status).toBe(status));
 it('handles confirmed and partial refunds without inventing refund cashflow',()=>{
  expect(oneoffSnapshot({...payment(),status:'REFUNDED'},operation()).refundedCents).toBe(1990);
  expect(oneoffSnapshot({...payment(),status:'PARTIALLY_REFUNDED',refunds:[{status:'DONE',value:5},{status:'PENDING',value:2}]},operation()).refundedCents).toBe(500);
  expect(()=>oneoffSnapshot({...payment(),status:'PARTIALLY_REFUNDED'},operation())).toThrow();
 });
});
describe('idempotency, uncertain writes and recoverable reconciliation',()=>{
 it('does not POST again when database says request already claimed',async()=>{
  const f=fixture();f.store.call.mockResolvedValue({create:false,request:{...operation(),state:'uncertain'}});
  await f.service.create(actor,id,'CRIAR CHECKOUT AVULSO 19,90','https://preview.example/admin');expect(f.provider.create).not.toHaveBeenCalled();
 });
 it('persists uncertainty on timeout; no automatic second creation',async()=>{
  const f=fixture();f.store.call.mockResolvedValueOnce({create:true,request:operation()});f.provider.create.mockRejectedValue(Error('private-provider-detail'));
  await expect(f.service.create(actor,id,'CRIAR CHECKOUT AVULSO 19,90','https://preview.example/admin')).rejects.toThrow('RECONCILIATION_REQUIRED');
  expect(f.provider.create).toHaveBeenCalledTimes(1);expect(f.store.call).toHaveBeenLastCalledWith('uncertain',{requestId:id});
 });
 it('records mismatch and preserves prior payment, rather than inventing paid/zero',async()=>{
  const f=fixture();f.provider.payments.mockResolvedValue([{...payment(),value:1}]);
  await expect(f.service.reconcile(actor,id)).rejects.toThrow('MISMATCH');
  expect(f.store.call).toHaveBeenCalledWith('reconciliation_failed',{requestId:id,lease:id,diagnostic:'mismatch'});
  expect(f.store.call.mock.calls.some(([c])=>c==='snapshot')).toBe(false);
 });
 it('CHECKOUT_PAID or redirect alone is never sufficient proof',async()=>{
  const f=fixture();f.provider.payments.mockResolvedValue([]);await expect(f.service.reconcile(actor,id,'CHECKOUT_PAID')).rejects.toThrow();
  expect(f.store.call.mock.calls.some(([c])=>c==='snapshot')).toBe(false);
 });
 it('empty listing records only pending/expired lifecycle, not a paid result',async()=>{
  const f=fixture();f.provider.payments.mockResolvedValue([]);await f.service.reconcile(actor,id,'CHECKOUT_EXPIRED');
  expect(f.store.call).toHaveBeenCalledWith('observe_checkout',{requestId:id,lease:id,state:'expired'});
 });
});
describe('admin API authentication and disabled Production boundary',()=>{
 it('rejects no session, ordinary account and unconfirmed account before financial service',async()=>{
  const f=fixture(),handler=createOneoffHandler(env,f.factory,f.clientFactory);
  expect((await handler(request({action:'status'},{}))).status).toBe(401);
  f.client.rpc.mockResolvedValue({data:false,error:null});expect((await handler(request({action:'status'}))).status).toBe(403);
  f.client.auth.getUser.mockResolvedValue({data:{user:{id:actor,email_confirmed_at:''}},error:null});expect((await handler(request({action:'status'}))).status).toBe(401);expect(f.factory).not.toHaveBeenCalled();
 });
 it('rejects cross-origin requests and card fields',async()=>{
  const f=fixture(),handler=createOneoffHandler(env,f.factory,f.clientFactory);
  expect((await handler(request({action:'status'},{Authorization:'Bearer fixture',Origin:'https://evil.example'}))).status).toBe(403);
  expect((await handler(request({action:'status',creditCard:{number:'blocked'}}))).status).toBe(400);expect(f.store.call).not.toHaveBeenCalled();
 });
 it('status is no-store and does not call Asaas',async()=>{
  const f=fixture(),r=await createOneoffHandler(env,f.factory,f.clientFactory)(request({action:'status'}));expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('private, no-store');expect(f.provider.create).not.toHaveBeenCalled();expect(f.provider.payments).not.toHaveBeenCalled();
 });
 it('cannot enable/create Production with flag off',async()=>{
  const f=fixture(),production={...env,VERCEL_ENV:'production',ASAAS_API_KEY_PRODUCTION:'$aact_prod_fixture',BILLING_PRODUCTION_RPC_SIGNING_SECRET:'P'.repeat(64)},handler=createOneoffHandler(production,f.factory,f.clientFactory);
  expect((await handler(request({action:'configure',enabled:true}))).status).toBe(403);
  expect((await handler(request({action:'create',requestId:id,confirmation:'CRIAR CHECKOUT AVULSO 19,90'}))).status).toBe(403);expect(f.store.call).not.toHaveBeenCalled();
 });
});
describe('webhook authentication and durable ACK',()=>{
 const notice={id:'evt_fixture',event:'CHECKOUT_PAID',checkout:{id:checkout,externalReference:id}};
 const hookRequest=(headers:Record<string,string>={},body:unknown=notice)=>request(body,{'content-type':'application/json','asaas-access-token':env.ASAAS_SANDBOX_WEBHOOK_TOKEN,...headers});
 it('disabled webhook and incorrect token do not persist or defer',async()=>{
  const f=fixture(),defer=vi.fn();expect((await createOneoffWebhook({...env,ASAAS_ADMIN_ONEOFF_WEBHOOK_ENABLED:'false'},defer,f.factory)(hookRequest())).status).toBe(403);
  expect((await createOneoffWebhook(env,defer,f.factory)(hookRequest({'asaas-access-token':'wrong'}))).status).toBe(401);expect(f.factory).not.toHaveBeenCalled();expect(defer).not.toHaveBeenCalled();
 });
 it('does not ACK persistence failure',async()=>{
  const f=fixture(),defer=vi.fn();f.store.call.mockRejectedValue(Error('database unavailable'));
  expect((await createOneoffWebhook(env,defer,f.factory)(hookRequest())).status).toBe(503);expect(defer).not.toHaveBeenCalled();
 });
 it('ACKs only after enqueue; strips raw payload and unrelated events cannot acquire rights',async()=>{
  const f=fixture(),defer=vi.fn();f.store.call.mockResolvedValue({duplicate:false,requestId:null});
  const r=await createOneoffWebhook(env,defer,f.factory)(hookRequest({}, {...notice,privateData:'not-stored'}));
  expect(r.status).toBe(200);expect(f.store.call).toHaveBeenCalledExactlyOnceWith('enqueue',{eventId:'evt_fixture',eventType:'CHECKOUT_PAID',objectId:checkout,checkoutId:checkout,reference:id});expect(defer).not.toHaveBeenCalled();
 });
});


describe('transport rejects recurring payload even inside server code',()=>{
 it('does not send RECURRENT or subscription through the generic transport',async()=>{
  const fetcher=vi.fn<typeof fetch>(),p=new OneoffProvider(env,'sandbox',fetcher);
  await expect(p.call('/checkouts',{customer:'cus_consent',billingTypes:['CREDIT_CARD'],chargeTypes:['RECURRENT'],subscription:{cycle:'MONTHLY'},externalReference:id,items:[{value:19.90,quantity:1}]})).rejects.toThrow('INVALID_INPUT');
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('known payment is re-read even if deleted payments disappear from listing',async()=>{
  const fetcher=vi.fn<typeof fetch>(async url=>Response.json(String(url).includes('?')?{data:[],totalCount:0,hasMore:false}:{...payment(),status:'DELETED'}));
  const result=await new OneoffProvider(env,'sandbox',fetcher).payments({...operation(),payment_id:'pay_fixture'});
  expect(result[0]?.status).toBe('DELETED');expect(fetcher.mock.calls[1]?.[0]).toBe('https://api-sandbox.asaas.com/v3/payments/pay_fixture');
 });
 it('matched webhook only defers processing after durable enqueue completes',async()=>{
  const f=fixture(),process=vi.spyOn(f.service,'event').mockResolvedValue(),defer=vi.fn();let persisted=false;
  f.store.call.mockImplementation(async()=>{persisted=true;return {duplicate:false,requestId:id};});
  defer.mockImplementation(()=>expect(persisted).toBe(true));
  const hook=createOneoffWebhook(env,defer,f.factory);
  const response=await hook(request({id:'evt_success',event:'CHECKOUT_PAID',checkout:{id:checkout,externalReference:id}},{'content-type':'application/json','asaas-access-token':env.ASAAS_SANDBOX_WEBHOOK_TOKEN}));
  expect(response.status).toBe(200);expect(process).toHaveBeenCalledExactlyOnceWith('evt_success');expect(defer).toHaveBeenCalledTimes(1);
 });
});


it('admin create responses strip internal leases, actor and payer identifiers',async()=>{
 const f=fixture();f.store.call.mockResolvedValue({create:false,request:{...operation(),lease:'internal-lease',actor_id:actor,customer_id:'cus_consent'}});
 const response=await createOneoffHandler(env,f.factory,f.clientFactory)(request({action:'create',requestId:id,confirmation:'CRIAR CHECKOUT AVULSO 19,90'}));
 expect(response.status).toBe(200);const result=await response.json();expect(result.data.id).toBe(id);
 expect(result.data).not.toHaveProperty('lease');expect(result.data).not.toHaveProperty('actor_id');expect(result.data).not.toHaveProperty('customer_id');
});
