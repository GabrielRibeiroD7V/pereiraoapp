import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../lib/database.types';
import { createPublicMarketplace, PUBLIC_COLUMNS, LEGACY_PUBLIC_COLUMNS } from './repository';
import { publicProviderFixture as p, photoFixtureId } from '../test/marketplaceFixtures';
const raw = { id: p.id, slug: p.slug, name: p.name, type: p.type, category_id: p.categoryId, city_id: p.city.id, description: p.description,
  whatsapp: p.whatsapp, instagram: p.instagram, avatar_path: null, city: { id: p.city.id, name: p.city.name, state_code: p.city.state }, category: { id: p.categoryId, name: p.specialty },
  owner_id: 'must-not-leak', legal_name: 'must-not-leak' };
function setup(response: unknown = [], status = 200, missingSchema = false) {
  const calls: { url: URL; method: string; body: unknown }[] = [];
  const client = createClient<Database>('https://yazdjiwaksamizrbqewq.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false, storageKey: `test-${crypto.randomUUID()}` }, global: { fetch: async (input, init) => {
    calls.push({ url: new URL(String(input)), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
    const url = calls[calls.length - 1]!.url;
    const missing = missingSchema && (url.pathname.includes('/rpc/search_public_businesses') || (url.searchParams.get('select') ?? '').includes('additional_categories:'));
    return new Response(JSON.stringify(missing ? { code: url.pathname.includes('/rpc/') ? 'PGRST202' : 'PGRST200', message: url.pathname.includes('/rpc/') ? 'search_public_businesses not found' : 'business_categories relationship not found' } : response), { status: missing ? 404 : status, headers: { 'Content-Type': 'application/json' } });
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
    expect(url.pathname).toBe('/rest/v1/rpc/search_public_businesses');
    expect(url.searchParams.get('p_page')).toBe('2');
    expect(url.searchParams.get('p_category')).toBe(''); expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });
  it('filtra nome/especialidade/serviço ativo e cidade atendida no servidor', async () => {
    const { repository, calls } = setup();
    await repository.search({ query: 'instalação', categoryId: 'climatizacao', cityId: 'mundo-novo-ms', type: 'empresa' }, 1);
    const params = calls[0]!.url.searchParams;
    expect(Object.fromEntries(params)).toMatchObject({ p_query: 'instalação', p_category: 'climatizacao', p_city: 'mundo-novo-ms', p_type: 'empresa', p_page: '1' });
  });
  it('não transforma pontuação maliciosa em uma busca irrestrita', async () => {
    const { repository, calls } = setup();
    expect((await repository.search({ ...filters, query: '%,()***' }, 1)).items).toEqual([]); expect(calls).toHaveLength(0);
    await repository.search({ ...filters, query: '",status.eq.draft)' }, 1);
    expect(calls[0]?.url.searchParams.get('p_query')).toBe('status eq draft');
    expect(calls[0]?.url.searchParams.has('or')).toBe(false);
  });
  it('consulta perfil por slug com status publicado, sem autenticar', async () => {
    const { repository, calls, client } = setup(raw);
    const spy = vi.spyOn(client.auth, 'getUser');
    expect((await repository.getProvider(p.slug))?.id).toBe(p.id);
    expect(calls[0]?.url.searchParams.get('slug')).toBe(`eq.${p.slug}`);
    expect(calls[0]?.url.searchParams.get('status')).toBe('eq.published'); expect(calls[0]?.url.searchParams.get('select')).toBe(PUBLIC_COLUMNS); expect(spy).not.toHaveBeenCalled();
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
  it.each(['guaira-pr', 'terra-roxa-pr', 'navirai-ms'])('cidade atendida %s não restringe pela sede do negócio', async cityId => {
    const { repository, calls } = setup([raw]);
    const result = await repository.search({ ...filters, cityId }, 1);
    expect(calls[0]!.url.searchParams.get('p_city')).toBe(cityId);
    expect(calls[0]!.url.searchParams.get('city_id')).toBeNull();
    expect(result.items[0]?.city.id).toBe('mundo-novo-ms');
  });
  it('inclui adicionais na projeção, sem duplicar a principal ou revelar campos extras', async () => {
    const { repository } = setup([{ ...raw, additional_categories: [{ category: { id: 'pintura', name: 'Pintura' } }, { category: null }] }]);
    const result = await repository.search(filters, 1);
    expect(result.items[0]?.additionalSpecialties).toEqual([{ id: 'pintura', name: 'Pintura' }]);
  });
  it('mantém busca e perfil anteriores disponíveis enquanto a migração está pendente', async () => {
    const { repository, calls } = setup([raw], 200, true);
    expect((await repository.search({ ...filters, categoryId: 'climatizacao', cityId: 'guaira-pr' }, 1)).items).toHaveLength(1);
    expect(calls[1]?.url.searchParams.get('select')).toContain(LEGACY_PUBLIC_COLUMNS);
    expect(calls[1]?.url.searchParams.get('category_id')).toBe('eq.climatizacao');
    expect(calls[1]?.url.searchParams.get('area_matches.city_id')).toBe('eq.guaira-pr');
    await repository.search(filters, 1);
    expect(calls.filter(call => call.url.pathname.includes('/rpc/'))).toHaveLength(1);
    expect((await repository.getProvider(p.slug))?.additionalSpecialties).toEqual([]);
  });
  it('não oculta falhas de permissão com fallback para outra consulta', async () => {
    const { repository, calls } = setup({ code: '42501', message: 'not authorized' }, 403);
    await expect(repository.search(filters, 1)).rejects.toMatchObject({ code: '42501' });
    expect(calls).toHaveLength(1);
  });
  it('propaga erro da API para permitir nova tentativa na interface', async () => {
    const { repository } = setup({ message: 'unavailable', code: '400' }, 400);
    await expect(repository.search(filters, 1)).rejects.toBeDefined();
  });
});
