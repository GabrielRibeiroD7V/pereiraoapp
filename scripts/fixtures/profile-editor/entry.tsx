// Fixture local isolada: nenhum Supabase, conta real ou escrita remota.
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from '../../../src/app/App';
import { createWorkFixtures, fixtureBusinessId as bid } from '../../../src/test/workFixtures';
import { postsFixtures } from '../../../src/test/postsFixtures';
import type { RegistrationInput } from '../../../src/professional/types';
import { emptyRegistration } from '../../../src/professional/validation';
import '../../../src/styles/main.scss';
const f = createWorkFixtures();
const business = (await f.professional.listMine())[0]!;
let input: RegistrationInput = { ...emptyRegistration, name: 'Serviços de demonstração local', description: 'Instalação e manutenção residencial. Perfil demonstrativo usado apenas nesta checagem local.', categoryId: 'climatizacao', additionalCategoryIds: ['eletrica'], cityId: 'mundo-novo-ms', areaCityIds: ['mundo-novo-ms'], whatsapp: '5567999990000', instagram: 'demonstracao_local' };
const professional = { ...f.professional,
  getEditable: async (id: string) => { if (id !== bid) throw { code: 'NOT_MANAGER' }; return { business: { ...business, name: input.name, description: input.description }, input: { ...input } }; },
  saveDraft: async (id: string, value: RegistrationInput) => { if (id !== bid) throw { code: 'NOT_MANAGER' }; input = { ...value }; },
};
const posts = postsFixtures('draft', true);
createRoot(document.getElementById('root')!).render(<BrowserRouter><App authGateway={f.gateway} professionalRepository={professional} workRepository={f.work} managedPosts={posts.managed} /></BrowserRouter>);
