import { activeCities } from '../locations/catalog';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import type { CategoryId } from '../types/domain';
import { categories } from '../config/categories';
import type { ProfessionalCatalog, ProfessionalRepository, RegistrationInput } from './types';
import { normalizeRegistration, validateRegistration } from './validation';

function fail(code: string): never { throw { code }; }
export function createProfessionalRepository(client: SupabaseClient<Database>): ProfessionalRepository {
  async function currentUid() {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return fail('AUTH_REQUIRED');
    return data.user.id;
  }
  async function managerIds() {
    const uid = await currentUid();
    const { data, error } = await client.from('business_members').select('business_id,role').eq('user_id', uid).in('role', ['owner', 'admin']);
    if (error) throw error;
    return (data ?? []).map((row) => row.business_id);
  }
  async function requireManager(id: string) {
    if (!(await managerIds()).includes(id)) fail('NOT_MANAGER');
  }
  async function getCatalog(): Promise<ProfessionalCatalog> {
    const [cities, categoryRows, readiness] = await Promise.all([
      activeCities(client),
      client.from('categories').select('id,name').eq('active', true).order('name'),
      client.from('businesses').select('category_id').limit(0),
    ]);
    if (readiness.error) {
      if (['42703', 'PGRST204'].includes(readiness.error.code)) fail('SETUP_REQUIRED');
      throw readiness.error;
    }
    if (categoryRows.error) throw categoryRows.error;
    return { cities, categories: (categoryRows.data ?? [])
      .filter((item) => categories.some((category) => category.id === item.id))
      .map((item) => ({ ...item, id: item.id as CategoryId })) };
  }
  async function ownBusinessBySlug(slug: string) {
    const ids = await managerIds();
    if (!ids.length) return null;
    const { data, error } = await client.from('businesses').select('id,status').in('id', ids).eq('slug', slug).maybeSingle();
    if (error) throw error;
    return data?.status === 'draft' ? data.id : null;
  }
  return {
    getCatalog,
    async listMine() {
      const ids = await managerIds();
      if (!ids.length) return [];
      const { data, error } = await client.from('businesses').select('*').in('id', ids).order('created_at');
      if (error) throw error;
      return data ?? [];
    },
    async getEditable(id) {
      await requireManager(id);
      const [businessResult, areaResult, detailsResult] = await Promise.all([
        client.from('businesses').select('*').eq('id', id).maybeSingle(),
        client.from('business_service_areas').select('city_id').eq('business_id', id),
        client.from('business_details').select('legal_name,tax_id').eq('business_id', id).maybeSingle(),
      ]);
      if (businessResult.error) throw businessResult.error;
      if (areaResult.error) throw areaResult.error;
      if (detailsResult.error) throw detailsResult.error;
      const business = businessResult.data;
      if (!business) return fail('NOT_FOUND');
      return { business, input: { type: business.type, name: business.name,
        categoryId: (business.category_id ?? '') as CategoryId | '', description: business.description ?? '',
        cityId: business.city_id, areaCityIds: (areaResult.data ?? []).map((row) => row.city_id),
        whatsapp: business.whatsapp ?? '', instagram: business.instagram ?? '',
        legalName: detailsResult.data?.legal_name ?? '', taxId: detailsResult.data?.tax_id ?? '' } };
    },
    async createDraft(input, slug) {
      const normalized = normalizeRegistration(input);
      const catalog = await getCatalog();
      if (validateRegistration(normalized, catalog, 3)) fail('INVALID_INPUT');
      const priorId = await ownBusinessBySlug(slug);
      if (priorId) return priorId;
      const { data, error } = await client.rpc('create_business', {
        business_name: normalized.name, business_slug: slug,
        business_type: normalized.type, initial_city_id: normalized.cityId,
      });
      if (error) {
        // Resposta perdida/concorrência: só recuperar um rascunho da mesma conta.
        const recovered = await ownBusinessBySlug(slug);
        if (recovered) return recovered;
        throw error;
      }
      return data;
    },
    async saveDraft(id, input: RegistrationInput) {
      await requireManager(id);
      const catalog = await getCatalog();
      const normalized = normalizeRegistration(input);
      if (validateRegistration(normalized, catalog, 3)) fail('INVALID_INPUT');
      const { error, data } = await client.from('businesses').update({
        type: normalized.type, name: normalized.name, category_id: normalized.categoryId || null,
        description: normalized.description || null, city_id: normalized.cityId,
        whatsapp: normalized.whatsapp || null, instagram: normalized.instagram || null,
      }).eq('id', id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) fail('NOT_MANAGER');
      if (normalized.type === 'empresa') {
        const existing = await client.from('business_details').select('business_id').eq('business_id', id).maybeSingle();
        if (existing.error) throw existing.error;
        const values = { legal_name: normalized.legalName || null, tax_id: normalized.taxId || null };
        let result = existing.data
          ? await client.from('business_details').update(values).eq('business_id', id)
          : await client.from('business_details').insert({ business_id: id, ...values });
        if (result.error?.code === '23505') result = await client.from('business_details').update(values).eq('business_id', id);
        if (result.error) throw result.error;
      }
      const insertAreas = await client.from('business_service_areas').upsert(
        normalized.areaCityIds.map((city_id) => ({ business_id: id, city_id })),
        { onConflict: 'business_id,city_id', ignoreDuplicates: true },
      );
      if (insertAreas.error) throw insertAreas.error;
      const existingAreas = await client.from('business_service_areas').select('city_id').eq('business_id', id);
      if (existingAreas.error) throw existingAreas.error;
      const removed = (existingAreas.data ?? []).map((row) => row.city_id).filter((city) => !normalized.areaCityIds.includes(city));
      if (removed.length) {
        const removedResult = await client.from('business_service_areas').delete().eq('business_id', id).in('city_id', removed);
        if (removedResult.error) throw removedResult.error;
      }
      // Nunca enviar status, proprietário ou permissões pelo formulário.
    },
  };
}
