import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../lib/database.types';
import { createAuthGateway } from './supabaseAuthGateway';

describe('dados pessoais pelo SDK real com transporte interceptado', () => {
  it('consulta e atualiza somente o perfil da identidade verificada, sem editar metadados de autorização', async () => {
    const requests: { url: URL; method: string; body: unknown }[] = [];
    const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, init) => {
      requests.push({ url: new URL(String(url)), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null });
      const data = init?.method === 'PATCH' ? { id: 'verified-user' } : { display_name: 'Nome cadastrado', avatar_url: null };
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } } });
    vi.spyOn(client.auth, 'getUser').mockResolvedValue({ data: { user: { id: 'verified-user', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' } }, error: null });
    const gateway = createAuthGateway(client, () => 'https://example.invalid');
    expect(await gateway.getProfile!()).toEqual({ displayName: 'Nome cadastrado', avatarUrl: null });
    await gateway.updateProfile!(' Nome novo ');
    expect(requests).toHaveLength(2);
    expect(requests.every((item) => item.url.searchParams.get('id') === 'eq.verified-user')).toBe(true);
    expect(requests[1]?.body).toEqual({ display_name: 'Nome novo' });
    await expect(gateway.updateProfile!('x')).rejects.toMatchObject({ code: 'invalid_profile_name' });
    expect(requests).toHaveLength(2);
  });
});
