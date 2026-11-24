import {useReturnRevision} from '../hooks/useReturnRevision';
import { useEffect, useState } from 'react';

// Chave inclui todos os parâmetros; respostas antigas não substituem uma nova busca.
export function usePublicQuery<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const resume=useReturnRevision();
  const [attempt, retry] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: boolean; loading: boolean }>({ key, loading: true });
  useEffect(() => {
    const controller = new AbortController();
    setState({ key, loading: true });
    void load(controller.signal).then((data) => { if (!controller.signal.aborted) setState({ key, data, loading: false }); })
      .catch(() => { if (!controller.signal.aborted) setState({ key, error: true, loading: false }); });
    return () => controller.abort();
  }, [key, load, attempt,resume]);
  const current = state.key === key ? state : { loading: true, data: undefined, error: undefined };
  return { data: current.data, loading: current.loading, error: current.error, retry: () => retry((n) => n + 1) };
}
