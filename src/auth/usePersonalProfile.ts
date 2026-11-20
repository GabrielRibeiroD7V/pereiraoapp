import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import type { PersonalProfile } from './types';

export function usePersonalProfile() {
  const { session, gateway } = useAuth();
  const [profile, setProfile] = useState<PersonalProfile | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(Boolean(session && gateway?.getProfile));
  useEffect(() => {
    let live = true;
    setProfile(null); setError(false);
    setLoading(Boolean(session && gateway?.getProfile));
    if (session && gateway?.getProfile) void gateway.getProfile().then((value) => { if (live) setProfile(value); })
      .catch(() => { if (live) setError(true); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [session?.user.id, gateway]);
  return { profile: profile ?? { displayName: session?.user.displayName || 'Sua conta', avatarUrl: null }, loading, error };
}
