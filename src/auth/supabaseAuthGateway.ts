import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import type { AuthGateway, AuthSession } from './types';

function mapSession(session: Session | null): AuthSession | null {
  if (!session) return null;
  const name: unknown = session.user.user_metadata.display_name;
  return { user: { id: session.user.id, email: session.user.email ?? null,
    displayName: typeof name === 'string' ? name : '' } };
}

export function callbackUrl(origin: string, recovery = false) {
  const url = new URL('/auth/retorno', origin);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('Invalid callback origin');
  if (recovery) url.searchParams.set('flow', 'recovery');
  return url.href;
}

export function createAuthGateway(client: SupabaseClient<Database>, origin: () => string): AuthGateway {
  let callback: { code: string; pending: Promise<void> } | null = null;
  return {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return mapSession(data.session);
    },
    subscribe(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => listener(mapSession(session)));
      // Callback síncrono: não executar chamadas Supabase dentro do lock de Auth.
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signUp(email, password, displayName) {
      const { data, error } = await client.auth.signUp({ email, password, options: {
        emailRedirectTo: callbackUrl(origin()), data: { display_name: displayName },
      } });
      if (error) throw error;
      return { confirmationRequired: !data.session };
    },
    async requestReset(email) {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl(origin(), true) });
      if (error) throw error;
    },
    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    completeCallback(code) {
      // Uma troca por código, inclusive com efeitos duplicados do StrictMode.
      if (callback?.code === code) return callback.pending;
      const pending = (async () => {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error) throw error;
      })();
      callback = { code, pending };
      return pending;
    },
  };
}
