import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, BusinessRow, MembershipRow, ServiceRow } from '../lib/database.types';
import type { ProviderService, ServicePrice } from '../types/domain';
import { categories } from '../config/categories';

export interface AccountProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  memberships: readonly Pick<MembershipRow, 'business_id' | 'role'>[];
}

export function servicePrice(row: Pick<ServiceRow, 'pricing_type' | 'price_amount_cents'>): ServicePrice {
  if (row.pricing_type === 'quote' && row.price_amount_cents === null) return { type: 'quote' };
  if ((row.pricing_type === 'fixed' || row.pricing_type === 'starting-at') && Number.isSafeInteger(row.price_amount_cents) && row.price_amount_cents! >= 0) {
    return { type: row.pricing_type, amountInCents: row.price_amount_cents!, currency: 'BRL' };
  }
  throw new Error('Invalid service price');
}

export function mapService(row: ServiceRow): ProviderService {
  if (!categories.some((category) => category.id === row.category_id)) throw new Error('Unknown category');
  return { id: row.id, providerId: row.business_id, name: row.name,
    description: row.description, image: null, price: servicePrice(row) };
}

// Sem service_role. Toda operação usa a sessão do cliente e depende de RLS.
// Os caminhos de Storage não são convertidos em URLs públicas arbitrárias.
export function createFoundationRepository(client: SupabaseClient<Database>) {
  return {
    async getCurrentProfile(): Promise<AccountProfile | null> {
      const { data: userData, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      if (!userData.user) return null;
      const id = userData.user.id;
      const [profileResult, membersResult] = await Promise.all([
        client.from('profiles').select('id,display_name,avatar_url').eq('id', id).maybeSingle(),
        client.from('business_members').select('business_id,role').eq('user_id', id),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (membersResult.error) throw membersResult.error;
      if (!profileResult.data) return null;
      return { id, displayName: profileResult.data.display_name, avatarUrl: profileResult.data.avatar_url,
        memberships: membersResult.data ?? [] };
    },
    async getPublishedBusinesses(cityId: string, signal?: AbortSignal): Promise<readonly BusinessRow[]> {
      let query = client.from('businesses').select('*').eq('status', 'published').eq('city_id', cityId).order('name').limit(50);
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    async getActiveServices(businessId: string): Promise<readonly ProviderService[]> {
      const { data, error } = await client.from('services').select('*').eq('business_id', businessId).eq('active', true).order('name');
      if (error) throw error;
      return (data ?? []).map(mapService);
    },
    async createBusiness(input: Database['public']['Functions']['create_business']['Args']): Promise<string> {
      const { data, error } = await client.rpc('create_business', input);
      if (error) throw error;
      return data;
    },
  };
}
