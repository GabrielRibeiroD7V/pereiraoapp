// @vitest-environment node
import { describe,it,expect,vi } from 'vitest';
import { OneoffProvider,OneoffService,oneoffConfig,oneoffSnapshot,checkoutUrl,createOneoffHandler,createOneoffWebhook } from './oneoff-billing';
import type { OneoffRequest,OneoffStore } from './oneoff-billing';
import { adminClient } from './admin-handler';
const id='00000000-0000-4000-8000-000000000981',checkout='00000000-0000-4000-8000-000000000982',actor='00000000-0000-4000-8000-000000000983';
const env={VERCEL_ENV:'preview',VITE_SUPABASE_URL:'https://yazdjiwaksamizrbqewq.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',ASSAS_API_KEY_SANDBOX:'$aact_hmlg_fixture',BILLING_RPC_SIGNING_SECRET:'S'.repeat(64),ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN:'T'.repeat(64),ASAAS_ADMIN_ONEOFF_SANDBOX_ENABLED:'true',ASAAS_ADMIN_ONEOFF_WEBHOOK_ENABLED:'true'};
const operation=(method:'PIX'|'CREDIT_CARD'='PIX'):OneoffRequest=>({id,environment:'sandbox',method,customer_id:'cus_consent',state:'pending',checkout_id:checkout,payment_id:null,amount_cents:1990,currency:'BRL',net_cents:null,refunded_cents:0,diagnostic:null,provider_status:null,consent_at:'2026-11-27T12:00:00Z',created_at:'2026-11-27T12:00:00Z'});
const payer=()=>({id:'cus_consent',phone:'4730000000',address:'Rua de teste',addressNumber:'1',postalCode:'01310000',province:'Bairro de teste',city:15873,notificationDisabled:true});
const payment=()=>({id:'pay_fixture',customer:'cus_consent',checkoutSession:checkout,externalReference:id,billingType:'PIX',value:19.90,netValue:19.40,status:'RECEIVED',subscription:null,installment:null});
describe('Sandbox Preview token compatibility with the direct inbox',()=>{
 const token='fixture:Sandbox+'.repeat(3);
 it('normalizes only outer ASCII whitespace in the configured Sandbox token',()=>{
  const cfg=oneoffConfig({...env,ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN:' \t\r\n'+token+'\r\n '},'sandbox');
  expect(cfg.token).toBe(token);expect(cfg.writeEnabled).toBe(true);expect(cfg.webhookEnabled).toBe(true);
 });
 it('keeps the gate valid for the documented 255-character visible ASCII token',()=>{
  expect(oneoffConfig({...env,ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN:'+'.repeat(255)},'sandbox').webhookEnabled).toBe(true);
 });
 it('reports write availability to a legitimate admin without creating any operation',async()=>{
  const f=fixture();
  const handler=createOneoffHandler({...env,ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN:'\r\n'+token+'\n'},f.factory,f.clientFactory);
  const response=await handler(request({action:'status'}));
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({writeEnabled:true});
  expect(f.store.call).toHaveBeenCalledTimes(1);expect(f.store.call).toHaveBeenCalledWith('status',{actorId:actor});
  expect(f.provider.create).not.toHaveBeenCalled();
 });
 it('reaches authentication and rejects a wrong token instead of returning DISABLED',async()=>{
  const f=fixture();
  const response=await createOneoffWebhook({...env,ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN:'\r\n'+token+'\n'},vi.fn(),f.factory)(
   new Request('https://preview.example/api/asaas-admin-oneoff-webhook',{method:'POST',headers:{'Content-Type':'application/json','asaas-access-token':'wrong-token'},body:'{}'}));
  expect(response.status).toBe(401);expect(await response.json()).toEqual({code:'AUTH_REQUIRED'});expect(f.store.call).not.toHaveBeenCalled();
 });
 it.each(['T'.repeat(31),'T'.repeat(256),'T'.repeat(32)+' inner','T'.repeat(32)+'\ninner','\u00a0'+'T'.repeat(40),'T'.repeat(32)+'\u007f'])('keeps invalid token formats disabled (%#)',value=>{
  expect(oneoffConfig({...env,ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN:value},'sandbox').webhookEnabled).toBe(false);
 });
 it.each(['ASAAS_ADMIN_ONEOFF_SANDBOX_ENABLED','ASAAS_ADMIN_ONEOFF_WEBHOOK_ENABLED'])('keeps an absent %s closed in admin status',async key=>{
  const f=fixture(),response=await createOneoffHandler({...env,[key]:undefined},f.factory,f.clientFactory)(request({action:'status'}));
  expect(await response.json()).toMatchObject({writeEnabled:false});expect(f.provider.create).not.toHaveBeenCalled();
 });
 it('compares the received token exactly and accepts valid authentication only before input validation',async()=>{
  const f=fixture(),handler=createOneoffWebhook({...env,ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN:'\r\n'+token+'\n'},vi.fn(),f.factory);
  const send=(header:string)=>handler(new Request('https://preview.example/api/asaas-admin-oneoff-webhook',{method:'POST',headers:{'Content-Type':'application/json','asaas-access-token':header},body:'{}'}));
  expect((await send(token+'x')).status).toBe(401);
  expect((await send(token)).status).toBe(400);expect(f.store.call).not.toHaveBeenCalled();
 });
 it('still rejects a normalized token equal to HMAC or legacy credentials',()=>{
  expect(()=>oneoffConfig({...env,ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN:'\n'+env.BILLING_RPC_SIGNING_SECRET+'\n'},'sandbox')).toThrow('SETUP_REQUIRED');
  expect(()=>oneoffConfig({...env,ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN:'\n'+token+'\n',ASAAS_SANDBOX_WEBHOOK_TOKEN:' '+token+' '},'sandbox')).toThrow('SETUP_REQUIRED');
 });
 it('does not normalize or widen Production token validation',()=>{
  const production={...env,VERCEL_ENV:'production',ASAAS_API_KEY_PRODUCTION:'$aact_prod_fixture',BILLING_PRODUCTION_RPC_SIGNING_SECRET:'P'.repeat(64)};
  for(const value of ['\n'+'V'.repeat(64)+'\n','+'.repeat(64),'V'.repeat(255)]){
   const cfg=oneoffConfig({...production,ASAAS_PRODUCTION_WEBHOOK_TOKEN:value},'production');
   expect(cfg.token).toBe(value);expect(cfg.webhookEnabled).toBe(false);expect(cfg.writeEnabled).toBe(false);
  }
 });
});
const request=(body:unknown,headers:Record<string,string>={Authorization:'Bearer fixture'})=>new Request('https://preview.example/api/admin-oneoff-billing',{method:'POST',headers,body:JSON.stringify(body)});
function fixture(){
 const client={auth:{getUser:vi.fn(async()=>({data:{user:{id:actor,email_confirmed_at:'2026-11-27'}},error:null}))},rpc:vi.fn(async()=>({data:true,error:null}))};
 const store={call:vi.fn(async(command:string):Promise<unknown>=>command==='status'?{items:[]}:command==='enqueue'?{duplicate:false,requestId:id}:command==='claim'?{request:operation(),lease:id}:{ok:true})};
 const provider={validatePayer:vi.fn(async()=>{}),payerReadiness:vi.fn(async()=>({ready:true,missing:[] as string[]})),create:vi.fn(async()=>checkout),payments:vi.fn(async()=>[payment()])};
 const service=new OneoffService(store as OneoffStore,provider as unknown as OneoffProvider);
 const factory=vi.fn(()=>service),clientFactory=vi.fn(()=>client as unknown as ReturnType<typeof adminClient>);
 return {client,store,provider,service,factory,clientFactory};
}
describe('oneoff provider, fixed amount and isolation',()=>{
 it.each(['PIX','CREDIT_CARD'] as const)('requests only hosted DETACHED %s, no subscription/card fields',async method=>{
  const fetcher=vi.fn<typeof fetch>(async(_url,options)=>Response.json(options?.method==='POST'?{id:checkout}:payer()));
  const provider=new OneoffProvider(env,'sandbox',fetcher);
  expect(await provider.create(operation(method),'https://preview.example/admin?sec=oneoff')).toBe(checkout);
  const calls=fetcher.mock.calls;expect(calls).toHaveLength(2);
  expect(calls[1]?.[0]).toBe('https://api-sandbox.asaas.com/v3/checkouts');
  const init=calls[1]?.[1];expect(init?.redirect).toBe('error');
  const body=JSON.parse(String(init?.body));expect(body).toMatchObject({customer:'cus_consent',billingTypes:[method],chargeTypes:['DETACHED'],items:[{quantity:1,value:19.90}],externalReference:id});
  expect(body.items[0].name).toBe('PEREIRÃO — teste avulso');
  expect(body.items[0].name.length).toBeLessThanOrEqual(30);
  expect(body).not.toHaveProperty('subscription');expect(body).not.toHaveProperty('installment');expect(JSON.stringify(body)).not.toMatch(/creditCard|cvv|ccv|holderName|cardToken/);
 });
 it('rejects an item name exceeding the real Asaas 30-character limit before POST',async()=>{
  const fetcher=vi.fn<typeof fetch>(),provider=new OneoffProvider(env,'sandbox',fetcher);
  await expect(provider.call('/checkouts',{customer:'cus_consent',billingTypes:['PIX'],chargeTypes:['DETACHED'],externalReference:id,items:[{name:'PEREIRÃO — teste administrativo avulso',quantity:1,value:19.90}]})).rejects.toThrow('INVALID_INPUT');
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('rejects production writes without new independent flag even with valid key',async()=>{
  const fetcher=vi.fn<typeof fetch>();const production={...env,VERCEL_ENV:'production',ASAAS_API_KEY_PRODUCTION:'$aact_prod_fixture',BILLING_PRODUCTION_RPC_SIGNING_SECRET:'P'.repeat(64)};
  expect(oneoffConfig(production,'production').writeEnabled).toBe(false);
  await expect(new OneoffProvider(production,'production',fetcher).create(operation(),'https://pereirao.vercel.app/admin')).rejects.toThrow();
  // GET customer may be attempted; no successful preflight can reach POST when disabled.
  expect(fetcher.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
 });
 it('requires a dedicated webhook token, never the subscription token or the HMAC secret',()=>{
  expect(oneoffConfig({...env,ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN:undefined},'sandbox').webhookEnabled).toBe(false);
  expect(()=>oneoffConfig({...env,ASAAS_SANDBOX_WEBHOOK_TOKEN:env.ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN},'sandbox')).toThrow('SETUP_REQUIRED');
  expect(()=>oneoffConfig({...env,ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN:env.BILLING_RPC_SIGNING_SECRET},'sandbox')).toThrow('SETUP_REQUIRED');
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
  const f=fixture();f.store.call.mockImplementation(async cmd=>cmd==='context'?{...operation(),state:'authorized'}:cmd==='start'?{create:true,request:operation()}:{ok:true});f.provider.create.mockRejectedValue(Error('private-provider-detail'));
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
 const hookRequest=(headers:Record<string,string>={},body:unknown=notice)=>request(body,{'content-type':'application/json','asaas-access-token':env.ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN,...headers});
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
  const response=await hook(request({id:'evt_success',event:'CHECKOUT_PAID',checkout:{id:checkout,externalReference:id}},{'content-type':'application/json','asaas-access-token':env.ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN}));
  expect(response.status).toBe(200);expect(process).toHaveBeenCalledExactlyOnceWith('evt_success');expect(defer).toHaveBeenCalledTimes(1);
 });
});


it('admin create responses strip internal leases, actor and payer identifiers',async()=>{
 const f=fixture();f.store.call.mockResolvedValue({create:false,request:{...operation(),lease:'internal-lease',actor_id:actor,customer_id:'cus_consent'}});
 const response=await createOneoffHandler(env,f.factory,f.clientFactory)(request({action:'create',requestId:id,confirmation:'CRIAR CHECKOUT AVULSO 19,90'}));
 expect(response.status).toBe(200);const result=await response.json();expect(result.data.id).toBe(id);
 expect(result.data).not.toHaveProperty('lease');expect(result.data).not.toHaveProperty('actor_id');expect(result.data).not.toHaveProperty('customer_id');
});

describe('narrow audited recovery of the definitively rejected Sandbox checkout',()=>{
 const historical='dd279b98-de7c-4eeb-8253-fd95e2564bc4';
 const confirmation='RECUPERAR REJEICAO SANDBOX SEM CRIAR';
 function recovery(){
  const f=fixture();Object.assign(f.provider,{environment:'sandbox'});
  f.store.call.mockResolvedValue({...operation(),id:historical,state:'uncertain',diagnostic:'creation_uncertain',checkout_id:null,payment_id:null});
  f.provider.payments.mockResolvedValue([]);return f;
 }
 it('checks the existing external reference, then requests a signed transition without creating checkout',async()=>{
  const f=recovery();await f.service.recoverNameRejection(actor,historical,confirmation);
  expect(f.provider.payments).toHaveBeenCalledWith(expect.objectContaining({id:historical,checkout_id:null}));
  expect(f.store.call).toHaveBeenLastCalledWith('recover_name_rejection',expect.objectContaining({actorId:actor,requestId:historical,confirmation,paymentsEmpty:true,evidence:expect.objectContaining({httpStatus:400,logId:'108269826',reference:historical})}));
  expect(f.provider.create).not.toHaveBeenCalled();expect(f.store.call.mock.calls.some(([x])=>x==='authorize'||x==='start')).toBe(false);
 });
 it('inspection does not transition or create anything',async()=>{
  const f=recovery();expect(await f.service.checkNameRejection(actor,historical)).toMatchObject({paymentsEmpty:true});
  expect(f.store.call).toHaveBeenCalledTimes(1);expect(f.store.call).toHaveBeenCalledWith('context',{actorId:actor,requestId:historical});expect(f.provider.create).not.toHaveBeenCalled();
 });
 it.each(['timeout','ambiguous response'])('blocks recovery when the API read fails: %s',async message=>{
  const f=recovery();f.provider.payments.mockRejectedValue(Error(message));
  await expect(f.service.recoverNameRejection(actor,historical,confirmation)).rejects.toThrow(message);
  expect(f.store.call.mock.calls.some(([x])=>x==='recover_name_rejection')).toBe(false);
 });
 it('blocks any existing payment even if its status is not paid',async()=>{
  const f=recovery();f.provider.payments.mockResolvedValue([{...payment(),status:'PENDING'}]);
  await expect(f.service.recoverNameRejection(actor,historical,confirmation)).rejects.toThrow('MISMATCH');
  expect(f.store.call).toHaveBeenCalledTimes(1);
 });
 it.each([{checkout_id:checkout},{payment_id:'pay_existing'},{state:'creating'},{state:'paid'},{environment:'production'}])('rejects incompatible context %j',async change=>{
  const f=recovery();f.store.call.mockResolvedValue({...operation(),id:historical,state:'uncertain',checkout_id:null,payment_id:null,...change});
  await expect(f.service.recoverNameRejection(actor,historical,confirmation)).rejects.toThrow('MISMATCH');expect(f.provider.payments).not.toHaveBeenCalled();
 });
 it('never opens recovery for a different request or Production',async()=>{
  const f=recovery();await expect(f.service.recoverNameRejection(actor,id,confirmation)).rejects.toThrow('FORBIDDEN');
  Object.assign(f.provider,{environment:'production'});await expect(f.service.recoverNameRejection(actor,historical,confirmation)).rejects.toThrow('FORBIDDEN');expect(f.store.call).not.toHaveBeenCalled();
 });
 it('requires separate confirmation and propagates missing migration safely',async()=>{
  const f=recovery();await expect(f.service.recoverNameRejection(actor,historical,'')).rejects.toThrow('FORBIDDEN');
  f.store.call.mockImplementation(async cmd=>{if(cmd==='recover_name_rejection')throw Error('SETUP_REQUIRED');return {...operation(),id:historical,state:'uncertain',checkout_id:null,payment_id:null};});
  await expect(f.service.recoverNameRejection(actor,historical,confirmation)).rejects.toThrow('SETUP_REQUIRED');expect(f.provider.create).not.toHaveBeenCalled();
 });
 it('an ambiguous successful HTTP response never permits automatic creation retry',async()=>{
  const fetcher=vi.fn<typeof fetch>(async(_u,opts)=>Response.json(opts?.method==='POST'?{}:payer()));
  await expect(new OneoffProvider(env,'sandbox',fetcher).create(operation(),'https://preview.example/admin')).rejects.toThrow('RECONCILIATION_REQUIRED');
  expect(fetcher.mock.calls.filter(([,o])=>o?.method==='POST')).toHaveLength(1);
 });
});

describe('recovery endpoint authentication',()=>{
 it('does not let anonymous callers reach recovery',async()=>{
  const f=fixture();const response=await createOneoffHandler(env,f.factory,f.clientFactory)(request({action:'recover_name_rejection',requestId:'dd279b98-de7c-4eeb-8253-fd95e2564bc4'},{}));
  expect(response.status).toBe(401);expect(f.factory).not.toHaveBeenCalled();
 });
 it('does not let an authenticated non-admin inspect or recover',async()=>{
  const f=fixture();f.client.rpc.mockResolvedValue({data:false,error:null});
  for(const action of ['check_name_rejection','recover_name_rejection'])expect((await createOneoffHandler(env,f.factory,f.clientFactory)(request({action,requestId:'dd279b98-de7c-4eeb-8253-fd95e2564bc4'}))).status).toBe(403);
  expect(f.factory).not.toHaveBeenCalled();
 });
});

describe('payer preflight and recovery of the customer-data rejection',()=>{
 const historical='dd279b98-de7c-4eeb-8253-fd95e2564bc4';
 it.each(['phone','address','addressNumber','postalCode','province','city','notificationDisabled'])('blocks missing %s before any checkout POST',async key=>{
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json({...payer(),[key]:undefined})),p=new OneoffProvider(env,'sandbox',fetcher);
  expect(await p.payerReadiness(operation())).toMatchObject({ready:false,missing:[key]});
  await expect(p.create(operation(),'https://preview.example/admin')).rejects.toThrow('PAYER_INCOMPLETE');
  expect(fetcher.mock.calls.every(([,o])=>o?.method==='GET')).toBe(true);
 });
 it('does not claim creation when the payer preflight fails',async()=>{
  const f=fixture();f.store.call.mockResolvedValue({...operation(),state:'authorized'});f.provider.validatePayer.mockRejectedValue(Error('PAYER_INCOMPLETE'));
  await expect(f.service.create(actor,id,'CRIAR CHECKOUT AVULSO 19,90','https://preview.example/admin')).rejects.toThrow('PAYER_INCOMPLETE');
  expect(f.store.call).toHaveBeenCalledExactlyOnceWith('context',{actorId:actor,requestId:id});expect(f.provider.create).not.toHaveBeenCalled();
 });
 it('checks complete payer and empty payments without creating, then uses the new signed transition only',async()=>{
  const f=fixture();Object.assign(f.provider,{environment:'sandbox'});f.store.call.mockResolvedValue({...operation(),id:historical,state:'uncertain',checkout_id:null,payment_id:null});f.provider.payments.mockResolvedValue([]);
  const proof=await f.service.checkPayerRejection(actor,historical);expect(proof).toMatchObject({ready:true,payerValidated:true,paymentsEmpty:true,evidence:{logId:'108278750'}});
  await f.service.recoverPayerRejection(actor,historical,'RECUPERAR REJEICAO SANDBOX SEM CRIAR');
  expect(f.store.call).toHaveBeenLastCalledWith('recover_payer_rejection',expect.objectContaining({requestId:historical,payerValidated:true}));
  expect(f.store.call.mock.calls.some(([c])=>c==='recover_name_rejection'||c==='authorize'||c==='start')).toBe(false);expect(f.provider.create).not.toHaveBeenCalled();
 });
 it('incomplete payer never reaches recovery or even financial lookup',async()=>{
  const f=fixture();Object.assign(f.provider,{environment:'sandbox'});f.store.call.mockResolvedValue({...operation(),id:historical,state:'uncertain',checkout_id:null,payment_id:null});f.provider.payerReadiness.mockResolvedValue({ready:false,missing:['phone']});
  await expect(f.service.recoverPayerRejection(actor,historical,'RECUPERAR REJEICAO SANDBOX SEM CRIAR')).rejects.toThrow('PAYER_INCOMPLETE');
  expect(f.provider.payments).not.toHaveBeenCalled();expect(f.store.call).toHaveBeenCalledTimes(1);
 });
 it('returns only readiness/field names, never customer data',async()=>{
  const p=new OneoffProvider(env,'sandbox',async()=>Response.json({...payer(),cpfCnpj:'private',email:'private@example.invalid'}));
  expect(await p.payerReadiness(operation())).toEqual({ready:true,missing:[]});
 });
 it.each([{}, {phone:'1'}, {postalCode:'bad'}, {city:0}, {notificationDisabled:false}])('validates malformed customer data %j',async change=>{
  const body=Object.keys(change).length?{...payer(),...change}:{id:'cus_consent'};
  expect((await new OneoffProvider(env,'sandbox',async()=>Response.json(body)).payerReadiness(operation())).ready).toBe(false);
 });
});
