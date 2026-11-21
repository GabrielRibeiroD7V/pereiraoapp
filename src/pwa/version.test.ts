import { describe,it,expect,vi } from 'vitest';
import { pwaFixture } from '../test/pwaFixtures';
const A='aaaaaaaaaaaaaaaaaaaa', B='bbbbbbbbbbbbbbbbbbbb';
describe('reprodução: versão antiga no retorno ao aplicativo',()=>{
  it('detecta outra versão publicada ao restaurar pelo histórico',async()=>{
    const f=pwaFixture({enabled:true,version:A,published:B});
    await vi.waitFor(()=>expect(f.controller.getSnapshot().worker).toBe('ready'));
    const restore=new Event('pageshow');Object.defineProperty(restore,'persisted',{value:true});f.browser.dispatchEvent(restore);
    await vi.waitFor(()=>expect(f.browser.fetch).toHaveBeenCalled());
    expect(f.controller.getSnapshot()).toMatchObject({runningVersion:A,publishedVersion:B});
    f.controller.dispose();
  });
  it('não deixa um worker waiting indefinidamente em página pública segura',async()=>{
    const f=pwaFixture({enabled:true,waiting:true,version:A,published:B});
    await vi.waitFor(()=>expect(f.waiting.postMessage).toHaveBeenCalledWith({type:'PEREIRAO_ACTIVATE_UPDATE'}));
    f.serviceWorker.dispatchEvent(new Event('controllerchange'));
    expect(f.browser.location.reload).toHaveBeenCalledOnce();
    f.controller.dispose();
  });
});
describe('atualização segura, concorrente e offline',()=>{
  it.each(['focus','pageshow'])('verifica a versão no evento %s',async name=>{
    const f=pwaFixture({enabled:true,version:A});
    await vi.waitFor(()=>expect(f.browser.fetch).toHaveBeenCalledOnce());
    await f.controller.checkForUpdate(); const before=f.browser.fetch.mock.calls.length;
    f.browser.dispatchEvent(new Event(name));
    await vi.waitFor(()=>expect(f.browser.fetch.mock.calls.length).toBe(before+1));
    expect(f.browser.location.reload).not.toHaveBeenCalled(); f.controller.dispose();
  });
  it('deduplica verificações simultâneas de retorno e histórico',async()=>{
    const f=pwaFixture({enabled:true,version:A});
    await vi.waitFor(()=>expect(f.browser.fetch).toHaveBeenCalledOnce()); await f.controller.checkForUpdate();
    let finish!: (value: Awaited<ReturnType<typeof f.browser.fetch>>) => void;
    f.browser.fetch.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const first=f.controller.checkForUpdate(true),second=f.controller.checkForUpdate(true);
    f.browser.dispatchEvent(new Event('focus'));f.browser.dispatchEvent(new Event('pageshow'));
    expect(f.browser.fetch).toHaveBeenCalledTimes(2);
    finish({ok:true,headers:new Headers({'Content-Type':'application/json'}),json:async()=>({version:A})});
    await Promise.all([first,second]); expect(f.browser.location.reload).not.toHaveBeenCalled();f.controller.dispose();
  });
  it('não atualiza automaticamente conta/admin, mesmo com worker pronto',async()=>{
    const f=pwaFixture({enabled:true,waiting:true,version:A,published:B});f.browser.location.pathname='/conta/profissional/cadastro';
    await vi.waitFor(()=>expect(f.controller.getSnapshot().publishedVersion).toBe(B));
    expect(f.browser.location.reload).not.toHaveBeenCalled();
    expect(f.waiting.postMessage.mock.calls.some(([data])=>data.type==='PEREIRAO_ACTIVATE_UPDATE')).toBe(false);
    f.controller.dispose();
  });
  it('preserva formulário editado quando OUTRA aba assume o worker',async()=>{
    const f=pwaFixture({enabled:true,waiting:true,version:A});
    await vi.waitFor(()=>expect(f.controller.getSnapshot().worker).toBe('ready'));
    const form=document.createElement('form');document.body.append(form);
    const event=new Event('input');Object.defineProperty(event,'target',{value:form});f.browser.document.dispatchEvent(event);
    f.serviceWorker.dispatchEvent(new Event('controllerchange'));
    await f.controller.checkForUpdate(true);
    expect(f.browser.location.reload).not.toHaveBeenCalled();
    expect(form.isConnected).toBe(true);
    f.browser.confirm.mockReturnValueOnce(false);f.controller.update();
    expect(f.browser.confirm).toHaveBeenCalledOnce();expect(f.browser.location.reload).not.toHaveBeenCalled();
    form.remove();f.controller.dispose();
  });
  it('revalida antes de recarregar se o usuário começar a editar durante a ativação',async()=>{
    const f=pwaFixture({enabled:true,waiting:true,version:A,published:B});
    await vi.waitFor(()=>expect(f.controller.getSnapshot().updating).toBe(true));
    const input=document.createElement('input');document.body.append(input);
    const event=new Event('input');Object.defineProperty(event,'target',{value:input});f.browser.document.dispatchEvent(event);
    f.serviceWorker.dispatchEvent(new Event('controllerchange'));
    expect(f.browser.location.reload).not.toHaveBeenCalled();expect(f.controller.getSnapshot().refreshRequired).toBe(true);
    input.remove();f.controller.dispose();
  });
  it('consulta versão sem cookies/cache e não guarda dados do usuário',async()=>{
    const f=pwaFixture({enabled:true,version:A});await vi.waitFor(()=>expect(f.browser.fetch).toHaveBeenCalledOnce());
    expect(f.browser.fetch).toHaveBeenCalledWith('/version.json',expect.objectContaining({cache:'no-store',credentials:'omit',redirect:'error'}));
    expect([...f.storage.keys()]).toEqual([]);f.controller.dispose();
  });
  it('não entra em loop se o navegador entregar novamente a mesma página antiga',async()=>{
    const f=pwaFixture({enabled:true,version:A});await vi.waitFor(()=>expect(f.browser.fetch).toHaveBeenCalledOnce());await f.controller.checkForUpdate();
    f.storage.set('pereirao.update.attempt',B);
    f.browser.fetch.mockResolvedValue({ok:true,headers:new Headers({'Content-Type':'application/json'}),json:async()=>({version:B})});
    await f.controller.checkForUpdate(true);await f.controller.checkForUpdate(true);
    expect(f.controller.getSnapshot().refreshRequired).toBe(true);expect(f.browser.location.reload).not.toHaveBeenCalled();f.controller.dispose();
  });
  it('não invalida a página em falha de rede e volta a verificar ao reconectar',async()=>{
    const f=pwaFixture({enabled:true,version:A});await vi.waitFor(()=>expect(f.browser.fetch).toHaveBeenCalledOnce());await f.controller.checkForUpdate();
    f.browser.fetch.mockRejectedValueOnce(new Error('offline'));await f.controller.checkForUpdate(true);
    expect(f.controller.getSnapshot().publishedVersion).toBe(A);expect(f.browser.location.reload).not.toHaveBeenCalled();
    f.browser.dispatchEvent(new Event('offline'));await f.controller.checkForUpdate(true);const count=f.browser.fetch.mock.calls.length;
    f.browser.dispatchEvent(new Event('online'));f.browser.dispatchEvent(new Event('pageshow'));
    await vi.waitFor(()=>expect(f.browser.fetch.mock.calls.length).toBeGreaterThan(count));
    expect(f.controller.getSnapshot().sessionRefreshRequired).toBe(true);f.controller.dispose();
  });
  it('não usa HTML de rewrite/proteção como versão',async()=>{
    const f=pwaFixture({enabled:true,version:A});await vi.waitFor(()=>expect(f.browser.fetch).toHaveBeenCalledOnce());await f.controller.checkForUpdate();
    f.browser.fetch.mockResolvedValueOnce({ok:true,headers:new Headers({'Content-Type':'text/html'}),json:async()=>({version:B})});
    await f.controller.checkForUpdate(true);expect(f.controller.getSnapshot().publishedVersion).toBe(A);expect(f.browser.location.reload).not.toHaveBeenCalled();f.controller.dispose();
  });
});

it('não exige reload extra quando o worker muda mas a página já executa o build publicado',async()=>{
 const f=pwaFixture({enabled:true,waiting:true,version:A});
 await vi.waitFor(()=>expect(f.controller.getSnapshot().publishedVersion).toBe(A));
 f.serviceWorker.dispatchEvent(new Event('controllerchange'));
 await vi.waitFor(()=>expect(f.controller.getSnapshot().refreshRequired).toBe(false));
 expect(f.browser.location.reload).not.toHaveBeenCalled();f.controller.dispose();
});
