import { safeReturnPath } from './returnPath';

const key = 'pereirao.auth.return';
const lifetime = 24 * 60 * 60 * 1000;

// Apenas um destino local permitido; não armazena e-mail, senha ou tokens.
export function rememberAuthReturn(next?: string) {
  try { localStorage.setItem(key, JSON.stringify({ path: safeReturnPath(next ?? null), at: Date.now() })); }
  catch { /* Auth continua disponível quando o armazenamento está bloqueado. */ }
}

export function readAuthReturn() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (value && typeof value === 'object' && 'path' in value && 'at' in value
      && typeof value.path === 'string' && typeof value.at === 'number'
      && value.at <= Date.now() && Date.now() - value.at < lifetime) return safeReturnPath(value.path);
  } catch { /* Estado ausente ou inválido retorna à conta. */ }
  return '/conta';
}

export function clearAuthReturn() {
  try { localStorage.removeItem(key); } catch { /* Sem estado persistente. */ }
}
