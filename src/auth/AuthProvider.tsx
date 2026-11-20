import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { createAuthGateway } from './supabaseAuthGateway';
import { authErrorMessage } from './errors';
import type { AuthGateway, AuthSession } from './types';

export const defaultAuthGateway = supabase ? createAuthGateway(supabase, () => window.location.origin) : null;
interface AuthContextValue {
  gateway: AuthGateway | null;
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, gateway = defaultAuthGateway }: { children: ReactNode; gateway?: AuthGateway | null }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(Boolean(gateway));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let receivedEvent = false;
    setLoading(Boolean(gateway));
    setError(null);
    setSession(null);
    if (!gateway) return;
    const unsubscribe = gateway.subscribe((next) => {
      receivedEvent = true;
      if (live) { setSession(next); setError(null); setLoading(false); }
    });
    void gateway.getSession().then((initial) => {
      if (live && !receivedEvent) setSession(initial);
    }).catch((cause: unknown) => {
      if (live && !receivedEvent) setError(authErrorMessage(cause));
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; unsubscribe(); };
  }, [gateway]);
  return <AuthContext.Provider value={{ gateway, session, loading, error }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider required');
  return value;
}
