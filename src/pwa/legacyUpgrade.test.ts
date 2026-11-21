import {describe,it,expect,vi} from 'vitest';
import {PwaController as Legacy19} from '../test/fixtures/pwa/pr19-controller';
import {PwaController as Legacy22} from '../test/fixtures/pwa/pr22-controller';
import {pwaFixture} from '../test/pwaFixtures';
const A='aaaaaaaaaaaaaaaaaaaa',B='bbbbbbbbbbbbbbbbbbbb';
function historic(Controller: typeof Legacy19 | typeof Legacy22){const f=pwaFixture({waiting:true,version:A,published:A});f.controller.dispose();const old=new Controller(f.browser as unknown as Window,f.device as unknown as Navigator,true);old.start();return {...f,old};}
describe('migração de instalações existentes, sem apagar storage',()=>{
 it('reproduz PR22: página atual com worker em espera nunca o ativa automaticamente',async()=>{
  const f=historic(Legacy22);await vi.waitFor(()=>expect(f.old.getSnapshot().updateReady).toBe(true));await f.old.checkForUpdate();
  expect(f.waiting.postMessage.mock.calls.some(([m])=>m.type==='PEREIRAO_ACTIVATE_UPDATE')).toBe(false);f.old.dispose();
 });
 it.each(['PR19','PR20','PR21'])('%s: controlador histórico preserva a aba até atualização explícita; sessão e rota ficam intactas',async()=>{
  // Os três commits têm controller SHA-256 190fd3536bea389771fab205c5cd0abf69f1020572913cba15b22cfca850b146.
  const f=historic(Legacy19);f.browser.location.pathname='/conta/profissional/cadastro';f.storage.set('sentinela-sessao','preservar');
  await vi.waitFor(()=>expect(f.old.getSnapshot().updateReady).toBe(true));expect(f.browser.location.reload).not.toHaveBeenCalled();
  f.old.update();f.serviceWorker.dispatchEvent(new Event('controllerchange'));expect(f.browser.location.reload).toHaveBeenCalledOnce();
  expect(f.storage.get('sentinela-sessao')).toBe('preservar');expect(f.browser.location.pathname).toBe('/conta/profissional/cadastro');f.old.dispose();
 });
 it('corrige PR22: ativa worker do MESMO build publicado sem recarregar a página já atual',async()=>{
  const f=pwaFixture({enabled:true,waiting:true,version:A,published:A});
  await vi.waitFor(()=>expect(f.waiting.postMessage).toHaveBeenCalledWith({type:'PEREIRAO_ACTIVATE_UPDATE',protocol:1}));
  f.serviceWorker.dispatchEvent(new Event('controllerchange'));expect(f.browser.location.reload).not.toHaveBeenCalled();
  expect(f.controller.getSnapshot().refreshRequired).toBe(false);f.controller.dispose();
 });
 it('não ativa candidato de versão diferente da publicada nem worker sem protocolo por adivinhação',async()=>{
  const f=pwaFixture({enabled:true,waiting:true,version:A,published:B,workerVersion:A});
  await f.controller.checkForUpdate(true);expect(f.waiting.postMessage.mock.calls.some(([m])=>m.type==='PEREIRAO_ACTIVATE_UPDATE')).toBe(false);f.controller.dispose();
 });
});
it('preserva formulário/rota privada quando página e worker waiting têm o mesmo build',async()=>{
 const f=pwaFixture({enabled:true,waiting:true,version:A});f.browser.location.pathname='/conta/profissional/cadastro';
 await vi.waitFor(()=>expect(f.controller.getSnapshot().publishedVersion).toBe(A));await f.controller.checkForUpdate(true);
 expect(f.waiting.postMessage.mock.calls.some(([m])=>m.type==='PEREIRAO_ACTIVATE_UPDATE')).toBe(false);
 expect(f.browser.location.reload).not.toHaveBeenCalled();f.controller.dispose();
});
it('worker sem protocolo não é identificado como build atual por adivinhação',async()=>{
 const f=pwaFixture({enabled:true,waiting:true,version:A,workerVersion:null});
 await vi.waitFor(()=>expect(f.controller.getSnapshot().worker).toBe('ready'));await f.controller.checkForUpdate(true);
 expect(f.waiting.postMessage.mock.calls.some(([m])=>m.type==='PEREIRAO_ACTIVATE_UPDATE')).toBe(false);f.controller.dispose();
});
it('reproduz referência obsoleta PR19–21: após ativação por outra aba, botão antigo envia ao worker já ativo',async()=>{
 const f=historic(Legacy19);await vi.waitFor(()=>expect(f.old.getSnapshot().updateReady).toBe(true));
 f.registration.waiting=null;f.serviceWorker.dispatchEvent(new Event('controllerchange'));
 f.old.update();expect(f.waiting.postMessage).toHaveBeenCalledWith({type:'PEREIRAO_ACTIVATE_UPDATE'});
 expect(f.browser.location.reload).not.toHaveBeenCalled();f.old.dispose();
});
