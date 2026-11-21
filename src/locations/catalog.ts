import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';

// Pagina também o catálogo: nenhum município ativo some após os primeiros 200.
export async function activeCities(client: SupabaseClient<Database>, signal?: AbortSignal) {
  const cities: { id: string; name: string; state_code: string }[] = [];
  const size = 200;
  for (let offset = 0; ; offset += size) {
    let query = client.from('cities').select('id,name,state_code').eq('active', true)
      .order('name').order('state_code').order('id').range(offset, offset + size - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    cities.push(...(data ?? []));
    if (!data || data.length < size) return cities;
  }
}
