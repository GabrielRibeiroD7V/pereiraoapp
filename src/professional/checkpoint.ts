// Somente IDs e slug; contatos e dados legais nunca são persistidos no navegador.
export interface Checkpoint { slug: string; businessId?: string }
const key = (uid: string) => `pereirao:registration:v1:${uid}`;
export function readCheckpoint(uid: string): Checkpoint | null {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(key(uid)) ?? 'null');
    if (!raw || typeof raw !== 'object' || !('slug' in raw) || typeof raw.slug !== 'string' || !/^[a-z0-9-]{1,160}$/.test(raw.slug)) return null;
    const id = 'businessId' in raw && typeof raw.businessId === 'string' && /^[a-f0-9-]{36}$/.test(raw.businessId) ? raw.businessId : undefined;
    return { slug: raw.slug, businessId: id };
  } catch { return null; }
}
export function writeCheckpoint(uid: string, value: Checkpoint) {
  try { sessionStorage.setItem(key(uid), JSON.stringify(value)); } catch { /* Storage pode estar indisponível; identidade também fica em memória. */ }
}
export function clearCheckpoint(uid: string) {
  try { sessionStorage.removeItem(key(uid)); } catch { /* Sem estado persistido disponível. */ }
}
