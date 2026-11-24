// QA local autenticado por fixture, sem acesso ou gravação no banco operacional.
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {App} from '../../../src/app/App';
import {createWorkFixtures} from '../../../src/test/workFixtures';
import {postsFixtures} from '../../../src/test/postsFixtures';
import '../../../src/styles/main.scss';
const work=createWorkFixtures(),posts=postsFixtures('draft',true);
const subscriptions={accessStatus:async()=>({phase:'initial_free' as const,effectiveAt:'2026-11-24T16:30:00Z',trialClockRunning:false as const,checkoutAvailable:false as const,enforcementEnabled:false as const,automaticConversion:false as const}),list:async()=>({items:[],hasNext:false})};
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/conta']}><App authGateway={work.gateway} professionalRepository={work.professional} workRepository={work.work} managedPosts={posts.managed} subscriptionRepository={subscriptions}/></MemoryRouter>);
