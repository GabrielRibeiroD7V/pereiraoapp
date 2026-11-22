import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database, PortfolioRow } from '../lib/database.types';
import { createWorkRepository } from './repository';
import { emptyService } from './validation';
const bid = '00000000-0000-4000-8000-000000000001', pid = '00000000-0000-4000-8000-000000000101';
function setup(options: { manager?: boolean; ready?: boolean; uploadFails?: boolean; deleteFails?: boolean; lostServiceResponse?: boolean; existingFile?: boolean } = {}) {
  const calls: { path: string; method: string; body: unknown; url: URL }[] = [];
  let uploaded = options.existingFile ?? false, inserted = false;
  let item: PortfolioRow = { id: pid, business_id: bid, service_id: null, storage_path: `${bid}/portfolio/${pid}.webp`, caption: 'Legenda', sort_order: 0, created_at: '', media_state: 'pending' };
  const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    const url = new URL(String(input)), method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    calls.push({ path: url.pathname, method, body, url });
    let result: unknown = [], status = 200;
    if (url.pathname.endsWith('/business_members')) result = options.manager === false ? [] : [{ id: 'member' }];
    else if (url.pathname.endsWith('/portfolio_items') && url.searchParams.get('select') === 'media_state' && options.ready === false) { result = { code: '42703', message: 'missing' }; status = 400; }
    else if (url.pathname.endsWith('/portfolio_items') && url.searchParams.get('select') === 'storage_path,media_state') result = [{ storage_path: `${bid}/portfolio/${pid}.webp`, media_state: 'ready' }];
    else if (url.pathname.endsWith('/businesses') && method === 'PATCH') result = [{ id: bid }];
    else if (url.pathname.endsWith('/services')) {
      if (method === 'POST') { inserted = true; result = { id: pid }; if (options.lostServiceResponse) { result = { code: '08006' }; status = 503; } }
      else if (method === 'PATCH') result = { id: pid };
      else result = inserted ? [{ id: pid }] : [];
    } else if (url.pathname.endsWith('/rpc/portfolio_command')) {
      if (body.command === 'prepare') result = item;
      if (body.command === 'finalize') { if (!uploaded) { result = { code: '22023' }; status = 400; } else { item = { ...item, media_state: 'ready' }; result = item; } }
      if (body.command === 'begin_delete') { item = { ...item, media_state: 'deleting' }; result = item; }
      if (body.command === 'finish_delete') { if (uploaded) { result = { code: '55000' }; status = 400; } else result = { deleted: true }; }
    } else if (url.pathname.startsWith('/storage/v1/object/sign/')) result = { signedURL: '/object/sign/business-portfolio/image.webp?token=temporary-test-only' };
    else if (url.pathname.startsWith('/storage/v1/object/')) {
      if (method === 'POST') { if (options.uploadFails) { status = 503; result = { message: 'simulated failure' }; } else { uploaded = true; result = { Key: item.storage_path }; } }
      if (method === 'DELETE' && options.deleteFails) { status = 503; result = { message: 'simulated failure' }; }
      else if (method === 'DELETE') uploaded = false;
    }
    return new Response(JSON.stringify(result), { status, headers: { 'Content-Type': 'application/json' } });
  } } });
  vi.spyOn(client.auth, 'getUser').mockResolvedValue({ data: { user: { id: 'verified-user', aud: 'authenticated', user_metadata: {}, app_metadata: {}, created_at: '' } }, error: null });
  return { repository: createWorkRepository(client), calls };
}
describe('serviços e Storage pelo SDK com transporte interceptado', () => {
  it('bloqueia envio de retrato por terceiro antes de preparar ou enviar arquivo', async () => {
    const { repository, calls } = setup({ manager: false });
    await expect(repository.uploadProfilePhoto(bid, pid, new Blob(['x'], { type: 'image/webp' }), null)).rejects.toBeDefined();
    expect(calls.some(call => call.method === 'POST' || call.method === 'PATCH')).toBe(false);
  });
  it('bloqueia terceiros e estrutura pendente antes de qualquer escrita', async () => {
    for (const options of [{ manager: false }, { ready: false }]) {
      const { repository, calls } = setup(options);
      await expect(repository.saveService(bid, pid, { ...emptyService, name: 'Serviço', categoryId: 'eletrica' }, true)).rejects.toBeDefined();
      expect(calls.every((call) => call.method === 'GET')).toBe(true);
    }
  });
  it('recupera criação com resposta perdida usando o mesmo ID e sem definir propriedade/status', async () => {
    const { repository, calls } = setup({ lostServiceResponse: true });
    await repository.saveService(bid, pid, { ...emptyService, name: 'Serviço', categoryId: 'eletrica', price: '999,00' }, true);
    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toMatchObject({ id: pid, business_id: bid, price_amount_cents: null, pricing_type: 'quote' });
    expect(posts[0]?.body).not.toHaveProperty('status'); expect(posts[0]?.body).not.toHaveProperty('owner_id');
    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch?.url.searchParams.get('business_id')).toBe(`eq.${bid}`);
    expect(patch?.url.searchParams.get('id')).toBe(`eq.${pid}`);
  });
  it('cria pendente, envia ao caminho do negócio e finaliza, sem bucket público ou upsert', async () => {
    const { repository, calls } = setup();
    await repository.uploadPhoto(bid, pid, new Blob(['local-test-only'], { type: 'image/webp' }), 'Legenda', null);
    const commands = calls.filter((call) => call.path.endsWith('/portfolio_command')).map((call) => (call.body as { command: string }).command);
    expect(commands).toEqual(['prepare', 'finalize', 'finalize']);
    expect(calls.some((call) => call.path.endsWith(`/${bid}/portfolio/${pid}.webp`))).toBe(true);
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
  });
  it('preserva registro pendente em falha de upload e não exclui arquivos automaticamente', async () => {
    const { repository, calls } = setup({ uploadFails: true });
    await expect(repository.uploadPhoto(bid, pid, new Blob(['test'], { type: 'image/webp' }), '', null)).rejects.toBeDefined();
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
  });
  it('marca exclusão antes do Storage e apaga metadados somente após remover o arquivo', async () => {
    const { repository, calls } = setup({ existingFile: true });
    await repository.deletePhoto(bid, pid);
    const commands = calls.filter((call) => call.path.endsWith('/portfolio_command')).map((call) => (call.body as { command: string }).command);
    expect(commands).toEqual(['begin_delete', 'finish_delete', 'finish_delete']);
    expect(calls.find((call) => call.method === 'DELETE')?.body).toEqual({ prefixes: [`${bid}/portfolio/${pid}.webp`] });
    const failed = setup({ deleteFails: true, existingFile: true });
    await expect(failed.repository.deletePhoto(bid, pid)).rejects.toBeDefined();
    expect(failed.calls.filter((call) => (call.body as { command?: string } | null)?.command === 'finish_delete')).toHaveLength(1);
  });
  it('conclui exclusão retomada quando o arquivo já não existe, sem nova remoção HTTP', async () => {
    const { repository, calls } = setup();
    await repository.deletePhoto(bid, pid);
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
  });
  it('usa URL temporária de 60 segundos e RPC de exclusão de serviço vinculada ao negócio', async () => {
    const { repository, calls } = setup();
    await repository.imageUrl(`${bid}/portfolio/${pid}.webp`);
    expect(calls[0]?.body).toEqual({ expiresIn: 60 });
    await repository.deleteService(bid, pid);
    expect(calls.at(-1)?.body).toEqual({ target_business: bid, target_service: pid });
  });
});
