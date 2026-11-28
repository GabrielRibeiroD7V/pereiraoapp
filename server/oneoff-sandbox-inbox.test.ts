// @vitest-environment node
import {createHmac, createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {describe, it, expect, vi} from 'vitest';
import {createOneoffSandboxInbox} from '../supabase/functions/_shared/oneoff-sandbox-inbox';
import {oneoffNotice} from '../supabase/functions/_shared/oneoff-notice';
const token = 'T'.repeat(64), signing = 'S'.repeat(64);
const env = {SUPABASE_URL: 'https://yazdjiwaksamizrbqewq.supabase.co', ASAAS_ADMIN_ONEOFF_SANDBOX_RECEIVER_ENABLED: 'true', ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN: token, ASAAS_ADMIN_ONEOFF_SANDBOX_RPC_SIGNING_SECRET: signing, ASAAS_ADMIN_ONEOFF_SANDBOX_PUBLISHABLE_KEY: 'sb_publishable_local_fixture'};
const url = env.SUPABASE_URL + '/functions/v1/asaas-admin-oneoff-sandbox-webhook';
const id = '00000000-0000-4000-8000-000000000981';
const notice = {id:'evt_local', event:'PAYMENT_RECEIVED', payment:{id:'pay_local',checkoutSession:id,externalReference:id,value:19.90,customer:'cus_local',status:'RECEIVED'}};
const req = (body:unknown=notice, headers:Record<string,string>={}, target=url) => new Request(target,{method:'POST',headers:{'content-type':'application/json','asaas-access-token':token,...headers},body:typeof body === 'string' ? body : JSON.stringify(body)});
const ack = () => Response.json({duplicate:false,requestId:id});

describe('Sandbox direct durable inbox',()=>{
 it('posts only a signed enqueue projection to the fixed RPC, independent of Preview',async()=>{
  const db=vi.fn<typeof fetch>(async()=>ack());
  const response=await createOneoffSandboxInbox(env,db)(req({...notice,environment:'production',command:'snapshot',actorId:id,creditCard:'never persist'}, {cookie:'private',authorization:'Bearer private','x-vercel-protection-bypass':'not forwarded'}));
  expect(response.status).toBe(200);expect(await response.json()).toEqual({received:true,duplicate:false});
  const [target,init]=db.mock.calls[0]!;
  expect(target).toBe(env.SUPABASE_URL+'/rest/v1/rpc/admin_oneoff_server');expect(init?.redirect).toBe('error');
  expect(init?.headers).toEqual({apikey:env.ASAAS_ADMIN_ONEOFF_SANDBOX_PUBLISHABLE_KEY,'Content-Type':'application/json',Accept:'application/json'});
  const proof=JSON.parse(String(init?.body)),payload=JSON.parse(proof.raw_payload);
  expect(payload).toEqual({...oneoffNotice(notice),environment:'sandbox'});expect(proof.command).toBe('enqueue');
  const expected=createHmac('sha256',createHash('sha256').update(signing).digest()).update(`oneoff-v1\nenqueue\n${proof.nonce}\n${proof.issued_at}\n${proof.raw_payload}`).digest('hex');
  expect(proof.signature).toBe(expected);expect(Math.abs(Date.now()/1000-proof.issued_at)).toBeLessThan(3);
  expect(String(init?.body)).not.toContain(token);expect(String(init?.body)).not.toContain(signing);
  expect(payload).not.toHaveProperty('value');expect(payload).not.toHaveProperty('status');
 });
 it.each([{}, {...env,ASAAS_ADMIN_ONEOFF_SANDBOX_RECEIVER_ENABLED:'false'}, {...env,ASAAS_ADMIN_ONEOFF_SANDBOX_RECEIVER_ENABLED:undefined,ASAAS_ADMIN_ONEOFF_SANDBOX_RELAY_ENABLED:'true'}, {...env,SUPABASE_URL:'https://other.supabase.co'}, {...env,ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN:signing}, {...env,ASAAS_SANDBOX_WEBHOOK_TOKEN:token}, {...env,BILLING_PRODUCTION_RPC_SIGNING_SECRET:signing}, {...env,ASAAS_PRODUCTION_WEBHOOK_TOKEN:token}, {...env,ASAAS_ADMIN_ONEOFF_SANDBOX_PUBLISHABLE_KEY:'service_role_fixture'}])('fails closed on missing, reused or wrong configuration',async config=>{
  const db=vi.fn();expect((await createOneoffSandboxInbox(config,db)(req())).status).toBe(503);expect(db).not.toHaveBeenCalled();
 });
 it('accepts printable Asaas tokens up to 255 characters while keeping exact-match authentication',async()=>{
  for(const accepted of ['A'.repeat(31)+'!', 'a'.repeat(252)+'!#%', 'x'.repeat(254)+'~']) {
   const configured={...env,ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN:accepted};
   const backend=vi.fn<typeof fetch>(async()=>ack());
   const handler=createOneoffSandboxInbox(configured,backend);
   const bad=await handler(req(notice,{'asaas-access-token':'Q'.repeat(64)}));
   expect(bad.status).toBe(401);expect(backend).not.toHaveBeenCalled();
   const good=await handler(req(notice,{'asaas-access-token':accepted}));
   expect(good.status).toBe(200);expect(backend).toHaveBeenCalledOnce();
  }
 });
 it('normalizes only outer ASCII whitespace in configured Secret, never incoming token',async()=>{
  const known='a'.repeat(32)+'!#'+'b'.repeat(30);
  for (const stored of ['\n'+known,known+'\n','\r\n'+known+'\r\n',' \t'+known+'\n ']) {
   const backend=vi.fn<typeof fetch>(async()=>ack());
   const handler=createOneoffSandboxInbox({...env,ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN:stored},backend);
   expect((await handler(req(notice,{'asaas-access-token':'Q'.repeat(64)}))).status).toBe(401);
   expect(backend).not.toHaveBeenCalled();
   expect((await handler(req(notice,{'asaas-access-token':known}))).status).toBe(200);
   expect(backend).toHaveBeenCalledOnce();
  }
 });
 it('still rejects internal whitespace and non-ASCII in stored secret',async()=>{
  for (const stored of ['a'.repeat(32)+'\n'+'b'.repeat(32), 'a'.repeat(32)+' '+'b'.repeat(32), 'a'.repeat(32)+'é']) {
   const backend=vi.fn();
   expect((await createOneoffSandboxInbox({...env,ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN:stored},backend)(req())).status).toBe(503);
   expect(backend).not.toHaveBeenCalled();
  }
 });
 it.each(['A'.repeat(31),'A'.repeat(256),'A'.repeat(31)+' ','A'.repeat(31)+'\n','A'.repeat(31)+'\t','A'.repeat(31)+'\u007f'])('rejects invalid configured tokens before inbox',async configuredToken=>{
  const backend=vi.fn();
  const handler=createOneoffSandboxInbox({...env,ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN:configuredToken},backend);
  expect((await handler(req())).status).toBe(503);expect(backend).not.toHaveBeenCalled();
 });
 it.each(['','wrong','X'.repeat(256)])('authenticates before reading or writing (%s)',async received=>{
  const request=req(notice,{'asaas-access-token':received}),read=vi.spyOn(request.body!,'getReader'),db=vi.fn();
  expect((await createOneoffSandboxInbox(env,db)(request)).status).toBe(401);expect(read).not.toHaveBeenCalled();expect(db).not.toHaveBeenCalled();
 });
 it.each(['{}','{','[]','null',JSON.stringify({...notice,event:'SUBSCRIPTION_CREATED'}),JSON.stringify({...notice,payment:{id:'https://evil.invalid'}}),JSON.stringify({...notice,payment:[]})])('rejects invalid payload without RPC: %s',async body=>{
  const db=vi.fn();expect((await createOneoffSandboxInbox(env,db)(req(body))).status).toBe(400);expect(db).not.toHaveBeenCalled();
 });
 it('rejects wrong media type and oversized bodies, including missing or lying length',async()=>{
  const db=vi.fn(),handler=createOneoffSandboxInbox(env,db);
  expect((await handler(req(notice,{'content-type':'text/plain'}))).status).toBe(415);
  for(const headers of [{},{'content-length':'1'},{'content-length':'70000'}] as Record<string,string>[])expect((await handler(req('x'.repeat(70000),headers))).status).toBe(413);
  expect(db).not.toHaveBeenCalled();
 });
 it('refuses alternate paths, queries and methods',async()=>{
  const db=vi.fn(),handler=createOneoffSandboxInbox(env,db);
  expect((await handler(new Request(url))).status).toBe(405);
  expect((await handler(req(notice,{},url+'?token=wrong'))).status).toBe(404);
  expect((await handler(req(notice,{},env.SUPABASE_URL+'/functions/v1/asaas-sandbox-webhook'))).status).toBe(404);expect(db).not.toHaveBeenCalled();
 });
 it('does not ACK until persistence resolves; retry after lost response gets duplicate ACK',async()=>{
  let commit!: (response:Response)=>void;
  const db=vi.fn<typeof fetch>().mockImplementationOnce(()=>new Promise(resolve=>{commit=resolve;})).mockResolvedValueOnce(Response.json({duplicate:true,requestId:id}));
  let finished=false;const handler=createOneoffSandboxInbox(env,db),first=handler(req()).then(response=>{finished=true;return response;});
  await vi.waitFor(()=>expect(db).toHaveBeenCalledOnce());expect(finished).toBe(false);
  commit(ack());expect((await first).status).toBe(200);
  const second=await handler(req());expect(await second.json()).toEqual({received:true,duplicate:true});
  const proofs=db.mock.calls.map(([,init])=>JSON.parse(String(init?.body)));expect(proofs[0].nonce).not.toBe(proofs[1].nonce);expect(proofs[0].raw_payload).toBe(proofs[1].raw_payload);
 });
 it('ACKs durable unbound quarantine without calling a financial provider',async()=>{
  const db=vi.fn<typeof fetch>(async()=>Response.json({duplicate:false,requestId:null}));
  expect((await createOneoffSandboxInbox(env,db)(req({...notice,payment:{id:'pay_foreign',externalReference:'unrelated'}}))).status).toBe(200);
  expect(db).toHaveBeenCalledOnce();expect(JSON.parse(JSON.parse(String(db.mock.calls[0]![1]?.body)).raw_payload).reference).toBeNull();
 });
 it.each(['23505','23514'])('does not ACK identity conflicts (%s)',async code=>{
  expect((await createOneoffSandboxInbox(env,async()=>Response.json({code,details:'private'},{status:409}))(req())).status).toBe(409);
 });
 it.each([new Response('login',{headers:{'content-type':'text/html'}}),Response.json({received:true}),Response.json({duplicate:false,requestId:'bad'}),Response.json({duplicate:false,requestId:id,padding:'x'.repeat(2200)}),Response.json({code:'42501',details:'secret'},{status:403})])('rejects false ACKs and database failures without exposing details',async upstream=>{
  const response=await createOneoffSandboxInbox(env,async()=>upstream)(req());expect(response.status).toBe(503);expect(await response.text()).toBe('{"code":"INBOX_UNAVAILABLE"}');
 });
 it('leaves provider retry possible on network error, then accepts a durable retry',async()=>{
  const db=vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('secret')).mockResolvedValueOnce(ack()),handler=createOneoffSandboxInbox(env,db);
  expect((await handler(req())).status).toBe(503);expect((await handler(req())).status).toBe(200);
 });
 it('serves real loopback HTTP without remote data, rejecting authentication and persisting before ACK',async()=>{
  const records=new Map<string,string>();
  const db=vi.fn<typeof fetch>(async(_target,init)=>{
   const proof=JSON.parse(String(init?.body));const p=JSON.parse(proof.raw_payload);const duplicate=records.has(p.eventId);records.set(p.eventId,proof.raw_payload);return Response.json({duplicate,requestId:null});
  });
  const handler=createOneoffSandboxInbox(env,db);
  const server=createServer(async(incoming,outgoing)=>{
   const chunks:Buffer[]=[];for await(const chunk of incoming)chunks.push(Buffer.from(chunk));
   const response=await handler(new Request(url,{method:'POST',headers:incoming.headers as Record<string,string>,body:Buffer.concat(chunks)}));
   outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(await response.text());
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
   const address=server.address();if(!address||typeof address==='string')throw new Error('No local port');
   const target=`http://127.0.0.1:${address.port}/`;
   expect((await fetch(target,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(notice)})).status).toBe(401);
   for(const duplicate of [false,true]){
    const response=await fetch(target,{method:'POST',headers:{'content-type':'application/json','asaas-access-token':token},body:JSON.stringify(notice)});
    expect(await response.json()).toEqual({received:true,duplicate});expect(records.size).toBe(1);
   }
  } finally {await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
 });
});
