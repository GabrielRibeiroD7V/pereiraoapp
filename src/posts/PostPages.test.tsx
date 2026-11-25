import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {beforeEach,expect,it,vi} from 'vitest';
import {App} from '../app/App';
import {createWorkFixtures,fixtureBusinessId as bid} from '../test/workFixtures';
import {postsFixtures,fixturePostId as pid} from '../test/postsFixtures';
import {PostDates,postDateLabel} from './PostDates';
import {profileViews} from './postReturn';
import {safeReturnPath} from '../auth/returnPath';
const profile=`/conta/profissional/${bid}/perfil`,post=`/conta/profissional/${bid}/publicacoes/${pid}`;
function Route(){const loc=useLocation();return <output aria-label="rota">{loc.pathname}{loc.search}</output>;}
function open(path=profile,visitor=false,deny=false){const f=createWorkFixtures(false,visitor),p=postsFixtures('draft');if(deny)vi.spyOn(p.managed,'get').mockRejectedValue({code:'42501'});render(<MemoryRouter initialEntries={[path]}><Route/><App authGateway={f.gateway} professionalRepository={f.professional} workRepository={f.work} managedPosts={p.managed}/></MemoryRouter>);return p;}
beforeEach(()=>profileViews.clear());
it('abre página própria a partir do feed e volta à mesma seção sem modal',async()=>{open();await screen.findByRole('link',{name:'Abrir publicação Trabalho demonstrativo local'});fireEvent.click(screen.getByRole('tab',{name:'Trabalhos'}));fireEvent.click(screen.getByRole('link',{name:'Abrir publicação Trabalho demonstrativo local'}));await screen.findByRole('heading',{level:1,name:'Trabalho demonstrativo local'});expect(screen.getByLabelText('rota')).toHaveTextContent(post);expect(screen.queryByRole('dialog')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Voltar'}));await waitFor(()=>expect(screen.getByRole('tab',{name:'Trabalhos'})).toHaveAttribute('aria-selected','true'));});
it('URL privada direta carrega só o post do negócio e tem retorno seguro',async()=>{const p=open(post),get=vi.spyOn(p.managed,'get');await screen.findByRole('heading',{level:1,name:'Trabalho demonstrativo local'});expect(get).toHaveBeenCalledWith(bid,pid,expect.any(AbortSignal));expect(screen.getByRole('link',{name:'Voltar ao perfil'})).toHaveAttribute('href',profile);expect(screen.getByText('Rascunho — só você vê')).toBeVisible();expect(screen.queryByText(/Publicado hoje/)).not.toBeInTheDocument();});
it('URL direta da composição como cliente não exibe edição',async()=>{open(`/conta/profissional/${bid}/previa/publicacoes/${pid}`);await screen.findByRole('heading',{level:1,name:'Trabalho demonstrativo local'});expect(screen.queryByRole('button',{name:'Opções da publicação'})).not.toBeInTheDocument();expect(screen.getByRole('link',{name:'Conferir serviços'})).toHaveAttribute('href',`/conta/profissional/${bid}/previa#servicos`);});
it('anônimo precisa entrar e mantém destino privado, sem consultar o rascunho',async()=>{const p=open(post,true),get=vi.spyOn(p.managed,'get');await screen.findByRole('heading',{name:'Entrar'});expect(screen.getByLabelText('rota')).toHaveTextContent(`/entrar?next=${encodeURIComponent(post)}`);expect(get).not.toHaveBeenCalled();});
it('recusa do servidor em outra conta não revela título ou imagens',async()=>{open(post,false,true);await screen.findByRole('alert');expect(screen.queryByText('Trabalho demonstrativo local')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Opções da publicação'})).not.toBeInTheDocument();});
it('retorno pós-login aceita somente URLs internas de post com UUIDs válidos',()=>{expect(safeReturnPath(post)).toBe(post);expect(safeReturnPath(profile)).toBe(profile);expect(safeReturnPath('//evil.test')).toBe('/conta');expect(safeReturnPath(post.replace(pid,'------------------------------------'))).toBe('/conta');});
it('datas usam dia local real do post, nunca uma data de upload',()=>{const now=new Date(2026,10,24,12);expect(postDateLabel(new Date(2026,10,24,8,30).toISOString(),now)).toBe('hoje às 08:30');expect(postDateLabel(new Date(2026,10,23,23,30).toISOString(),now)).toBe('ontem às 23:30');expect(postDateLabel(new Date(2026,10,20,8,30).toISOString(),now)).toContain('20/11/2026');expect(postDateLabel('inválida',now)).toBeNull();});
it('rascunho mostra criação e nenhum horário de publicação inventado',()=>{const {container}=render(<PostDates createdAt="2026-11-24T04:32:11Z" publishedAt={null}/>);expect(container.querySelectorAll('time')).toHaveLength(1);expect(container.querySelector('time')).toHaveAttribute('datetime','2026-11-24T04:32:11Z');expect(screen.getByText(/^Criado/)).toBeVisible();expect(screen.queryByText(/^Publicado/)).not.toBeInTheDocument();});
it('aceita retorno de perfil pessoal e Home com query sem redirecionar para outra origem',async()=>{
 const {validPostOrigin}=await import('./PostBackLink');
 expect(validPostOrigin({key:'entry',path:'/?source=pwa'})).toBe(true);
 expect(validPostOrigin({key:'entry',path:'/pessoas/00000000-0000-4000-8000-000000000001'})).toBe(true);
 expect(validPostOrigin({key:'entry',path:'//evil.test/conta'})).toBe(false);
});
