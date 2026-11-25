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
