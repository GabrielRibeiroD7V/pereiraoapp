import{createClient}from'@supabase/supabase-js';import{it,expect,vi}from'vitest';import type{Database}from'../lib/database.types';
import{createHoursRepository}from'./repository';import{emptyHours}from'./model';
const bid='00000000-0000-4000-8000-000000000801';
function client(fetcher:typeof fetch){return createClient<Database>('https://local.example.invalid','sb_publishable_fixture',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:fetcher}});}
const row={enabled:true,timezone:'America/Campo_Grande',schedule:[[],[{start:'08:00',end:'18:00'}],[],[],[],[],[]],accepts_outside_hours:true,updated_at:'2026-11-25T12:00:00Z'};
it('leitura pública usa cliente público e somente o negócio solicitado',async()=>{
 const auth=vi.fn(),publicFetch=vi.fn(async(input:RequestInfo|URL)=>{const url=new URL(String(input));expect(url.searchParams.get('business_id')).toBe('eq.'+bid);return new Response(JSON.stringify(row),{headers:{'Content-Type':'application/json'}});});
 const repo=createHoursRepository(client(auth),client(publicFetch));expect((await repo.get(bid,true)).data?.acceptsOutsideHours).toBe(true);expect(auth).not.toHaveBeenCalled();
});
it('save usa RPC invoker com revisão esperada e sem status ou campos de negócio',async()=>{
 const requests:{path:string;body:Record<string,unknown>}[]=[];const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{requests.push({path:new URL(String(input)).pathname,body:JSON.parse(String(init?.body))});return new Response(null,{status:204});});const c=client(fetcher),repo=createHoursRepository(c,c);
 await repo.save(bid,{...emptyHours(),enabled:true,schedule:row.schedule,updatedAt:row.updated_at});expect(requests).toHaveLength(1);expect(requests[0]!.path).toMatch(/rpc\/save_business_working_hours$/);expect(requests[0]!.body).toMatchObject({target_business:bid,p_expected_updated_at:row.updated_at,p_enabled:true});expect(requests[0]!.body).not.toHaveProperty('status');
});
it('schema ausente é explícito; permissão recusada não é tratada como schema ausente',async()=>{
 let code='PGRST205';const f=vi.fn(async()=>new Response(JSON.stringify({code,message:'fixture'}),{status:code==='PGRST205'?404:403,headers:{'Content-Type':'application/json'}}));const c=client(f),repo=createHoursRepository(c,c);expect(await repo.available()).toBe(false);expect(await repo.get(bid)).toEqual({available:false,data:null});code='42501';await expect(repo.get(bid)).rejects.toMatchObject({code:'42501'});
});
it('RPC ausente ou conflito não cai em escrita alternativa',async()=>{
 const f=vi.fn(async()=>new Response(JSON.stringify({code:'PGRST202',message:'missing'}),{status:404,headers:{'Content-Type':'application/json'}})),c=client(f),repo=createHoursRepository(c,c);await expect(repo.save(bid,emptyHours())).rejects.toMatchObject({code:'PGRST202'});expect(f).toHaveBeenCalledOnce();
});
it('validação bloqueia horários sobrepostos antes da rede',async()=>{
 const f=vi.fn(),c=client(f),repo=createHoursRepository(c,c),h={...emptyHours(),enabled:true};h.schedule[1]=[{start:'08:00',end:'18:00'},{start:'13:00',end:'19:00'}];await expect(repo.save(bid,h)).rejects.toThrow(/sobrepostos/);expect(f).not.toHaveBeenCalled();
});
