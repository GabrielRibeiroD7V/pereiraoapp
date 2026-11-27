// Only the dedicated avulso Preview. Not a generic proxy; no API key or database access.
export const ONEOFF_SANDBOX_TARGET = 'https://pereirao-git-feat-oneoff-sandbox-77badblock-5101s-projects.vercel.app/api/asaas-admin-oneoff-webhook';
const paths = ['/asaas-admin-oneoff-sandbox-webhook', '/functions/v1/asaas-admin-oneoff-sandbox-webhook'];
type Env = Record<string, string | undefined>;
const reply = (status: number, code: string) => Response.json({ code }, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
async function sameToken(a:string,b:string|null){
 if(!b || b.length>200)return false;
 const hashes=await Promise.all([a,b].map(async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))));
 let different=0;for(let i=0;i<32;i++)different|=hashes[0]![i]!^hashes[1]![i]!;return different===0;
}
export function createOneoffSandboxRelay(env:Env,upstream:typeof fetch=fetch){return async(request:Request)=>{
 const url=new URL(request.url);
 if(!paths.includes(url.pathname)||url.search)return reply(404,'NOT_FOUND');
 if(request.method!=='POST')return reply(405,'METHOD_NOT_ALLOWED');
 const token=env.ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN,bypass=env.ASAAS_ADMIN_ONEOFF_SANDBOX_PREVIEW_BYPASS;
 if(env.ASAAS_ADMIN_ONEOFF_SANDBOX_RELAY_ENABLED!=='true'||!token||!/^[A-Za-z0-9_-]{32,200}$/.test(token)||!bypass||!/^[!-~]{16,255}$/.test(bypass)||token===bypass||token===env.ASAAS_SANDBOX_WEBHOOK_TOKEN)return reply(503,'SETUP_REQUIRED');
 // Authenticate before reading the body or contacting Vercel.
 if(!await sameToken(token,request.headers.get('asaas-access-token')))return reply(401,'AUTH_REQUIRED');
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))return reply(415,'JSON_REQUIRED');
 const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>65536))return reply(413,'BODY_TOO_LARGE');
 try{
  const reader=request.body?.getReader();if(!reader)return reply(400,'INVALID_INPUT');
  const chunks:Uint8Array[]=[];let size=0;
  for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>65536){await reader.cancel();return reply(413,'BODY_TOO_LARGE');}chunks.push(next.value);}
  if(!size)return reply(400,'INVALID_INPUT');
  const body=new Uint8Array(size);let offset=0;for(const part of chunks){body.set(part,offset);offset+=part.length;}
  const response=await upstream(ONEOFF_SANDBOX_TARGET,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json','asaas-access-token':token,'x-vercel-protection-bypass':bypass,'User-Agent':'PereiraoAdminOneoffSandboxRelay/1.0'},body});
  if(response.status!==200){await response.body?.cancel();return reply(response.status===400?400:response.status===409?409:502,response.status===400?'INVALID_INPUT':response.status===409?'CONFLICT':'UPSTREAM_UNAVAILABLE');}
  // A protection/login HTML page or any other HTTP 200 is not a durable ACK.
  if(!response.headers.get('content-type')?.includes('application/json')){await response.body?.cancel();return reply(502,'UPSTREAM_UNAVAILABLE');}
  const ackReader=response.body?.getReader();if(!ackReader)return reply(502,'UPSTREAM_UNAVAILABLE');
  let ack='';const decoder=new TextDecoder();let bytes=0;
  for(;;){const next=await ackReader.read();if(next.done)break;bytes+=next.value.length;if(bytes>2048){await ackReader.cancel();return reply(502,'UPSTREAM_UNAVAILABLE');}ack+=decoder.decode(next.value,{stream:true});}ack+=decoder.decode();
  if(JSON.parse(ack)?.received!==true)return reply(502,'UPSTREAM_UNAVAILABLE');
  return Response.json({received:true},{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return reply(502,'UPSTREAM_UNAVAILABLE');}
};}
