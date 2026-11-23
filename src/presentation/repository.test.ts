import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Database } from '../lib/database.types';
import { createPresentationRepository } from './repository';
import { emptyPresentation } from './model';
function setup(missing=false, forbidden=false) {
 const calls:{side:string;path:string;body:Record<string,unknown>}[]=[];
 function client(side:string) { return createClient<Database>('https://example.supabase.co','sb_publishable_synthetic',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
  const url=new URL(String(input));calls.push({side,path:url.pathname,body:typeof init?.body==='string'?JSON.parse(init.body):{}});
  if(forbidden)return new Response(JSON.stringify({code:'42501',message:'Forbidden'}),{status:403,headers:{'Content-Type':'application/json'}});
  if(missing && url.searchParams.get('select')?.split(',').includes('profession'))return new Response(JSON.stringify({code:'42703',message:'column business_presentations.profession does not exist'}),{status:400,headers:{'Content-Type':'application/json'}});
  return new Response(url.pathname.includes('/rpc/')?null:JSON.stringify({...emptyPresentation,headline:'Salvo'}),{status:200,headers:{'Content-Type':'application/json'}});
 }}}); }
 return {repository:createPresentationRepository(client('private'),client('public')),calls};
}
describe('contrato da expansão de apresentação com transporte simulado',()=>{
 it('leitura pública usa cliente sem sessão e escrita usa RPC do negócio indicado',async()=>{
  const f=setup();await f.repository.get('business',true);await f.repository.save('business',{...emptyPresentation,profession:'Arquiteto',linkedin_url:'https://linkedin.com/in/exemplo'});
  expect(f.calls[0]?.side).toBe('public');expect(f.calls[1]?.side).toBe('private');expect(f.calls[1]?.path).toContain('/rpc/save_business_presentation_identity');
  expect(f.calls[1]?.body).toMatchObject({target_business:'business',p_profession:'Arquiteto',p_linkedin_url:'https://www.linkedin.com/in/exemplo'});
 });
 it('schema anterior mantém leitura e RPC anteriores sem descartar campos novos silenciosamente',async()=>{
  const f=setup(true);expect((await f.repository.get('business')).identityAvailable).toBe(false);
  await f.repository.save('business',{...emptyPresentation,headline:'Atualizado'});expect(f.calls.at(-1)?.path).toContain('/rpc/save_business_presentation');
  await expect(f.repository.save('business',{...emptyPresentation,profession:'Novo'})).rejects.toThrow('ativação autorizada');
 });
 it('erro de permissão não é confundido com migração ausente',async()=>{
  const f=setup(false,true);await expect(f.repository.get('business')).rejects.toMatchObject({code:'42501'});expect(f.calls).toHaveLength(1);
 });
 it('URL inválida é rejeitada antes de qualquer requisição',async()=>{
  const f=setup();await expect(f.repository.save('business',{...emptyPresentation,linkedin_url:'https://evil.test'})).rejects.toThrow('LinkedIn');expect(f.calls).toHaveLength(0);
 });
});
