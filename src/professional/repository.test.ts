import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../lib/database.types';
import type { RegistrationInput } from './types';
import { createProfessionalRepository } from './repository';
import { emptyRegistration } from './validation';

const bid = '00000000-0000-0000-0000-000000000004';
const input: RegistrationInput = { ...emptyRegistration, type: 'empresa', name: 'Empresa de teste', categoryId: 'eletrica', cityId: 'mundo-novo-ms', whatsapp: '+55 67 999991234', legalName: 'Razão de teste', taxId: '12345678000199' };
interface RequestRecord { method: string; path: string; params: URLSearchParams; body: Record<string, unknown> | unknown[] | null }

function setup(options: { missingCategory?: boolean; creationError?: boolean; ownDraft?: boolean; noMembership?: boolean } = {}) {
  const requests: RequestRecord[] = [];
  const fetcher = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(request));
    const method = init?.method ?? 'GET';
    const record = { method, path: url.pathname, params: url.searchParams, body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null };
    requests.push(record);
    const resource = url.pathname.split('/').pop();
    let body: unknown = [];
    let status = 200;
    if (resource === 'business_members') body = options.noMembership ? [] : [{ business_id: bid, role: 'owner' }];
    else if (resource === 'cities') body = [{ id: 'mundo-novo-ms', name: 'Mundo Novo', state_code: 'MS' }];
    else if (resource === 'categories') body = [{ id: 'eletrica', name: 'Elétrica' }];
    else if (resource === 'businesses' && url.searchParams.get('select') === 'category_id' && options.missingCategory) {
      body = { code: '42703', message: 'missing category_id' }; status = 400;
    } else if (resource === 'businesses' && method === 'PATCH') body = { id: bid };
    else if (resource === 'businesses' && url.searchParams.has('slug')) body = options.ownDraft ? [{ id: bid, status: 'draft' }] : [];
    else if (resource === 'create_business') {
      if (options.creationError) { body = { code: '23505', message: 'duplicate' }; status = 409; }
      else body = bid;
    } else if (resource === 'business_details' && method === 'GET') body = [];
    else if (resource === 'business_service_areas' && method === 'GET') body = [{ city_id: 'mundo-novo-ms' }, { city_id: 'removed-city' }];
    else if (method !== 'GET') { body = null; status = 201; }
    return new Response(body === null ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });
  const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetcher },
  });
  vi.spyOn(client.auth, 'getUser').mockResolvedValue({ data: { user: { id: 'test-user', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' } }, error: null });
  return { repository: createProfessionalRepository(client), requests };
}

describe('adaptador HTTP Supabase para cadastro', () => {
  it('cria usando RPC existente sem enviar proprietário, permissões ou status', async () => {
    const { repository, requests } = setup();
    expect(await repository.createDraft(input, 'test-slug')).toBe(bid);
    const rpc = requests.find((request) => request.path.endsWith('/rpc/create_business'));
    expect(rpc?.body).toEqual({ business_name: input.name, business_slug: 'test-slug', business_type: 'empresa', initial_city_id: 'mundo-novo-ms' });
    expect(requests.some((request) => request.path.endsWith('/businesses') && request.method === 'POST')).toBe(false);
  });

  it('reutiliza rascunho associado à mesma conta para a mesma tentativa', async () => {
    const { repository, requests } = setup({ ownDraft: true });
    expect(await repository.createDraft(input, 'test-slug')).toBe(bid);
    expect(requests.some((request) => request.path.endsWith('/rpc/create_business'))).toBe(false);
  });

  it('mantém dados legais separados e nunca envia status na edição', async () => {
    const { repository, requests } = setup();
    await repository.saveDraft(bid, input);
    const businessPatch = requests.find((request) => request.path.endsWith('/businesses') && request.method === 'PATCH');
    expect(businessPatch?.body).toEqual({ type: 'empresa', name: input.name, category_id: 'eletrica', description: null, city_id: 'mundo-novo-ms', whatsapp: '5567999991234', instagram: null });
    const detailsInsert = requests.find((request) => request.path.endsWith('/business_details') && request.method === 'POST');
    expect(detailsInsert?.body).toEqual({ business_id: bid, legal_name: 'Razão de teste', tax_id: '12345678000199' });
    expect(requests.some((request) => request.path.endsWith('/business_service_areas') && request.method === 'POST')).toBe(true);
    expect(requests.some((request) => request.path.endsWith('/business_service_areas') && request.method === 'DELETE')).toBe(true);
  });

  it('bloqueia toda escrita quando a migração de categoria ainda não está aplicada', async () => {
    const { repository, requests } = setup({ missingCategory: true });
    await expect(repository.createDraft(input, 'test-slug')).rejects.toEqual({ code: 'SETUP_REQUIRED' });
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
  });

  it('nega edição de terceiro antes de enviar mutações', async () => {
    const { repository, requests } = setup({ noMembership: true });
    await expect(repository.saveDraft(bid, input)).rejects.toEqual({ code: 'NOT_MANAGER' });
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
  });

  it('propaga colisão sem criar serviços fictícios ou novas associações', async () => {
    const { repository, requests } = setup({ creationError: true });
    await expect(repository.createDraft(input, 'duplicate-slug')).rejects.toMatchObject({ code: '23505' });
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    expect(requests.some((request) => request.path.endsWith('/services'))).toBe(false);
  });
});
