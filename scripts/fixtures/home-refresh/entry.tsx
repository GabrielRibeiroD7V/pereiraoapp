// Somente QA local: componentes reais, API interceptada, nenhuma escrita remota.
import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';
import{App}from'../../../src/app/App';import{marketplaceFixture}from'../../../src/test/marketplaceFixtures';import{postsFixtures}from'../../../src/test/postsFixtures';import{createWorkFixtures}from'../../../src/test/workFixtures';import'../../../src/styles/main.scss';
const params=new URLSearchParams(location.search),populated=params.get('populated')==='1',market=marketplaceFixture(),posts=postsFixtures('published',!populated),work=createWorkFixtures(false,true);
if(!populated)market.search=async(_filters,page)=>({items:[],page,hasNext:false});
const path=params.get('path')??'/';
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={[path]}><App authGateway={work.gateway} marketplaceRepository={market} publicPosts={posts.publicPosts}/></MemoryRouter>);
