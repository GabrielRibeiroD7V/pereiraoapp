import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../lib/database.types';
import { createPublicMarketplace, PUBLIC_COLUMNS } from './repository';
import { publicProviderFixture as p, photoFixtureId } from '../test/marketplaceFixtures';
const raw = { id: p.id, slug: p.slug, name: p.name, type: p.type, category_id: p.categoryId, city_id: p.city.id, description: p.description,
  whatsapp: p.whatsapp, instagram: p.instagram, avatar_path: null, city: { id: p.city.id, name: p.city.name, state_code: p.city.state }, category: { id: p.categoryId, name: p.specialty },
  owner_id: 'must-not-leak', legal_name: 'must-not-leak' };
function setup(response: unknown = [], status = 200) {
  const calls: { url: URL; method: string; body: unknown }[] = [];
  const client = createClient<Database>('https://yazdjiwaksamizrbqewq.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false, storageKey: `test-${crypto.randomUUID()}` }, global: { fetch: async (input, init) => {
    calls.push({ url: new URL(String(input)), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify(response), { status, headers: { 'Content-Type': 'application/json' } });
  } } });
  return { repository: createPublicMarketplace(client), calls, client };
}
const filters = { query: '', categoryId: '', cityId: '', type: '' as const };
describe('marketplace com SDK real e HTTP interceptado', () => {
  it('projeta somente colunas públicas, pagina no servidor e descarta campos extras', async () => {
    const { repository, calls } = setup(Array.from({ length: 21 }, (_, index) => ({ ...raw, id: `${index}` })));
    const result = await repository.search(filters, 2);
    expect(result.items).toHaveLength(20); expect(result.hasNext).toBe(true);
    expect(result.items[0]).not.toHaveProperty('owner_id'); expect(result.items[0]).not.toHaveProperty('legal_name');
    const url = calls[0]!.url;
    expect(url.searchParams.get('offset')).toBe('20'); expect(url.searchParams.get('limit')).toBe('21');
    expect(url.searchParams.get('status')).toBe('eq.published'); expect(url.searchParams.get('select')).toBe(PUBLIC_COLUMNS);
    expect(url.searchParams.get('order')).toBe('name.asc,id.asc'); expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });
  it('filtra nome/especialidade/serviço ativo e cidade atendida no servidor', async () => {
    const { repository, calls } = setup();
    await repository.search({ query: 'instalação', categoryId: 'climatizacao', cityId: 'mundo-novo-ms', type: 'empresa' }, 1);
    const params = calls[0]!.url.searchParams;
    expect(params.get('service_matches.active')).toBe('eq.true');
    expect(params.get('service_matches.or')).toContain('description.ilike.');
    expect(params.get('or')).toContain('service_matches.not.is.null'); expect(params.get('or')).toContain('category_matches.not.is.null');
    expect(params.get('area_matches.city_id')).toBe('eq.mundo-novo-ms'); expect(params.get('area_matches')).toBe('not.is.null');
    expect(params.get('type')).toBe('eq.empresa'); expect(params.get('category_id')).toBe('eq.climatizacao');
  });
  it('não transforma pontuação maliciosa em uma busca irrestrita', async () => {
    const { repository, calls } = setup();
    expect((await repository.search({ ...filters, query: '%,()***' }, 1)).items).toEqual([]); expect(calls).toHaveLength(0);
    await repository.search({ ...filters, query: '",status.eq.draft)' }, 1);
    expect(calls[0]?.url.searchParams.get('or')).not.toContain('status.eq.draft');
  });
  it('consulta perfil por slug com status publicado, sem autenticar', async () => {
    const { repository, calls, client } = setup(raw);
    const spy = vi.spyOn(client.auth, 'getUser');
    expect((await repository.getProvider(p.slug))?.id).toBe(p.id);
    expect(calls[0]?.url.searchParams.get('slug')).toBe(`eq.${p.slug}`);
    expect(calls[0]?.url.searchParams.get('status')).toBe('eq.published'); expect(spy).not.toHaveBeenCalled();
    expect(await repository.getProvider('../private')).toBeNull(); expect(calls).toHaveLength(1);
  });
  it('aplica parent published, active e ready em consultas independentes paginadas', async () => {
    const { repository, calls } = setup();
    await Promise.all([repository.getServices(p.id, 1), repository.getPhotos(p.id, 2), repository.getAreas(p.id, 1)]);
    for (const { url } of calls) { expect(url.searchParams.get('business.status')).toBe('eq.published'); expect(url.searchParams.get('business_id')).toBe(`eq.${p.id}`); expect(url.searchParams.get('select')).not.toContain('*'); }
    expect(calls.find((c) => c.url.pathname.endsWith('/services'))?.url.searchParams.get('active')).toBe('eq.true');
    expect(calls.find((c) => c.url.pathname.endsWith('/portfolio_items'))?.url.searchParams.get('media_state')).toBe('eq.ready');
  });
  it('assina somente caminhos canônicos por 60s e não gera URL pública', async () => {
    const path = `${p.id}/portfolio/${photoFixtureId}.webp`;
    const { repository, calls } = setup({ signedURL: `/object/sign/business-portfolio/${path}?token=synthetic` });
    expect(await repository.getImageUrl(p.id, path)).toContain('/storage/v1/object/sign/business-portfolio/');
    expect(calls[0]?.body).toEqual({ expiresIn: 60 });
    await expect(repository.getImageUrl(p.id, '../secret')).rejects.toThrow(); expect(calls).toHaveLength(1);
  });
  it('propaga erro da API para permitir nova tentativa na interface', async () => {
    const { repository } = setup({ message: 'unavailable', code: '400' }, 400);
    await expect(repository.search(filters, 1)).rejects.toBeDefined();
  });
});
