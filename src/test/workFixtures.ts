// Exclusivo de testes e inspeção local; nunca importado pelo aplicativo de produção.
import type { AuthGateway } from '../auth/types';
import type { BusinessRow, PortfolioRow, ServiceRow } from '../lib/database.types';
import type { ProfessionalRepository } from '../professional/types';
import type { WorkRepository } from '../work/types';
import { emptyRegistration } from '../professional/validation';
import { categories } from '../config/categories';
import { priceInCents } from '../work/validation';
export const fixtureBusinessId = '00000000-0000-4000-8000-000000000001';
export const fixtureImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAAZElEQVR4nO3PwQkAIBDAsNt/UMGXKziEjyAUOkA6a5+vGy5oQAsa0IIGtKABLWhACxrQgga0oAEtaEALGtCCBrSgAS1oQAsa0IIGtKABLWhACxrQgga0oAEtaEALGtCCBrTgsQtdKOnhHZGFhwAAAABJRU5ErkJggg==';
export function createWorkFixtures(empty = false, visitor = false) {
  const business: BusinessRow = { id: fixtureBusinessId, name: 'Negócio de demonstração local', type: 'autonomo', category_id: 'climatizacao', city_id: 'mundo-novo-ms', status: 'draft', slug: 'local-only', description: null, whatsapp: null, instagram: null, avatar_path: null, created_at: '', updated_at: '' };
  let services: ServiceRow[] = empty ? [] : [{ id: '00000000-0000-4000-8000-000000000010', business_id: business.id, name: 'Instalação de ar-condicionado', description: 'Serviço demonstrativo para validar esta interface local.', category_id: 'climatizacao', pricing_type: 'starting-at', price_amount_cents: 18000, active: true, created_at: '', updated_at: '' }];
  let photos: PortfolioRow[] = empty ? [] : ['Instalação residencial', 'Acabamento e organização'].map((caption, index) => ({ id: `00000000-0000-4000-8000-00000000010${index}`, business_id: business.id, storage_path: `${business.id}/portfolio/local-${index}.webp`, service_id: services[0]!.id, caption, media_state: 'ready', sort_order: index, created_at: '' }));
  const gateway: AuthGateway = { getSession: async () => visitor ? null : ({ user: { id: 'local-user', email: 'local@example.invalid', displayName: 'Demonstração local' } }), subscribe: () => () => {}, signIn: async () => {}, signUp: async () => ({ confirmationRequired: true }), requestReset: async () => {}, updatePassword: async () => {}, signOut: async () => {}, completeCallback: async () => {} };
  const professional: ProfessionalRepository = { listMine: async () => [business], getCatalog: async () => ({ categories: categories.map(({ id, name }) => ({ id, name })), cities: [{ id: 'mundo-novo-ms', name: 'Mundo Novo', state_code: 'MS' }] }), getEditable: async (id) => { if (id !== business.id) throw { code: 'NOT_MANAGER' }; return { business, input: { ...emptyRegistration, name: business.name } }; }, createDraft: async () => { throw new Error('Not used'); }, saveDraft: async () => { throw new Error('Not used'); } };
  const check = (id: string) => { if (id !== business.id) throw { code: 'NOT_MANAGER' }; };
  const work: WorkRepository = {
    list: async (id) => { check(id); return { services: [...services], photos: [...photos] }; },
    saveService: async (bid, id, input, create) => { check(bid); const values = { id, business_id: bid, name: input.name, description: input.description, category_id: input.categoryId, pricing_type: input.pricingType, price_amount_cents: input.pricingType === 'quote' ? null : priceInCents(input.price), active: input.active, created_at: '', updated_at: '' }; services = create ? [...services, values] : services.map((row) => row.id === id ? values : row); },
    setServiceActive: async (bid, id, active) => { check(bid); services = services.map((row) => row.id === id ? { ...row, active } : row); },
    deleteService: async (bid, id) => { check(bid); services = services.filter((row) => row.id !== id); photos = photos.map((row) => row.service_id === id ? { ...row, service_id: null } : row); },
    uploadPhoto: async (bid, id, _file, caption, serviceId) => { check(bid); photos = [...photos.filter((row) => row.id !== id), { id, business_id: bid, caption, service_id: serviceId, storage_path: `${bid}/portfolio/${id}.webp`, sort_order: photos.length, created_at: '', media_state: 'ready' }]; },
    finalizePhoto: async (bid, id) => { check(bid); photos = photos.map((row) => row.id === id ? { ...row, media_state: 'ready' } : row); },
    savePhotoDetails: async (bid, id, caption, serviceId) => { check(bid); photos = photos.map((row) => row.id === id ? { ...row, caption, service_id: serviceId } : row); },
    deletePhoto: async (bid, id) => { check(bid); photos = photos.filter((row) => row.id !== id); },
    reorderPhotos: async (bid, ids) => { check(bid); photos = photos.map((row) => ({ ...row, sort_order: ids.indexOf(row.id) })).sort((a, b) => a.sort_order - b.sort_order); },
    uploadProfilePhoto: async (bid, id) => { check(bid); const path = `${bid}/profile/${id}.webp`; business.profile_avatar_path = path; return path; },
    removeProfilePhoto: async (bid, _expected, legacyOnly) => { check(bid); business.avatar_path = null; if (!legacyOnly) business.profile_avatar_path = null; },
    imageUrl: async () => fixtureImage,
  };
  return { gateway, professional, work, snapshot: () => ({ services, photos }) };
}
