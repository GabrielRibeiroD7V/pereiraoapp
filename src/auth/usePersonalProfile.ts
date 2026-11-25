import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import type { PersonalProfile } from './types';

const personalProfileCaches = new WeakMap<object, Map<string, PersonalProfile>>();
function cacheFor(gateway: object | null) {
  if (!gateway) return null;
  let cache=personalProfileCaches.get(gateway);
  if(!cache){cache=new Map();personalProfileCaches.set(gateway,cache);}
  return cache;
}

export function usePersonalProfile() {
  const { session, gateway } = useAuth();
  const cache=cacheFor(gateway);
  const [profile, setProfile] = useState<PersonalProfile | null>(() => session ? cache?.get(session.user.id) ?? null : null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(Boolean(session && gateway?.getProfile && !cache?.has(session.user.id)));
  useEffect(() => {
    let live = true;
    setError(false);
    if (!session) { setProfile(null); setLoading(false); return; }
    const cached = cache?.get(session.user.id);
    setProfile(cached ?? null);
    setLoading(Boolean(gateway?.getProfile && !cached));
    if (gateway?.getProfile) void gateway.getProfile().then((value) => { if (live) { cache?.set(session.user.id, value); setProfile(value); } })
      .catch(() => { if (live) setError(true); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [session?.user.id, gateway, cache]);
  return { profile: profile ?? { displayName: session?.user.displayName || 'Sua conta', avatarUrl: null }, loading, error };
}
