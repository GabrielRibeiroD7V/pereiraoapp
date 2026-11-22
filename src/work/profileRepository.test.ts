import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../lib/database.types';
import { createWorkRepository } from './repository';
import { imageBucket } from '../lib/mediaPath';
const bid = '00000000-0000-4000-8000-000000000001', id = '00000000-0000-4000-8000-000000000101';
const path = `${bid}/profile/${id}.webp`;
function setup(options: { missingMigration?: boolean; uploadFails?: boolean; finalFails?: boolean; responseLost?: boolean } = {}) {
  const calls: { path: string; body: Record<string, unknown>; method: string }[] = []; let uploaded = false;
  const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    const url = new URL(String(input)), body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    calls.push({ path: url.pathname, method: init?.method ?? 'GET', body });
    let result: unknown = [], status = 200;
    if (url.pathname.endsWith('/business_members')) result = [{ id: 'member' }];
    if (url.pathname.endsWith('/rpc/profile_photo_command')) {
      if (options.missingMigration) { result = { code: 'PGRST202' }; status = 404; }
      else if (body.command === 'finalize' && (!uploaded || options.finalFails)) { result = { code: options.finalFails && uploaded ? '40001' : '22023' }; status = 400; }
      else result = { id, business_id: bid, storage_path: path, media_state: uploaded ? 'ready' : 'pending' };
    }
    if (url.pathname.startsWith('/storage/v1/object/business-profile/')) {
      if (options.uploadFails || options.responseLost) { result = { message: 'network failure' }; status = 503; uploaded = !!options.responseLost; }
      else { uploaded = true; result = { Key: path }; }
    }
    return new Response(JSON.stringify(result), { status, headers: { 'Content-Type': 'application/json' } });
  } } });
  vi.spyOn(client.auth, 'getUser').mockResolvedValue({ data: { user: { id: 'verified', aud: 'authenticated', user_metadata: {}, app_metadata: {}, created_at: '' } }, error: null });
  return { repository: createWorkRepository(client), calls };
}
const blob = new Blob(['photo'], { type: 'image/webp' });
describe('Storage de retratos via SDK com transporte simulado', () => {
  it('usa exclusivamente bucket separado e RPC, sem PATCH ou portfólio', async () => {
    const f = setup(); expect(await f.repository.uploadProfilePhoto(bid, id, blob, null)).toBe(path);
    expect(f.calls.filter(c => c.path.endsWith('/rpc/profile_photo_command')).map(c => c.body.command)).toEqual(['prepare','finalize','finalize']);
    expect(f.calls.some(c => c.path.includes('/object/business-profile/'))).toBe(true);
    expect(f.calls.some(c => c.method === 'PATCH' || c.path.endsWith('/rpc/portfolio_command'))).toBe(false);
  });
  it('migração ausente falha antes de enviar bytes', async () => {
    const f = setup({ missingMigration: true }); await expect(f.repository.uploadProfilePhoto(bid,id,blob,null)).rejects.toMatchObject({ code: 'PGRST202' });
    expect(f.calls.some(c => c.path.includes('/storage/'))).toBe(false);
  });
  it('falha de upload não altera ponteiro por PATCH nem remove a foto antiga', async () => {
    const f = setup({ uploadFails: true }); await expect(f.repository.uploadProfilePhoto(bid,id,blob,'old')).rejects.toBeDefined();
    expect(f.calls.every(c => c.method !== 'PATCH' && c.method !== 'DELETE')).toBe(true);
  });
  it('recupera upload persistido cuja resposta se perdeu', async () => {
    const f = setup({ responseLost: true }); expect(await f.repository.uploadProfilePhoto(bid,id,blob,null)).toBe(path);
    expect(f.calls.filter(c => c.path.includes('/object/business-profile/'))).toHaveLength(1);
  });
  it('conflito de finalização não tenta forçar atualização do negócio', async () => {
    const f = setup({ finalFails: true }); await expect(f.repository.uploadProfilePhoto(bid,id,blob,null)).rejects.toMatchObject({ code: '40001' });
    expect(f.calls.some(c => c.method === 'PATCH')).toBe(false);
  });
  it('roteia apenas caminhos válidos e mantém suporte a avatares legados', () => {
    expect(imageBucket(bid,path)).toBe('business-profile');
    expect(imageBucket(bid,`${bid}/portfolio/${id}.webp`)).toBe('business-portfolio');
    for (const value of [`${bid}/profile/../../x.webp`,path+'?token=x',path.replace(bid,id),path.replace('.webp','.svg')]) expect(imageBucket(bid,value)).toBeNull();
  });
});

it('exclusão de trabalho limpa somente fallback legado por RPC', async () => {
  const f = setup(); await f.repository.removeProfilePhoto(bid,`${bid}/portfolio/${id}.webp`,true);
  expect(f.calls.at(-1)?.body).toMatchObject({ command:'clear_legacy',target_business:bid,expected_avatar_path:`${bid}/portfolio/${id}.webp` });
});
