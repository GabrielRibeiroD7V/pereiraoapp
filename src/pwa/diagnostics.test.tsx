import {render,screen,fireEvent,waitFor} from '@testing-library/react';import {MemoryRouter} from 'react-router-dom';import {describe,it,expect,vi} from 'vitest';
import {PwaProvider,VersionDiagnostics} from './PwaProvider';import {pwaFixture} from '../test/pwaFixtures';
import {AppShell} from '../components/AppShell';
import {Route,Routes} from 'react-router-dom';
const A='aaaaaaaaaaaaaaaaaaaa';
describe('diagnóstico sob demanda sem dados privados',()=>{
 it('não expõe o painel técnico na navegação normal, mas permite abri-lo por URL de diagnóstico',()=>{
  const f=pwaFixture();
  const shell=(path:string)=>render(<MemoryRouter initialEntries={[path]}><PwaProvider controller={f.controller}><Routes><Route element={<AppShell/>}><Route index element={<p>Página inicial</p>}/></Route></Routes></PwaProvider></MemoryRouter>);
  const normal=shell('/');expect(screen.queryByRole('button',{name:'Versão e atualização'})).not.toBeInTheDocument();normal.unmount();
  shell('/?pwa-diagnostico=1');expect(screen.getByRole('button',{name:'Versão e atualização'})).toBeInTheDocument();f.controller.dispose();
 });
 it('lista somente caches estáticos próprios, sem ler conteúdo/Auth/sessão',async()=>{
  const f=pwaFixture({version:A});Object.assign(f.browser,{caches:{keys:vi.fn(async()=>['outro-cache-privado','pereirao-static-'+A,'pereirao-static-segredo'])}});
  const result=await f.controller.diagnostics();expect(result.staticCacheVersions).toEqual([A]);expect(result.origin).toBe('https://pereirao.example');
  expect(Object.keys(result).sort()).toEqual(['origin','installed','running','published','publishedCheckedAt','online','controller','active','waiting','installing','staticCacheVersions','restoredFromHistory'].sort());
  expect([...f.storage.keys()]).toEqual([]);f.controller.dispose();
 });
 it('mostra origem, builds e worker desconhecido sem inventar versão de instalação legada',async()=>{
  const f=pwaFixture();vi.spyOn(f.controller,'diagnostics').mockResolvedValue({origin:'https://preview.vercel.app',installed:false,running:A,published:A,publishedCheckedAt:null,online:true,controller:null,active:{state:'activated',version:null},waiting:null,installing:null,staticCacheVersions:[],restoredFromHistory:null});
  render(<MemoryRouter><PwaProvider controller={f.controller}><VersionDiagnostics/></PwaProvider></MemoryRouter>);
  expect(f.controller.diagnostics).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Versão e atualização'}));
  expect(await screen.findByRole('dialog',{name:'Versão do PEREIRÃO'})).toBeInTheDocument();await waitFor(()=>expect(screen.getByText('https://preview.vercel.app')).toBeInTheDocument());
  expect(screen.getByText(/Um worker antigo pode não informar/)).toBeInTheDocument();expect(screen.getByText(/Esta origem não é o endereço oficial/)).toBeInTheDocument();
  expect(f.browser.location.reload).not.toHaveBeenCalled();f.controller.dispose();
 });
});
