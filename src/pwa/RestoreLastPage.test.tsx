import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,useLocation,useNavigate} from 'react-router-dom';
import {afterEach,describe,expect,it} from 'vitest';
import {RestoreLastPage} from './RestoreLastPage';

function Controls(){
  const location=useLocation(),navigate=useNavigate();
  return <><output aria-label="Rota">{location.pathname}</output><button onClick={()=>navigate('/')}>Início</button></>;
}
function visit(path:string){return render(<MemoryRouter initialEntries={[path]}><RestoreLastPage/><Controls/></MemoryRouter>);}
afterEach(()=>sessionStorage.clear());
describe('retorno ao app instalado',()=>{
  it('recupera a última página ao iniciar pela URL do ícone',async()=>{
    const original=visit('/conta/profissional/123/perfil');
    original.unmount();
    visit('/?source=pwa');
    await waitFor(()=>expect(screen.getByLabelText('Rota')).toHaveTextContent('/conta/profissional/123/perfil'));
  });
  it('respeita o toque explícito em Início',async()=>{
    visit('/conta');
    fireEvent.click(screen.getByRole('button',{name:'Início'}));
    expect(screen.getByLabelText('Rota')).toHaveTextContent('/');
    expect(sessionStorage.getItem('pereirao.last-page')).toBe('/');
  });
  it('não redireciona para destinos externos ou sem permissão',()=>{
    sessionStorage.setItem('pereirao.last-page','//site-externo.test');
    visit('/?source=pwa');
    expect(screen.getByLabelText('Rota')).toHaveTextContent('/');
  });
});

it.each(['/publicacoes/00000000-0000-4000-8000-000000000001','/pessoas/00000000-0000-4000-8000-000000000002'])('recupera rota pessoal %s ao reabrir pela start_url',async path=>{
 const original=visit(path);original.unmount();visit('/?source=pwa');
 await waitFor(()=>expect(screen.getByLabelText('Rota')).toHaveTextContent(path));
});
it('focus, visibilitychange e BFCache não navegam da rota atual para Home',()=>{
 visit('/publicacoes/00000000-0000-4000-8000-000000000001');
 window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));
 const event=new Event('pageshow');Object.defineProperty(event,'persisted',{value:true});window.dispatchEvent(event);
 expect(screen.getByLabelText('Rota')).toHaveTextContent('/publicacoes/00000000-0000-4000-8000-000000000001');
});
