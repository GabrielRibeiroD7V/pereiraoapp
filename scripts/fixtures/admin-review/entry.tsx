// Somente Preview/local. Nenhuma sessão legítima ou conexão Supabase é inicializada.
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {App} from '../../../src/app/App';
import {adminFixture} from '../../../src/test/adminFixtures';
import {createWorkFixtures} from '../../../src/test/workFixtures';
import '../../../src/styles/main.scss';
const f=adminFixture(),work=createWorkFixtures(true);
const mode=new URLSearchParams(location.search).get('case')||'multiple';
f.detail.photos=[];f.detail.services=[];
f.detail.reviewCatalog={primaryCategory:{id:'climatizacao',name:'Climatização',active:true},additionalSpecialties:[{id:'pintura',name:'Pintura',active:true},{id:'eletrica',name:'Elétrica',active:true}],originCity:{id:'mundo-novo-ms',name:'Mundo Novo',stateCode:'MS',active:true},serviceCities:[{id:'mundo-novo-ms',name:'Mundo Novo',stateCode:'MS',active:true},{id:'guaira-pr',name:'Guaíra',stateCode:'PR',active:true},{id:'eldorado-ms',name:'Eldorado',stateCode:'MS',active:true}]};
if(mode==='empty')f.detail.reviewCatalog={primaryCategory:null,additionalSpecialties:[],originCity:null,serviceCities:[]};
if(mode==='unavailable')f.detail.reviewCatalog=null;
if(mode==='long'&&f.detail.reviewCatalog){f.detail.reviewCatalog.additionalSpecialties=[{id:'long',name:'Especialidade de demonstração com descrição extensa '.repeat(6),active:true}];f.detail.reviewCatalog.serviceCities=[{id:'long',name:'Município com nome muito extenso '.repeat(6),stateCode:'PR',active:false}];}
// Ações operacionais bloqueadas até neste repositório local de demonstração.
f.repo.act=async()=>{throw new Error('Somente leitura nesta demonstração sintética.');};
createRoot(document.getElementById('root')!).render(<><p className="form-notice">DEMONSTRAÇÃO SINTÉTICA · sem dados operacionais · caso {mode}</p><MemoryRouter initialEntries={['/admin?sec=businesses']}><App authGateway={work.gateway} adminRepository={f.repo}/></MemoryRouter></>);
