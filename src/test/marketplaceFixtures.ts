import type { PublicMarketplace, PublicProvider } from '../marketplace/types';
// Somente testes/homologação local. Não representa prestador real e não é importado pelo app.
export const publicProviderFixture: PublicProvider = {
  id: '00000000-0000-4000-8000-000000000001', slug: 'prestador-simulado', name: 'Prestador simulado', type: 'autonomo',
  categoryId: 'climatizacao', specialty: 'Climatização', city: { id: 'mundo-novo-ms', name: 'Mundo Novo', state: 'MS' },
  avatarPath: null, description: 'Instalação e manutenção residencial. Dados simulados para validação local.', whatsapp: '5567999991234', instagram: 'perfil.simulado',
};
export const photoFixtureId = '00000000-0000-4000-8000-000000000101';
export function marketplaceFixture(): PublicMarketplace {
  const p = publicProviderFixture;
  return {
    search: async (_filters, page) => ({ items: page === 1 ? [p, { ...p, id: '00000000-0000-4000-8000-000000000002', slug: 'empresa-simulada', name: 'Empresa simulada', type: 'empresa' }] : [], page, hasNext: page === 1 }),
    getProvider: async (slug) => slug === p.slug ? p : null,
    getCities: async () => [p.city],
    getAreas: async (_id, page) => ({ items: [p.city], page, hasNext: false }),
    getServices: async (_id, page) => ({ items: [
      { id: 'service-1', name: 'Instalação simulada', description: 'Serviço usado somente no teste.', pricing_type: 'fixed', price_amount_cents: 18000 },
      { id: 'service-2', name: 'Manutenção simulada', description: null, pricing_type: 'starting-at', price_amount_cents: 9000 },
      { id: 'service-3', name: 'Projeto simulado', description: null, pricing_type: 'quote', price_amount_cents: null },
    ], page, hasNext: false }),
    getPhotos: async (_id, page) => ({ items: [{ id: photoFixtureId, caption: 'Imagem sintética local', storagePath: `${p.id}/portfolio/${photoFixtureId}.webp` }], page, hasNext: false }),
    getImageUrl: async () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1kAAAAASUVORK5CYII=',
  };
}
