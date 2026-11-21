import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); localStorage.clear(); });
it('cliente público não herda a sessão persistida do proprietário', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://yazdjiwaksamizrbqewq.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_local_fixture');
  const network = vi.fn(() => Promise.reject(new Error('Network forbidden in this local test')));
  vi.stubGlobal('fetch', network);
  localStorage.setItem('sb-yazdjiwaksamizrbqewq-auth-token', JSON.stringify({ access_token: 'synthetic-local-token', refresh_token: 'synthetic-local-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600, token_type: 'bearer', user: { id: 'fixture-owner', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' } }));
  vi.resetModules();
  const { supabase, publicSupabase } = await import('../lib/supabase');
  try {
    expect((await supabase!.auth.getSession()).data.session?.user.id).toBe('fixture-owner');
    expect((await publicSupabase!.auth.getSession()).data.session).toBeNull();
    expect(network).not.toHaveBeenCalled();
  } finally { await supabase!.auth.stopAutoRefresh(); }
});
