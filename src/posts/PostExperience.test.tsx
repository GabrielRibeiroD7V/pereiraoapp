import {beforeEach} from 'vitest';
import {profileViews} from '../posts/postReturn';
beforeEach(()=>profileViews.clear());
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {expect,it,vi} from 'vitest';
import {App} from '../app/App';
import {createWorkFixtures,fixtureBusinessId as bid} from '../test/workFixtures';
import {postsFixtures,fixturePostId as pid} from '../test/postsFixtures';
import {marketplaceFixture} from '../test/marketplaceFixtures';
const ownPath=`/conta/profissional/${bid}/perfil`;
function Route(){const location=useLocation();return <output aria-label="Rota do teste">{location.pathname}{location.search}{location.hash}</output>;}
function open(path=ownPath,visitor=false,posts=postsFixtures('draft'),work=createWorkFixtures(false,visitor)){
 const market=marketplaceFixture();
 render(<MemoryRouter initialEntries={[path]}><Route/><App authGateway={work.gateway} professionalRepository={work.professional} workRepository={work.work} marketplaceRepository={market} managedPosts={posts.managed} publicPosts={posts.publicPosts}/></MemoryRouter>);
 return {posts,work,market};
}
it('perfil apresenta capas; abre composição completa e gerenciamento sem contato consigo mesmo',async()=>{
 const {posts}=open();const command=vi.spyOn(posts.managed,'command');
 const button=await screen.findByRole('link',{name:'Abrir publicação Trabalho demonstrativo local'});
 expect(button.closest('.profile-post-grid')).toBeInTheDocument();expect(button).toHaveTextContent('Rascunho — só você vê');
 expect(button.querySelector('.photo-carousel')).toBeNull();
 fireEvent.click(button);const dialog=await screen.findByRole('article',{name:'Trabalho demonstrativo local'});
 expect(within(dialog).getAllByRole('figure')).toHaveLength(2);expect(dialog).toHaveTextContent('Descrição simulada');
 expect(within(dialog).getByRole('link',{name:'Conferir serviços'})).toHaveAttribute('href',`${ownPath}#servicos`);
 expect(within(dialog).queryByRole('link',{name:'Conversar'})).not.toBeInTheDocument();
 fireEvent.click(within(dialog).getByRole('button',{name:'Opções da publicação'}));
 fireEvent.click(within(dialog).getByRole('button',{name:'Editar publicação'}));
 await screen.findByRole('dialog',{name:'Editar publicação'});fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));expect(command).not.toHaveBeenCalled();
});
it('editar a publicação atualiza imediatamente capa, feed e detalhe; cancelar outra edição não grava',async()=>{
 const {posts}=open();const save=vi.spyOn(posts.managed,'save');
 fireEvent.click(await screen.findByRole('link',{name:'Abrir publicação Trabalho demonstrativo local'}));
 fireEvent.click(within(await screen.findByRole('article',{name:'Trabalho demonstrativo local'})).getByRole('button',{name:'Opções da publicação'}));
 fireEvent.click(within(await screen.findByRole('article',{name:'Trabalho demonstrativo local'})).getByRole('button',{name:'Editar publicação'}));
 fireEvent.change(await screen.findByLabelText('Título do trabalho'),{target:{value:'Título atualizado no teste'}});
 fireEvent.change(screen.getByLabelText('Legenda ou descrição da publicação'),{target:{value:'Legenda atualizada no teste'}});
 fireEvent.click(screen.getByRole('button',{name:'Confirmar fotos e salvar rascunho'}));
 await screen.findByRole('heading',{name:'Título atualizado no teste'});fireEvent.click(screen.getByRole('button',{name:'Voltar'}));await screen.findByRole('link',{name:'Abrir publicação Título atualizado no teste'});expect(save).toHaveBeenCalledOnce();
 fireEvent.click(screen.getByRole('tab',{name:'Meu feed'}));
 const feed=screen.getByRole('region',{name:'Meu feed privado'});expect(feed).toHaveTextContent('Legenda atualizada no teste');expect(feed).toHaveTextContent('Rascunho — só você vê');
 expect(within(feed).getAllByRole('figure')).toHaveLength(2);expect(within(feed).queryByRole('link',{name:'Conversar'})).not.toBeInTheDocument();
 fireEvent.click(within(feed).getByRole('button',{name:'Opções da publicação'}));
 fireEvent.click(within(feed).getByRole('button',{name:'Editar publicação'}));fireEvent.change(await screen.findByLabelText('Título do trabalho'),{target:{value:'Não salvar'}});fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));expect(save).toHaveBeenCalledOnce();
});
it('feed privado revalida no retorno sem converter a foto avulsa nem publicar',async()=>{
 const {posts,work}=open();await screen.findByRole('link',{name:'Abrir publicação Trabalho demonstrativo local'});
 await posts.managed.save(bid,pid,{title:'Salvo em outra aba',description:'Conteúdo revalidado',photos:posts.snapshot()[0]!.images});
 const command=vi.spyOn(posts.managed,'command');const initial=work.snapshot().photos.length;
 act(()=>window.dispatchEvent(new Event('focus')));
 fireEvent.click(screen.getByRole('tab',{name:'Meu feed'}));
 await waitFor(()=>expect(screen.getByRole('region',{name:'Meu feed privado'})).toHaveTextContent('Salvo em outra aba'));
 expect(work.snapshot().photos).toHaveLength(initial);expect(command).not.toHaveBeenCalled();expect(posts.snapshot()[0]?.status).toBe('draft');
});
it('falha no carregamento de posts tem tentativa explícita em vez de parecer feed vazio',async()=>{
 const posts=postsFixtures('draft');vi.spyOn(posts.managed,'load').mockRejectedValueOnce(new Error('offline'));
 open(ownPath,false,posts);await screen.findByRole('alert');expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar as publicações');
 fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));await screen.findByRole('link',{name:'Abrir publicação Trabalho demonstrativo local'});
});
it('detalhe público oferece negócio correto, serviços, WhatsApp e login com destino da conversa',async()=>{
 open(`/trabalhos/${pid}`,true);await screen.findByRole('heading',{name:'Trabalho demonstrativo local'});
 expect(screen.getByRole('link',{name:'Conferir serviços'})).toHaveAttribute('href','/prestadores/prestador-simulado#servicos');
 expect(await screen.findByRole('link',{name:/WhatsApp de/})).toHaveAttribute('href',expect.stringContaining('https://wa.me/'));
 fireEvent.click(screen.getByRole('link',{name:'Conversar'}));await screen.findByRole('heading',{name:'Entrar'});
 expect(screen.getByLabelText('Rota do teste')).toHaveTextContent(`/entrar?next=${encodeURIComponent(`/mensagens/iniciar/${bid}`)}`);
});
it('responsável autenticado vê gerenciamento no post público e nenhum contato próprio',async()=>{
 open(`/trabalhos/${pid}`);fireEvent.click(await screen.findByRole('button',{name:'Opções da publicação'}));await screen.findByRole('link',{name:'Gerenciar publicações'});
 expect(screen.queryByRole('link',{name:'Conversar'})).not.toBeInTheDocument();expect(screen.queryByRole('link',{name:/WhatsApp de/})).not.toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Conferir serviços'})).toHaveAttribute('href',`${ownPath}#servicos`);
});
it('contato inexistente não é inventado e visitante autenticado pode conversar com outro negócio',async()=>{
 const work=createWorkFixtures();vi.spyOn(work.professional,'listMine').mockResolvedValue([]);
 const market=marketplaceFixture(),get=market.getProvider;market.getProvider=async(...args)=>{const p=await get(...args);return p?{...p,whatsapp:null,instagram:null}:null;};
 const posts=postsFixtures();render(<MemoryRouter initialEntries={[`/trabalhos/${pid}`]}><App authGateway={work.gateway} professionalRepository={work.professional} marketplaceRepository={market} publicPosts={posts.publicPosts}/></MemoryRouter>);
 await screen.findByRole('link',{name:'Conversar'});expect(screen.queryByRole('link',{name:/WhatsApp de/})).not.toBeInTheDocument();
});
it('Home reconsulta trabalhos publicados quando a aba retorna, sem consultar posts privados',async()=>{
 const posts=postsFixtures();const load=vi.spyOn(posts.publicPosts,'list').mockResolvedValueOnce({items:[],next:null}).mockResolvedValue({items:[posts.work],next:null});const privateLoad=vi.spyOn(posts.managed,'load');
 open('/',true,posts);await screen.findByText('Novos trabalhos em breve.');act(()=>window.dispatchEvent(new Event('focus')));
 await screen.findByRole('link',{name:'Abrir trabalho Trabalho demonstrativo local'});expect(load).toHaveBeenCalledTimes(2);expect(privateLoad).not.toHaveBeenCalled();
});
it('link de serviços aguarda a seção do negócio e posiciona o destino',async()=>{
 const scroll=vi.fn();Element.prototype.scrollIntoView=scroll;
 open('/prestadores/prestador-simulado#servicos',true);await screen.findByText('Instalação simulada');await waitFor(()=>expect(scroll).toHaveBeenCalled());
 expect(screen.getByRole('region',{name:'Serviços e preços'})).toHaveAttribute('id','servicos');delete (Element.prototype as {scrollIntoView?:unknown}).scrollIntoView;
});
