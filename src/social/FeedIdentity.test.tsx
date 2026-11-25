import{render,screen,within,waitFor}from'@testing-library/react';
import{MemoryRouter}from'react-router-dom';import{it,expect,vi}from'vitest';
import{SocialFeed}from'./SocialFeed';import{SocialProvider}from'./SocialProvider';
import{AuthProvider}from'../auth/AuthProvider';import{ProfessionalProvider}from'../professional/ProfessionalProvider';
import{MarketplaceProvider}from'../marketplace/MarketplaceProvider';import{marketplaceFixture,publicProviderFixture as p}from'../test/marketplaceFixtures';
import{createWorkFixtures,fixtureImage,fixtureBusinessId}from'../test/workFixtures';import type{SocialPost,SocialRepository}from'./model';
const post:SocialPost={id:'00000000-0000-4000-8000-000000000201',kind:'professional',businessId:fixtureBusinessId,authorId:null,author:'Autor do teste local',title:'Projeto local',description:'Legenda integral informada no teste.',status:'published',createdAt:'2026-11-20T10:00:00Z',publishedAt:'2026-11-24T12:00:00Z',profileUrl:'/prestadores/prestador-simulado',images:[{id:'photo',bucket:'business-portfolio',path:'local/test.webp'}]};
function open({owner=false,unavailable=false,duplicate=false}={}){
 const w=createWorkFixtures(false,!owner),m=marketplaceFixture();
 const get=vi.spyOn(m,'getProvider').mockResolvedValue(unavailable?null:{...p,avatarPath:`${fixtureBusinessId}/profile/local.webp`});
 const image=vi.spyOn(m,'getImageUrl'),mine=vi.spyOn(w.professional,'listMine');
 const r={feed:async()=>({items:duplicate?[post,{...post,id:'00000000-0000-4000-8000-000000000202',title:'Outro projeto'}]:[post],hasNext:false}),image:async()=>fixtureImage} as unknown as SocialRepository;
 render(<MemoryRouter><AuthProvider gateway={w.gateway}><ProfessionalProvider repository={w.professional}><MarketplaceProvider repository={m}><SocialProvider repository={r}><SocialFeed/></SocialProvider></MarketplaceProvider></ProfessionalProvider></AuthProvider></MemoryRouter>);
 return{get,image,mine};
}
it('feed usa foto pública do autor, legenda, data absoluta e destinos reais de contato',async()=>{
 const{image}=open();const contact=await screen.findByRole('link',{name:/Entrar em contato pelo WhatsApp/});expect(contact).toHaveAttribute('href',expect.stringContaining('https://wa.me/'));
 const author=screen.getByRole('link',{name:post.author});expect(author).toHaveAttribute('href',post.profileUrl);await waitFor(()=>expect(author.querySelector('img')).toBeInTheDocument());
 expect(image).toHaveBeenCalledWith(p.id,expect.stringContaining('/profile/'));
 expect(screen.getByRole('link',{name:`Solicitar orçamento a ${post.author}`})).toHaveAttribute('href',`/mensagens/projeto/${post.id}`);
 expect(screen.getByText(post.description)).toBeVisible();expect(document.querySelector('time')).toHaveAttribute('datetime',post.publishedAt);expect(document.querySelector('time')).toHaveTextContent('24/11/2026');
 expect(within(screen.getByRole('region',{name:'Fotos de '+post.title})).queryByRole('link')).not.toBeInTheDocument();
});
it('perfil não público ou indisponível não fornece foto nem WhatsApp ao feed',async()=>{
 const{get,image}=open({unavailable:true});await screen.findByText(post.description);await waitFor(()=>expect(get).toHaveBeenCalledOnce());
 expect(image).not.toHaveBeenCalled();expect(screen.queryByRole('link',{name:/WhatsApp/})).not.toBeInTheDocument();expect(screen.queryByRole('link',{name:/Solicitar orçamento/})).not.toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Entrar em contato'})).toHaveAttribute('href',`/mensagens/projeto/${post.id}`);
});
it('autor profissional autenticado não recebe ações de contato consigo mesmo',async()=>{
 const{mine}=open({owner:true});await screen.findByText(post.description);await waitFor(()=>expect(mine).toHaveBeenCalled());
 expect(screen.queryByRole('link',{name:/Entrar em contato|Solicitar orçamento/})).not.toBeInTheDocument();
});
it('várias publicações do mesmo autor compartilham uma consulta pública de perfil',async()=>{
 const{get}=open({duplicate:true});await screen.findByText('Outro projeto');await screen.findAllByRole('link',{name:/Solicitar orçamento/});expect(get).toHaveBeenCalledOnce();
});
