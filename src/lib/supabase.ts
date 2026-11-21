import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export function validPublicConfig(url: string | undefined, key: string | undefined) {
  if (!url || !key?.startsWith('sb_publishable_')) return false;
  try {
    const parsed = new URL(url);
    return parsed.origin === 'https://yazdjiwaksamizrbqewq.supabase.co' && parsed.pathname === '/'
      && !parsed.username && !parsed.password && !parsed.search && !parsed.hash;
  } catch { return false; }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

// Ausência de configuração não bloqueia o marketplace público nem o build.
export const supabase = validPublicConfig(url, key) ? createClient<Database>(url!, key!, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
}) : null;

// Marketplace sempre consulta como visitante, inclusive com proprietário logado.
// Não lê, copia ou persiste a sessão do cliente acima.
export const publicSupabase = validPublicConfig(url, key) ? createClient<Database>(url!, key!, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'pereirao-public-read' },
}) : null;
