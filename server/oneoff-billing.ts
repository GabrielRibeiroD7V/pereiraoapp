// Exclusivamente servidor: testes avulsos #98, sem criação de clientes/assinaturas.
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { oneoffNotice } from "../supabase/functions/_shared/oneoff-notice.ts";
import { createClient } from "@supabase/supabase-js";
import { adminClient } from "./admin-handler.ts";
import { boundedJson } from "./production-billing-provider.ts";
export type Environment = "sandbox" | "production";
type Env = Record<string,string|undefined>;
export type Method = "PIX" | "CREDIT_CARD";
export interface OneoffRequest {
 id:string; environment:Environment;method:Method;customer_id:string;state:string;
 checkout_id:string|null;payment_id:string|null;amount_cents:1990;currency:"BRL";
 net_cents:number|null;refunded_cents:number;diagnostic:string|null;provider_status:string|null;
 consent_at:string;created_at:string;
}
export class OneoffError extends Error {public code:string;constructor(code:string){super(code);this.code=code;}}
const uuid=(v:unknown):v is string=>typeof v==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const customer=(v:unknown):v is string=>typeof v==="string" && /^cus_[A-Za-z0-9_-]{1,150}$/.test(v);
// Match the direct Sandbox inbox: normalize only accidental outer ASCII
// whitespace in server configuration. Never normalize the received header.
const sandboxToken=(value:string|undefined)=>value?.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g,'');
const validWebhookToken=(value:string|undefined,environment:Environment):value is string=>!!value &&
 (environment==='sandbox'?/^[\x21-\x7e]{32,255}$/:/^[A-Za-z0-9_-]{32,200}$/).test(value);
export function oneoffConfig(env:Env,environment:Environment){
 if(!["sandbox","production"].includes(environment) || (environment==="production" ? env.VERCEL_ENV!=="production":env.VERCEL_ENV!=="preview") || env.VITE_SUPABASE_URL!=="https://yazdjiwaksamizrbqewq.supabase.co" || !env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")) throw new OneoffError("DISABLED");
 if(environment==="production" && ["CHECKOUT","SUBSCRIPTIONS","CHARGES","ENFORCEMENT","PIX"].some(k=>env["ASAAS_PRODUCTION_"+k+"_ENABLED"]!==undefined && env["ASAAS_PRODUCTION_"+k+"_ENABLED"]!=="false"))throw new OneoffError("DISABLED");
 const prod=environment==="production",key=prod?env.ASAAS_API_KEY_PRODUCTION:env.ASSAS_API_KEY_SANDBOX,
  signing=prod?env.BILLING_PRODUCTION_RPC_SIGNING_SECRET:env.BILLING_RPC_SIGNING_SECRET,
  token=prod?env.ASAAS_PRODUCTION_WEBHOOK_TOKEN:sandboxToken(env.ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN);
 if(token && token===signing || token && (token===env.ASAAS_SANDBOX_WEBHOOK_TOKEN || !prod && token===sandboxToken(env.ASAAS_SANDBOX_WEBHOOK_TOKEN)) || prod && token && token===env.ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN || !key || !(prod?/^\$aact_prod_[\x21-\x7e]{1,2048}$/:/^\$aact_hmlg_[\x21-\x7e]{1,2048}$/).test(key) || !signing || !/^[A-Za-z0-9_-]{48,200}$/.test(signing) || prod && (signing===env.BILLING_RPC_SIGNING_SECRET || key===env.ASSAS_API_KEY_SANDBOX)) throw new OneoffError("SETUP_REQUIRED");
 return {key,signing,token,host:prod?"https://api.asaas.com/v3":"https://api-sandbox.asaas.com/v3",
  writeEnabled:env[prod?"ASAAS_ADMIN_ONEOFF_PRODUCTION_ENABLED":"ASAAS_ADMIN_ONEOFF_SANDBOX_ENABLED"]==="true",
  webhookEnabled:env.ASAAS_ADMIN_ONEOFF_WEBHOOK_ENABLED==="true" && validWebhookToken(token,environment)};
}
export interface OneoffStore {call<T=unknown>(command:string,payload:Record<string,unknown>):Promise<T>}
export function oneoffStore(env:Env,environment:Environment):OneoffStore{
 const cfg=oneoffConfig(env,environment),client=createClient(env.VITE_SUPABASE_URL!,env.VITE_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 return {async call<T>(command:string,payload:Record<string,unknown>){
  const raw=JSON.stringify({...payload,environment}),nonce=randomUUID(),issuedAt=Math.floor(Date.now()/1000),signature=createHmac("sha256",createHash("sha256").update(cfg.signing).digest()).update("oneoff-v1\n"+command+"\n"+nonce+"\n"+issuedAt+"\n"+raw).digest("hex");
  const {data,error}=await client.rpc("admin_oneoff_server",{command,raw_payload:raw,issued_at:issuedAt,nonce,signature});
  if(error)throw new OneoffError(["PGRST202","42883","42P01","55000"].includes(error.code)?"SETUP_REQUIRED":error.code==="42501"?"FORBIDDEN":["23505","40001"].includes(error.code)?"CONFLICT":error.code==="23514"?"MISMATCH":"UNAVAILABLE");
  return data as T;
 }};
}
export class OneoffProvider{
 private cfg:ReturnType<typeof oneoffConfig>;
 public environment:Environment;private request:typeof fetch;
 constructor(env:Env,environment:Environment,request:typeof fetch=fetch){this.cfg=oneoffConfig(env,environment);this.environment=environment;this.request=request;}
 async call(path:string,body?:Record<string,unknown>){
  if(!/^\/(customers\/cus_[A-Za-z0-9_-]+|payments(?:\/pay_[A-Za-z0-9_-]+|\?[A-Za-z0-9_?=&%-]+)?|checkouts(?:\/[0-9a-f-]{36}\/cancel)?)$/.test(path))throw new OneoffError("INVALID_INPUT");
  if(body && (!this.cfg.writeEnabled || !this.cfg.webhookEnabled || path!=="/checkouts" && !path.endsWith("/cancel")))throw new OneoffError("DISABLED");
  if(body && path==='/checkouts'){
   const items=body.items as Record<string,unknown>[]|undefined;
   if(JSON.stringify(body.chargeTypes)!=='["DETACHED"]'||!Array.isArray(body.billingTypes)||body.billingTypes.length!==1||!['PIX','CREDIT_CARD'].includes(String(body.billingTypes[0]))||!customer(body.customer)||!uuid(body.externalReference)||!Array.isArray(items)||items.length!==1||items[0]?.value!==19.90||items[0]?.quantity!==1||typeof items[0]?.name!=='string'||items[0].name.length<1||items[0].name.length>30||Object.keys(body).some(k=>!['customer','billingTypes','chargeTypes','minutesToExpire','externalReference','callback','items'].includes(k)))throw new OneoffError('INVALID_INPUT');
  }
  try{
   const r=await this.request(this.cfg.host+path,{method:body?"POST":"GET",redirect:"error",signal:AbortSignal.timeout(10000),headers:{access_token:this.cfg.key,"Content-Type":"application/json",accept:"application/json","User-Agent":"PereiraoAdminOneoff/1.0"},...(body?{body:JSON.stringify(body)}:{})});
   if(!r.ok){await r.body?.cancel();throw new OneoffError("PROVIDER_UNAVAILABLE");}
   return await boundedJson(r,131072);
  }catch{throw new OneoffError("PROVIDER_UNAVAILABLE");}
 }
 async create(r:OneoffRequest,returnUrl:string){
  if(!uuid(r.id)||!customer(r.customer_id)||r.amount_cents!==1990||!["PIX","CREDIT_CARD"].includes(r.method))throw new OneoffError("INVALID_INPUT");
  const u=new URL(returnUrl);if(u.protocol!=="https:"||u.username||u.password||u.hash)throw new OneoffError("INVALID_INPUT");
  const payer=await this.call("/customers/"+r.customer_id);if(payer.id!==r.customer_id || payer.deleted===true)throw new OneoffError("MISMATCH");
  const value=await this.call("/checkouts",{customer:r.customer_id,billingTypes:[r.method],chargeTypes:["DETACHED"],minutesToExpire:60,externalReference:r.id,callback:{successUrl:returnUrl,cancelUrl:returnUrl,expiredUrl:returnUrl},items:[{name:"PEREIRÃO — teste avulso",description:"Teste único autorizado. Não é assinatura.",quantity:1,value:19.90}]});
  if(!uuid(value.id))throw new OneoffError("RECONCILIATION_REQUIRED");return value.id;
 }
 async payments(r:OneoffRequest){
  const filter=r.checkout_id?"checkoutSession="+r.checkout_id:"externalReference="+r.id;
  const result=await this.call("/payments?"+filter+"&limit=2&offset=0");
  if(!Array.isArray(result.data)||result.data.length>1||result.hasMore!==false||typeof result.totalCount!=="number"||result.totalCount!==result.data.length)throw new OneoffError("MISMATCH");
  if(r.payment_id){
   if(!/^pay_[A-Za-z0-9_-]{1,150}$/.test(r.payment_id))throw new OneoffError('MISMATCH');
   const existing=await this.call('/payments/'+r.payment_id);
   if(existing.id!==r.payment_id || (result.data as Record<string,unknown>[]).some(p=>p.id!==r.payment_id))throw new OneoffError('MISMATCH');
   return [existing];
  }
  return result.data as Record<string,unknown>[];
 }
}
const money=(v:unknown)=>{if(typeof v!=="number"||!Number.isFinite(v)||v<0||Math.abs(v*100-Math.round(v*100))>0.000001)throw new OneoffError("MISMATCH");return Math.round(v*100);};
export function oneoffSnapshot(p:Record<string,unknown>,r:OneoffRequest){
 if(typeof p.id!=="string"||!/^pay_[A-Za-z0-9_-]{1,150}$/.test(p.id)||p.customer!==r.customer_id||p.billingType!==r.method||money(p.value)!==1990||p.subscription!=null||p.installment!=null||p.currency!=null&&p.currency!=="BRL"||!uuid(p.checkoutSession)||r.checkout_id&&p.checkoutSession!==r.checkout_id||!r.checkout_id&&p.externalReference!==r.id||p.externalReference!=null&&p.externalReference!==r.id)throw new OneoffError("MISMATCH");
 const statuses=["CONFIRMED","RECEIVED","PENDING","OVERDUE","CREDIT_CARD_CAPTURE_REFUSED","REPROVED_BY_RISK_ANALYSIS","REFUNDED","PARTIALLY_REFUNDED","DELETED","AWAITING_RISK_ANALYSIS","REFUND_REQUESTED","CHARGEBACK_REQUESTED","CHARGEBACK_DISPUTE","AWAITING_CHARGEBACK_REVERSAL"];
 if(typeof p.status!=="string"||!statuses.includes(p.status))throw new OneoffError("MISMATCH");
 let refunded=0;if(p.refunds!=null){if(!Array.isArray(p.refunds))throw new OneoffError("MISMATCH");for(const x of p.refunds){if(!x||typeof x!=="object"||!['DONE','PENDING','CANCELLED'].includes(String(x.status)))throw new OneoffError("MISMATCH");if(x.status==='DONE')refunded+=money(x.value);}}
 if(p.status==='REFUNDED')refunded=1990;
 if(refunded>0&&!['REFUNDED','PARTIALLY_REFUNDED'].includes(String(p.status)))throw new OneoffError('MISMATCH');
 if(refunded>1990||p.status==='PARTIALLY_REFUNDED'&&(!refunded||refunded===1990))throw new OneoffError("MISMATCH");
 const net=p.netValue==null?null:money(p.netValue);if(net!=null&&net>1990)throw new OneoffError("MISMATCH");
 return {requestId:r.id,checkoutId:p.checkoutSession,paymentId:p.id,customerId:r.customer_id,method:r.method,amountCents:1990,currency:"BRL",subscriptionId:null,installmentId:null,status:p.status,netCents:net,refundedCents:refunded};
}
export function checkoutUrl(environment:Environment,id:string){if(!uuid(id))throw new OneoffError("INVALID_INPUT");return (environment==='sandbox'?"https://sandbox.asaas.com":"https://asaas.com")+"/checkoutSession/show?id="+id;}
export class OneoffService{
 public store:OneoffStore;private provider:OneoffProvider;
 constructor(store:OneoffStore,provider:OneoffProvider){this.store=store;this.provider=provider;}
 async create(actorId:string,requestId:string,confirmation:string,returnUrl:string){
  const result=await this.store.call<{create:boolean;request:OneoffRequest}>("start",{actorId,requestId,confirmation});
  if(!result.create)return result.request;
  try{const checkoutId=await this.provider.create(result.request,returnUrl);return await this.store.call<OneoffRequest>("save_checkout",{requestId,checkoutId});}
  catch{await this.store.call("uncertain",{requestId});throw new OneoffError("RECONCILIATION_REQUIRED");}
 }
 async reconcile(actorId:string,requestId:string,eventType?:string){
  const result=await this.store.call<{request:OneoffRequest;lease:string}|null>("claim",{actorId,requestId});
  if(!result)throw new OneoffError("BUSY");
  try {
  const rows=await this.provider.payments(result.request);
  if(!rows.length){if(eventType==='CHECKOUT_PAID')throw new OneoffError("RECONCILIATION_REQUIRED");await this.store.call("observe_checkout",{requestId,lease:result.lease,state:eventType==='CHECKOUT_EXPIRED'?'expired':eventType==='CHECKOUT_CANCELED'?'cancelled':'pending'});return;}
  const snapshot=oneoffSnapshot(rows[0]!,result.request);
  if(!result.request.checkout_id)await this.store.call("save_checkout",{requestId,checkoutId:snapshot.checkoutId});
  await this.store.call("snapshot",{...snapshot,lease:result.lease});
  }catch(e){await this.store.call("reconciliation_failed",{requestId,lease:result.lease,diagnostic:e instanceof OneoffError && e.code==='MISMATCH'?'mismatch':'reconciliation_required'});throw e;}
 }
 async event(eventId:string){
  const claim=await this.store.call<{requestId:string;notice:{eventType:string};lease:string}|null>("claim_event",{eventId});if(!claim)return;
  let ok=false;try{
   // O ator já foi confirmado na autorização persistida; leitura não cria pagamento.
   const context=await this.store.call<OneoffRequest>("event_context",{requestId:claim.requestId});
   await this.reconcile((context as OneoffRequest & {actor_id:string}).actor_id,claim.requestId,claim.notice.eventType);ok=true;
  }finally{await this.store.call("finish_event",{eventId,lease:claim.lease,ok});}
 }
}
const reply=(status:number,value:unknown)=>Response.json(value,{status,headers:{"Cache-Control":"private, no-store",Vary:"Authorization","X-Content-Type-Options":"nosniff"}});
const failure=(e:unknown)=>{const code=e instanceof OneoffError?e.code:"UNAVAILABLE";return reply(({AUTH_REQUIRED:401,FORBIDDEN:403,DISABLED:403,INVALID_INPUT:400,CONFLICT:409,MISMATCH:409,BUSY:409,SETUP_REQUIRED:503} as Record<string,number>)[code]??503,{code});};
export const oneoffService=(env:Env,e:Environment)=>new OneoffService(oneoffStore(env,e),new OneoffProvider(env,e));
function publicOperation(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new OneoffError('UNAVAILABLE');
 const row=value as Record<string,unknown>;
 return Object.fromEntries(['id','environment','method','state','checkout_id','payment_id','amount_cents','currency','net_cents','refunded_cents','diagnostic','provider_status','consent_at','created_at'].map(k=>[k,row[k]]));
}
export function createOneoffHandler(env:Env,factory=oneoffService,clientFactory=adminClient){return async(req:Request)=>{
 if(req.method!=="POST")return reply(405,{code:"METHOD_NOT_ALLOWED"});
 try{
  if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return reply(403,{code:"FORBIDDEN"});
  const authorization=req.headers.get('authorization');if(!authorization||!/^Bearer \S+$/.test(authorization))return reply(401,{code:"AUTH_REQUIRED"});
  const client=clientFactory(env,authorization),user=await client.auth.getUser();if(user.error||!user.data.user?.email_confirmed_at)return reply(401,{code:"AUTH_REQUIRED"});
  const access=await client.rpc('admin_access');if(access.error||access.data!==true)return reply(403,{code:"FORBIDDEN"});
  const p=await boundedJson(req,4096),e=(p.environment??(env.VERCEL_ENV==='production'?'production':'sandbox')) as Environment,cfg=oneoffConfig(env,e),actorId=user.data.user.id,service=factory(env,e);
  if(Object.keys(p).some(k=>!['action','environment','enabled','reason','confirmation','requestId','method','customerId','payerConsent'].includes(k)))throw new OneoffError('INVALID_INPUT');
  if(p.action==='status')return reply(200,{data:await service.store.call('status',{actorId}),writeEnabled:cfg.writeEnabled&&cfg.webhookEnabled});
  if(p.action==='configure'){
   if(p.enabled===true&&(!cfg.writeEnabled||!cfg.webhookEnabled||!cfg.token))throw new OneoffError('DISABLED');
   return reply(200,{data:await service.store.call('configure',{actorId,enabled:p.enabled,reason:p.reason,confirmation:p.confirmation})});
  }
  if(p.action==='retry'){
   const ids=await service.store.call<string[]>('retry',{actorId});for(const id of ids)await service.event(id).catch(()=>{});return reply(200,{data:{scheduled:ids.length}});
  }
  if(!uuid(p.requestId))throw new OneoffError('INVALID_INPUT');
  if(p.action==='reconcile'){await service.reconcile(actorId,p.requestId);return reply(200,{data:{ok:true}});}
  if(!cfg.writeEnabled||!cfg.webhookEnabled||!cfg.token)throw new OneoffError('DISABLED');
  if(p.action==='authorize'){
   if(!customer(p.customerId)||!['PIX','CREDIT_CARD'].includes(String(p.method)))throw new OneoffError('INVALID_INPUT');
   return reply(200,{data:publicOperation(await service.store.call('authorize',{actorId,requestId:p.requestId,method:p.method,customerId:p.customerId,payerConsent:p.payerConsent,confirmation:p.confirmation}))});
  }
  if(p.action==='create')return reply(200,{data:publicOperation(await service.create(actorId,p.requestId,p.confirmation as string,new URL('/admin?sec=oneoff',e==='production'?'https://pereirao.vercel.app':req.url).href))});
  throw new OneoffError('INVALID_INPUT');
 }catch(e){return failure(e);}
};}
export function createOneoffWebhook(env:Env,defer:(task:Promise<unknown>)=>void,factory=oneoffService){return async(req:Request)=>{
 if(req.method!=='POST')return reply(405,{code:'METHOD_NOT_ALLOWED'});
 try{
  const e:Environment=env.VERCEL_ENV==='production'?'production':'sandbox',cfg=oneoffConfig(env,e);
  if(!cfg.webhookEnabled)throw new OneoffError('DISABLED');
  const received=req.headers.get('asaas-access-token')??'';
  if(!validWebhookToken(cfg.token,e)||Buffer.byteLength(received)!==Buffer.byteLength(cfg.token)||!timingSafeEqual(Buffer.from(received),Buffer.from(cfg.token)))throw new OneoffError('AUTH_REQUIRED');
  if(!req.headers.get('content-type')?.includes('application/json'))throw new OneoffError('INVALID_INPUT');
  const notice=oneoffNotice(await boundedJson(req,65536));
  if(!notice)throw new OneoffError('INVALID_INPUT');
  const service=factory(env,e),result=await service.store.call<{duplicate:boolean;requestId:string|null}>('enqueue',{...notice});
  if(result.requestId)defer(service.event(notice.eventId).catch(()=>{}));
  return reply(200,{received:true,duplicate:result.duplicate}); // só depois da persistência
 }catch(e){return failure(e);}
};}
