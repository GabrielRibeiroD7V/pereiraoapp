// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {productionReadOnlyPreflight} from '../scripts/preflight-asaas-production.mjs';
const env={VERCEL_ENV:'production',ASAAS_PRODUCTION_PREFLIGHT_READ_ONLY:'true',ASAAS_API_KEY_PRODUCTION:'$aact_prod_fixture_only'};
it('faz um único GET oficial sem ativar receptor e descarta campos privados',async()=>{
 const request=vi.fn(async()=>Response.json({commercialInfo:'APPROVED',bankAccountInfo:'APPROVED',documentation:'APPROVED',general:'APPROVED',id:'PRIVATE_ID',name:'PRIVATE_NAME',unexpected:env.ASAAS_API_KEY_PRODUCTION}));
 const result=await productionReadOnlyPreflight(env,request);
 expect(request).toHaveBeenCalledExactlyOnceWith('https://api.asaas.com/v3/myAccount/status/',expect.objectContaining({method:'GET',redirect:'error'}));
 expect(request.mock.calls[0][1].body).toBeUndefined();expect(result.state).toBe('connected');
 expect(result.account.general).toBe('APPROVED');expect(JSON.stringify(result)).not.toMatch(/PRIVATE|aact/);
});
it.each([{VERCEL_ENV:'preview'},{ASAAS_PRODUCTION_PREFLIGHT_READ_ONLY:undefined},{ASAAS_PRODUCTION_WEBHOOK_ENABLED:'true'},...['CHECKOUT','SUBSCRIPTIONS','CHARGES','ENFORCEMENT','PIX'].map(n=>({[`ASAAS_PRODUCTION_${n}_ENABLED`]:'true'})),{ASAAS_API_KEY_PRODUCTION:'$aact_hmlg_fixture'},{ASAAS_API_KEY_PRODUCTION:' $aact_prod_fixture'},{ASAAS_API_KEY_PRODUCTION:'$aact_prod_fixture\n'},{ASSAS_API_KEY_SANDBOX:env.ASAAS_API_KEY_PRODUCTION}])('recusa ambiente, configuração ou chave inadequada sem requisição: %j',async patch=>{
 const request=vi.fn();await productionReadOnlyPreflight({...env,...patch},request);expect(request).not.toHaveBeenCalled();
});
it('não divulga corpo de erro ou erro de rede',async()=>{
 for(const response of [new Response('PRIVATE_ERROR',{status:401}),new Response('PRIVATE_ERROR',{status:403}),Response.redirect('https://example.invalid',302)]){
 const result=await productionReadOnlyPreflight(env,async()=>response);expect(result.state).toBe('not_validated');expect(JSON.stringify(result)).not.toContain('PRIVATE');}
 const result=await productionReadOnlyPreflight(env,async()=>{throw new Error(env.ASAAS_API_KEY_PRODUCTION)});expect(result).toEqual({state:'communication_error'});
});
it('limita JSON e não reflete estados desconhecidos',async()=>{
 expect((await productionReadOnlyPreflight(env,async()=>Response.json({general:'PRIVATE'}))).account.general).toBe('UNKNOWN');
 expect((await productionReadOnlyPreflight(env,async()=>Response.json({large:'a'.repeat(70000)}))).state).toBe('communication_error');
});
