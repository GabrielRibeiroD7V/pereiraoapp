/** Protocolo público: somente identidade de build. Nunca lê dados, sessão ou URLs privadas. */
export function workerVersion(worker: ServiceWorker | null | undefined): Promise<string | null> {
  if (!worker || typeof MessageChannel === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    const channel = new MessageChannel();
    let finished = false;
    const done = (version: string | null) => {
      if (finished) return;
      finished = true; clearTimeout(timeout); channel.port1.close(); channel.port2.close(); resolve(version);
    };
    const timeout = setTimeout(() => done(null), 500);
    channel.port1.onmessage = event => {
      const data: unknown = event.data;
      const value = data && typeof data === 'object' && 'version' in data ? data.version : null;
      done(typeof value === 'string' && /^[a-f0-9]{20}$/.test(value) ? value : null);
    };
    try { worker.postMessage({ type: 'PEREIRAO_GET_VERSION' }, [channel.port2]); }
    catch { done(null); }
  });
}
export interface PwaDiagnostics {
  origin: string;
  installed: boolean;
  running: string | null;
  published: string | null;
  publishedCheckedAt: string | null;
  online: boolean;
  controller: string | null;
  active: { state: string; version: string | null } | null;
  waiting: { state: string; version: string | null } | null;
  installing: string | null;
  staticCacheVersions: string[];
  restoredFromHistory: boolean | null;
}
