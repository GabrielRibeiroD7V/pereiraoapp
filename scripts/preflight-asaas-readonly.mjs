// Diagnóstico opt-in, exclusivamente GET no Sandbox; não revela cadastro ou chave Pix.
const states=new Set(['PENDING','AWAITING_APPROVAL','APPROVED','REJECTED','AWAITING_ACTIVATION','ACTIVE','AWAITING_DELETION','AWAITING_ACCOUNT_DELETION','DELETED','ERROR']);
const state=value=>states.has(value)?value:'UNKNOWN';
export async function sandboxReadOnlyPreflight(key,request=fetch){
 if(typeof key!=='string'||!key.startsWith('$aact_hmlg_')||key.trim()!==key)return {environment:'sandbox',keyAccepted:false};
 async function get(path){
  try{const response=await request('https://api-sandbox.asaas.com/v3'+path,{method:'GET',headers:{access_token:key,accept:'application/json','User-Agent':'PereiraoReadOnlyPreflight/1.0'},redirect:'error',signal:AbortSignal.timeout(8000)});
   if(!response.ok){await response.body?.cancel();return {http:response.status,data:null};}
   return {http:response.status,data:await response.json()};
  }catch{return {http:null,data:null};}
 }
 const account=await get('/myAccount/status/'),keys=await get('/pix/addressKeys?limit=100&offset=0');
 const rows=Array.isArray(keys.data?.data)?keys.data.data:[];
 const counts={};for(const item of rows){const s=state(item.status);counts[s]=(counts[s]??0)+1;}
 return {environment:'sandbox',readOnly:true,accountHttp:account.http,account:account.data?Object.fromEntries(['commercialInfo','bankAccountInfo','documentation','general'].map(k=>[k,state(account.data[k])])):null,pixHttp:keys.http,pixKeys:counts,pixHasMore:keys.data?.hasMore===true,causality:'NOT_ESTABLISHED',pixMayBeTested:false};
}
