import {useReturnRevision} from '../hooks/useReturnRevision';
import { useEffect, useState } from 'react';

type CacheEntry = { data: unknown; expiresAt: number };
const publicQueryCache = new Map<string, CacheEntry>();
function cached<T>(key: string) {
  const entry = publicQueryCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) publicQueryCache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

// Chave inclui todos os parâmetros; respostas antigas não substituem uma nova busca.
export function usePublicQuery<T>(key: string, load: (signal: AbortSignal) => Promise<T>, keepPreviousData = false, cacheMs = 0) {
  const resume=useReturnRevision();
  const [attempt, retry] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: boolean; loading: boolean }>(() => {
    const data = cacheMs ? cached<T>(key) : undefined;
    return data === undefined ? { key, loading: true } : { key, data, loading: false };
  });
  useEffect(() => {
    const controller = new AbortController();
    const restored = cacheMs ? cached<T>(key) : undefined;
    setState(old => old.key === key && old.data !== undefined
      ? {...old, loading:false, error:false}
      : restored !== undefined
        ? {key, data:restored, loading:false}
        : keepPreviousData && old.key === key ? {...old, loading:true, error:false} : { key, loading: true });
    void load(controller.signal).then((data) => { if (!controller.signal.aborted) {
      if (cacheMs) {
        publicQueryCache.set(key, {data, expiresAt: Date.now() + cacheMs});
        if (publicQueryCache.size > 100) publicQueryCache.delete(publicQueryCache.keys().next().value!);
      }
      setState({ key, data, loading: false });
    } })
      .catch(() => { if (!controller.signal.aborted) setState(old => ({ ...old, key, error: true, loading: false })); });
    return () => controller.abort();
  }, [key, load, attempt,resume,keepPreviousData,cacheMs]);
  const current = state.key === key ? state : { loading: true, data: undefined, error: undefined };
  return { data: current.data, loading: current.loading, error: current.error, retry: () => retry((n) => n + 1) };
}
