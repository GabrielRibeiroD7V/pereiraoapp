import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Database } from '../lib/database.types';
import { activeCities } from './catalog';

describe('catálogo ativo paginado', () => {
  it('carrega além de 200 municípios com ordenação estável e sem escrever no banco', async () => {
    const calls: { url: URL; method: string }[] = [];
    const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (request, init) => {
      const url = new URL(String(request)); calls.push({ url, method: init?.method ?? 'GET' });
      const offset = Number(url.searchParams.get('offset'));
      return new Response(JSON.stringify(Array.from({ length: offset === 0 ? 200 : 1 }, (_, index) => ({ id: `city-${offset + index}`, name: `Cidade ${offset + index}`, state_code: 'MS' }))), { headers: { 'Content-Type': 'application/json' } });
    } } });
    const cities = await activeCities(client);
    expect(cities).toHaveLength(201);
    expect(cities[200]?.id).toBe('city-200');
    expect(calls.map(call => call.url.searchParams.get('offset'))).toEqual(['0', '200']);
    expect(calls.every(call => call.method === 'GET' && call.url.searchParams.get('active') === 'eq.true' && call.url.searchParams.get('order') === 'name.asc,state_code.asc,id.asc')).toBe(true);
  });
  it('não oferece catálogo parcial quando uma página falha', async () => {
    const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async request => {
      const offset = Number(new URL(String(request)).searchParams.get('offset'));
      return new Response(JSON.stringify(offset === 0 ? Array.from({ length: 200 }, (_, i) => ({ id: `city-${i}`, name: 'Cidade', state_code: 'MS' })) : { code: 'UNAVAILABLE' }), { status: offset === 0 ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
    } } });
    await expect(activeCities(client)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });
});
