import {fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {expect,it,vi} from 'vitest';
import {App} from '../app/App';
import {createWorkFixtures,fixtureBusinessId as bid} from '../test/workFixtures';
import {postsFixtures,fixturePostId as pid} from '../test/postsFixtures';
import {marketplaceFixture} from '../test/marketplaceFixtures';
function open(path:string,readable=true,visitor=false){
 const work=createWorkFixtures(false,visitor),posts=postsFixtures('draft');
 if(!readable){vi.spyOn(work.professional,'getEditable').mockRejectedValue({code:'NOT_MANAGER'});vi.spyOn(posts.managed,'load').mockRejectedValue({code:'NOT_MANAGER'});}
 render(<MemoryRouter initialEntries={[path]}><App authGateway={work.gateway} professionalRepository={work.professional} workRepository={work.work} managedPosts={posts.managed} publicPosts={posts.publicPosts} marketplaceRepository={marketplaceFixture()}/></MemoryRouter>);return{work,posts};
}
it('responsável tem edição no menu discreto, e abrir/cancelar não grava',async()=>{
 const {posts}=open(`/conta/profissional/${bid}/perfil`),save=vi.spyOn(posts.managed,'save');fireEvent.click(await screen.findByRole('button',{name:'Abrir publicação Trabalho demonstrativo local'}));const dialog=screen.getByRole('dialog',{name:'Publicação'});
 expect(within(dialog).getByRole('button',{name:'Editar publicação'})).not.toBeVisible();
 fireEvent.click(within(dialog).getByRole('button',{name:'Opções da publicação'}));fireEvent.click(within(dialog).getByRole('button',{name:'Editar publicação'}));await screen.findByRole('dialog',{name:'Editar publicação'});fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));expect(save).not.toHaveBeenCalled();
});
it('Ver como cliente não oferece gerenciamento nem no detalhe nem no feed',async()=>{
 open(`/conta/profissional/${bid}/previa`);fireEvent.click(await screen.findByRole('button',{name:'Abrir publicação Trabalho demonstrativo local'}));let dialog=screen.getByRole('dialog',{name:'Publicação'});expect(within(dialog).queryByRole('button',{name:'Opções da publicação'})).not.toBeInTheDocument();expect(within(dialog).queryByRole('button',{name:'Editar publicação'})).not.toBeInTheDocument();expect(within(dialog).queryByRole('link',{name:'Gerenciar publicações'})).not.toBeInTheDocument();fireEvent.click(within(dialog).getByRole('button',{name:'Fechar'}));fireEvent.click(screen.getByRole('tab',{name:'Meu feed'}));const feed=screen.getByRole('region',{name:'Meu feed privado'});expect(feed).toHaveTextContent('Rascunho — só você vê');expect(within(feed).queryByRole('button',{name:'Opções da publicação'})).not.toBeInTheDocument();
});
it.each(['perfil','previa','publicacoes'])('visitante sem sessão não abre rota privada %s',async route=>{
 const {posts}=open(`/conta/profissional/${bid}/${route}`,true,true),load=vi.spyOn(posts.managed,'load');await screen.findByRole('heading',{name:'Entrar'});expect(load).not.toHaveBeenCalled();expect(screen.queryByText('Trabalho demonstrativo local')).not.toBeInTheDocument();
});
it('sessão de terceiro não obtém dados quando o servidor recusa o vínculo',async()=>{
 open(`/conta/profissional/${bid}/perfil`,false);await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Abrir publicação Trabalho demonstrativo local'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Opções da publicação'})).not.toBeInTheDocument();
});
it('post público não oferece gerenciamento para visitante',async()=>{
 open(`/trabalhos/${pid}`,true,true);await screen.findByRole('heading',{name:'Trabalho demonstrativo local'});expect(screen.getByRole('link',{name:'Conversar'})).toBeVisible();expect(screen.queryByRole('button',{name:'Opções da publicação'})).not.toBeInTheDocument();expect(screen.queryByRole('link',{name:'Gerenciar publicações'})).not.toBeInTheDocument();
});
