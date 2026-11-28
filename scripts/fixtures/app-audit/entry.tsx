// QA local identificada; nunca importa dados operacionais ou grava no Supabase.
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {App} from '../../../src/app/App';
import {marketplaceFixture} from '../../../src/test/marketplaceFixtures';
import {categoryCatalog16} from '../../../src/test/categoryCatalog';
import {createWorkFixtures} from '../../../src/test/workFixtures';
import {adminFixture} from '../../../src/test/adminFixtures';
import '../../../src/styles/main.scss';
const params=new URLSearchParams(location.search),market=marketplaceFixture(),work=createWorkFixtures();
market.getCategories=async()=>categoryCatalog16;
if(params.get('empty')==='1')market.search=async(_filters,page)=>({items:[],page,hasNext:false});
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={[params.get('path')??'/']}><p style={{fontSize:12,textAlign:'center',background:'#e5f7fc'}}>Revisão local · dados sintéticos · sem operações remotas</p><App authGateway={work.gateway} professionalRepository={work.professional} workRepository={work.work} marketplaceRepository={market} adminRepository={adminFixture().repo}/></MemoryRouter>);
