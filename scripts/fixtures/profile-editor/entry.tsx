import { emptyPresentation } from '../../../src/presentation/model';
// Pure memory repositories. Preview build also blanks the public Supabase config.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { App } from '../../../src/app/App';
import { createWorkFixtures, fixtureBusinessId as bid } from '../../../src/test/workFixtures';
import { postsFixtures } from '../../../src/test/postsFixtures';
import type { RegistrationInput } from '../../../src/professional/types';
import { emptyRegistration } from '../../../src/professional/validation';
import '../../../src/styles/main.scss';
const f = createWorkFixtures();
const business = (await f.professional.listMine())[0]!;
let input: RegistrationInput = { ...emptyRegistration, name: 'Serviços de demonstração sintética', description: 'Instalação e manutenção residencial. Perfil demonstrativo usado apenas nesta revisão.', categoryId: 'climatizacao', additionalCategoryIds: ['eletrica'], cityId: 'mundo-novo-ms', areaCityIds: ['mundo-novo-ms'], whatsapp: '5567999990000', instagram: 'demonstracao_local' };
const presentationKey = 'pereirao.qa.presentation.identity.v1';
let presentation = { ...emptyPresentation, profession: 'Profissão de demonstração', linkedin_url: 'https://www.linkedin.com/in/exemplo-sintetico', headline: 'Engenharia e instalações — exemplo sintético', experience: 'Demonstração: planejamento e acompanhamento de instalações. Nenhuma experiência real declarada.', education: 'Formação de demonstração, sem instituição ou diploma real.', certifications: 'Exemplo de certificação autodeclarada, não verificada.', professional_registration: '' };
try { const stored = localStorage.getItem(presentationKey); if (stored) presentation = { ...presentation, ...JSON.parse(stored) }; } catch { /* Synthetic storage only. */ }
const presentationRepository = { get: async () => ({ available: true, data: { ...presentation } }), save: async (_id: string, value: typeof presentation) => { presentation = { ...value }; localStorage.setItem(presentationKey, JSON.stringify(presentation)); } };
const calls: Record<string, number> = { 'uploads de retrato': 0, 'uploads de trabalhos': 0, 'serviços': 0, 'publicações': 0, 'perfil': 0 };
function record(key: string) { calls[key]++; window.dispatchEvent(new Event('synthetic-operation')); }
const professional = { ...f.professional,
  listMine: async () => [{ ...business, name: input.name, type: input.type, description: input.description }],
  getEditable: async (id: string) => { if (id !== bid) throw { code: 'NOT_MANAGER' }; return { business: { ...business, name: input.name, type: input.type, description: input.description }, input: { ...input } }; },
  saveDraft: async (id: string, value: RegistrationInput) => { if (id !== bid) throw { code: 'NOT_MANAGER' }; input = { ...value }; record('perfil'); },
};
const uploadPhoto = f.work.uploadPhoto, uploadProfile = f.work.uploadProfilePhoto, saveService = f.work.saveService;
f.work.uploadPhoto = async (...args) => { await uploadPhoto(...args); record('uploads de trabalhos'); };
f.work.uploadProfilePhoto = async (...args) => { const path = await uploadProfile(...args); record('uploads de retrato'); return path; };
f.work.saveService = async (...args) => { await saveService(...args); record('serviços'); };
f.work.imageUrl = async () => new URL('./synthetic-photo.png', import.meta.url).href;
const posts = postsFixtures('draft', true);
const savePost = posts.managed.save;
posts.managed.save = async (...args) => { await savePost(...args); record('publicações'); };
posts.managed.imageUrl = f.work.imageUrl;
posts.managed.photos = async (id, page) => {
  if (id !== bid) throw { code: 'NOT_MANAGER' };
  return { items: f.snapshot().photos.filter(row => row.media_state === 'ready').map(row => ({ id: row.id, path: row.storage_path, caption: row.caption })), page, hasNext: false };
};
function DemoNotice() {
  const [counts, setCounts] = useState({ ...calls });
  const { pathname, search } = useLocation();
  useEffect(() => { const update = () => setCounts({ ...calls }); window.addEventListener('synthetic-operation', update); return () => window.removeEventListener('synthetic-operation', update); }, []);
  return <aside style={{ padding: '12px', background: '#fff5c4', color: '#0b1739', font: '14px/1.5 system-ui', overflowWrap: 'anywhere' }} aria-label="Demonstração sintética">
    <strong>Demonstração sintética — sem Supabase. Não informe dados pessoais.</strong><details><summary>Dados e contadores do teste</summary><p>Sem sessão, gravação ou upload no Supabase. Profissão, LinkedIn e apresentação são salvos apenas neste navegador para testar recarga. Os demais dados são de memória e somem ao recarregar.</p>
    <p>Operações simuladas: {Object.entries(counts).map(([key, value]) => <span key={key} data-demo-counter={key}>{key}: {value}; </span>)}</p>
    <output data-demo-route>{pathname}{search}</output></details>
  </aside>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={[`/conta/profissional/${bid}/${new URLSearchParams(window.location.search).get('view') === 'profile' ? 'perfil' : 'editar'}`]}><DemoNotice /><App presentationRepository={presentationRepository} authGateway={f.gateway} professionalRepository={professional} workRepository={f.work} managedPosts={posts.managed} adminRepository={null} messageRepository={{ list: async()=>[], messages: async()=>({items:[],hasMore:false,customerId:'local-user'}), open: async()=>{throw new Error('Not used in QA');}, send: async()=>{throw new Error('Not used in QA');} }} subscriptionRepository={null} billingRepository={null} marketplaceRepository={null} publicPosts={null} /></MemoryRouter>);
