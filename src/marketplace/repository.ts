import { missingSpecialties } from '../lib/specialtiesSchema';
import { activeCities } from '../locations/catalog';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import type { City } from '../types/domain';
import type { PublicMarketplace, PublicPage, PublicProvider, PublicService } from './types';
import { imagePath, pageNumber, searchTerm, validId, validSlug } from './validation';

export const SEARCH_SIZE = 20;
export const DETAIL_SIZE = 12;
export const LEGACY_PUBLIC_COLUMNS = 'id,slug,name,type,description,city_id,category_id,whatsapp,instagram,avatar_path,city:cities!businesses_city_id_fkey(id,name,state_code),category:categories!businesses_category_id_fkey(id,name)';
export const PUBLIC_COLUMNS = LEGACY_PUBLIC_COLUMNS + ',additional_categories:business_categories!business_categories_business_id_fkey(category:categories!business_categories_category_id_fkey(id,name))';
interface RawCity { id: string; name: string; state_code: string }
interface RawProvider { additional_categories?: { category: { id: string; name: string } | null }[]; id: string; slug: string; name: string; type: 'autonomo' | 'empresa'; description: string | null; category_id: string | null;
  whatsapp: string | null; instagram: string | null; avatar_path: string | null; city: RawCity | null; category: { id: string; name: string } | null }
const city = (row: RawCity): City => ({ id: row.id, name: row.name, state: row.state_code });
function provider(row: RawProvider): PublicProvider {
  return { id: row.id, slug: row.slug, name: row.name, type: row.type, description: row.description,
    categoryId: row.category_id, specialty: row.category?.name ?? 'Serviços locais',
    additionalSpecialties: (row.additional_categories ?? []).flatMap(item => item.category && item.category.id !== row.category_id ? [item.category] : []).sort((a,b) => a.name.localeCompare(b.name,'pt-BR')),
    city: row.city ? city(row.city) : { id: '', name: 'Localização não informada', state: '' },
    avatarPath: row.avatar_path, whatsapp: row.whatsapp, instagram: row.instagram };
}
function page<T>(items: T[], value: number, size: number): PublicPage<T> { return { items: items.slice(0, size), page: pageNumber(value), hasNext: items.length > size }; }
function empty<T>(value: number): PublicPage<T> { return { items: [], page: pageNumber(value), hasNext: false }; }

// Recebe um cliente SEM sessão, separado do cliente de gerenciamento da conta.
export function createPublicMarketplace(client: SupabaseClient<Database>): PublicMarketplace {
  let searchReady = true, relationReady = true;
  return {
    async search(filters, value, signal) {
      const current = pageNumber(value), term = searchTerm(filters.query);
      if (filters.query && !term) return empty(current);
      if (searchReady) {
        const result = await client.rpc('search_public_businesses', {
          p_query: term, p_category: filters.categoryId, p_city: filters.cityId,
          p_type: filters.type, p_page: current,
        }, { get: true }).abortSignal(signal ?? new AbortController().signal).overrideTypes<RawProvider[], { merge: false }>();
        if (!result.error) return page((result.data ?? []).map(provider), current, SEARCH_SIZE);
        if (!missingSpecialties(result.error, 'search_public_businesses')) throw result.error;
        searchReady = false; // Só a disponibilidade do recurso; nenhum dado ou sessão é cacheado.
      }
      const aliases = `${term ? ',service_matches:services!services_business_id_fkey(),category_matches:categories!businesses_category_id_fkey()' : ''}${filters.cityId ? ',area_matches:business_service_areas!business_service_areas_business_id_fkey()' : ''}`;
      let request = client.from('businesses').select(LEGACY_PUBLIC_COLUMNS + aliases).eq('status', 'published');
      if (filters.categoryId) request = request.eq('category_id', filters.categoryId);
      if (filters.type) request = request.eq('type', filters.type);
      if (filters.cityId) request = request.eq('area_matches.city_id', filters.cityId).not('area_matches', 'is', null);
      if (term) {
        const pattern = `"%${term}%"`;
        const folded = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        request = request.eq('service_matches.active', true)
          .or(`name.ilike.${pattern},description.ilike.${pattern}`, { referencedTable: 'service_matches' })
          .or(`name.ilike.${pattern},id.ilike."%${folded}%"`, { referencedTable: 'category_matches' })
          .or(`name.ilike.${pattern},description.ilike.${pattern},service_matches.not.is.null,category_matches.not.is.null`);
      }
      const result = await request.order('name').order('id').range((current - 1) * SEARCH_SIZE, current * SEARCH_SIZE).abortSignal(signal ?? new AbortController().signal).overrideTypes<RawProvider[], { merge: false }>();
      if (result.error) throw result.error;
      return page((result.data ?? []).map(provider), current, SEARCH_SIZE);
    },
    async getProvider(slug, signal) {
      if (!validSlug(slug)) return null;
      const read = (columns: string) => client.from('businesses').select(columns).eq('status', 'published').eq('slug', slug)
        .abortSignal(signal ?? new AbortController().signal).maybeSingle().overrideTypes<RawProvider | null, { merge: false }>();
      let result = await read(relationReady ? PUBLIC_COLUMNS : LEGACY_PUBLIC_COLUMNS);
      if (result.error && relationReady && missingSpecialties(result.error)) {
        relationReady = false;
        result = await read(LEGACY_PUBLIC_COLUMNS);
      }
      if (result.error) throw result.error;
      return result.data ? provider(result.data) : null;
    },
    async getCities(signal) {
      return (await activeCities(client, signal)).map(city);
    },
    async getAreas(id, value, signal) {
      if (!validId(id)) return empty(value);
      const current = pageNumber(value);
      const { data, error } = await client.from('business_service_areas').select('city:cities!inner(id,name,state_code),business:businesses!inner(status)')
        .eq('business_id', id).eq('business.status', 'published').order('city_id').range((current - 1) * DETAIL_SIZE, current * DETAIL_SIZE)
        .abortSignal(signal ?? new AbortController().signal).overrideTypes<{ city: RawCity }[], { merge: false }>();
      if (error) throw error; return page((data ?? []).map((row) => city(row.city)), current, DETAIL_SIZE);
    },
    async getServices(id, value, signal) {
      if (!validId(id)) return empty(value);
      const current = pageNumber(value);
      const { data, error } = await client.from('services').select('id,name,description,pricing_type,price_amount_cents,business:businesses!inner(status)')
        .eq('business_id', id).eq('active', true).eq('business.status', 'published').order('name').order('id')
        .range((current - 1) * DETAIL_SIZE, current * DETAIL_SIZE).abortSignal(signal ?? new AbortController().signal).overrideTypes<PublicService[], { merge: false }>();
      if (error) throw error;
      return page((data ?? []).map(({ id, name, description, pricing_type, price_amount_cents }) => ({ id, name, description, pricing_type, price_amount_cents })), current, DETAIL_SIZE);
    },
    async getPhotos(id, value, signal) {
      if (!validId(id)) return empty(value);
      const current = pageNumber(value);
      const { data, error } = await client.from('portfolio_items').select('id,caption,storage_path,business:businesses!inner(status)')
        .eq('business_id', id).eq('media_state', 'ready').eq('business.status', 'published').order('sort_order').order('id')
        .range((current - 1) * DETAIL_SIZE, current * DETAIL_SIZE).abortSignal(signal ?? new AbortController().signal)
        .overrideTypes<{ id: string; caption: string | null; storage_path: string }[], { merge: false }>();
      if (error) throw error; return page((data ?? []).map((row) => ({ id: row.id, caption: row.caption, storagePath: row.storage_path })), current, DETAIL_SIZE);
    },
    async getImageUrl(id, path) {
      if (!imagePath(id, path)) throw new Error('Invalid image path');
      const { data, error } = await client.storage.from('business-portfolio').createSignedUrl(path, 60);
      if (error) throw error;
      const parsed = new URL(data.signedUrl);
      if (parsed.origin !== 'https://yazdjiwaksamizrbqewq.supabase.co' || parsed.username || parsed.password || parsed.hash || parsed.pathname !== `/storage/v1/object/sign/business-portfolio/${path}`) throw new Error('Invalid image response');
      return data.signedUrl;
    },
  };
}
