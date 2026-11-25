import { missingSpecialties } from '../lib/specialtiesSchema';
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
    const { data, error } = await client.from('business_members').select('business_id,role').eq('user_id', uid).eq('role', 'owner');
    if (error) throw error;
    return (data ?? []).map((row) => row.business_id);
  }
  async function requireManager(id: string) {
    if (!(await managerIds()).includes(id)) fail('NOT_MANAGER');
  }
  async function getCatalog(): Promise<ProfessionalCatalog> {
    const [cities, categoryRows, readiness, specialties] = await Promise.all([
      activeCities(client),
      client.from('categories').select('id,name').eq('active', true).order('name'),
      client.from('businesses').select('category_id').limit(0),
      client.from('business_categories').select('category_id').limit(0),
    ]);
    if (readiness.error) {
      if (['42703', 'PGRST204'].includes(readiness.error.code)) fail('SETUP_REQUIRED');
      throw readiness.error;
    }
    if (categoryRows.error) throw categoryRows.error;
    if (specialties.error && !missingSpecialties(specialties.error)) throw specialties.error;
    return { cities, specialtiesAvailable: !specialties.error, categories: (categoryRows.data ?? [])
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
    async publication(id, command, expectedState) {
      const {error}=await client.rpc('owner_business_command',{target_business:id,command,expected_state:expectedState});
      if(error)throw error;
    },
    getCatalog,
    async listMine() {
      const ids = await managerIds();
      if (!ids.length) return [];
      const { data, error } = await client.from('businesses').select('*').in('id', ids).order('created_at');
      if (error) throw error;
      return (data ?? []).filter(row => !row.deleted_at);
    },
    async getEditable(id) {
      await requireManager(id);
      const [businessResult, areaResult, detailsResult, specialtiesResult] = await Promise.all([
        client.from('businesses').select('*').eq('id', id).maybeSingle(),
        client.from('business_service_areas').select('city_id').eq('business_id', id),
        client.from('business_details').select('legal_name,tax_id').eq('business_id', id).maybeSingle(),
        client.from('business_categories').select('category_id').eq('business_id', id).order('category_id'),
      ]);
      if (businessResult.error) throw businessResult.error;
      if (areaResult.error) throw areaResult.error;
      if (detailsResult.error) throw detailsResult.error;
      if (specialtiesResult.error && !missingSpecialties(specialtiesResult.error)) throw specialtiesResult.error;
      const additionalIds = (specialtiesResult.data ?? []).map(row => row.category_id);
      const business = businessResult.data;
      if (!business) return fail('NOT_FOUND');
      return { business, input: { type: business.type, name: business.name,
        categoryId: (business.category_id ?? '') as CategoryId | '', additionalCategoryIds: additionalIds, expectedSpecialties: { primaryId: business.category_id, additionalIds }, description: business.description ?? '',
        cityId: business.city_id, areaCityIds: (areaResult.data ?? []).map((row) => row.city_id),
        whatsapp: business.whatsapp ?? '', instagram: business.instagram ?? '',
        legalName: detailsResult.data?.legal_name ?? '', taxId: detailsResult.data?.tax_id ?? '' } };
    },
    async createDraft(input, slug) {
      const normalized = normalizeRegistration(input);
      const catalog = await getCatalog();
      if (catalog.specialtiesAvailable === false && normalized.additionalCategoryIds.length) fail('SETUP_REQUIRED');
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
      if (catalog.specialtiesAvailable === false && normalized.additionalCategoryIds.length) fail('SETUP_REQUIRED');
      if (validateRegistration(normalized, catalog, 3)) fail('INVALID_INPUT');
      if (catalog.specialtiesAvailable !== false) {
        const { error } = await client.rpc('set_business_specialties', {
          target_business_id: id, primary_category_id: normalized.categoryId,
          additional_category_ids: normalized.additionalCategoryIds,
          expected_primary_category_id: input.expectedSpecialties?.primaryId ?? null,
          expected_additional_category_ids: input.expectedSpecialties?.additionalIds ?? [],
        });
        if (error) throw error;
      }
      const { error, data } = await client.from('businesses').update({
        type: normalized.type, name: normalized.name, ...(catalog.specialtiesAvailable === false ? { category_id: normalized.categoryId || null } : {}),
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
