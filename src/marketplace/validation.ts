import type { PublicFilters } from './types';
export {validId,imagePath} from '../lib/mediaPath';

export const validSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 160;
export const pageNumber = (value: string | number | null) => Math.min(1000, Math.max(1, Math.floor(Number(value) || 1)));
export function readFilters(params: URLSearchParams): PublicFilters {
  const category = params.get('categoria') ?? '';
  const city = params.get('cidade');
  const type = params.get('tipo');
  return { query: (params.get('q') ?? '').trim().slice(0, 200),
    // Valida sintaxe; o catálogo ativo e a consulta ao banco decidem a existência.
    // Nunca transforma um ID legítimo novo em uma busca sem filtro.
    categoryId: validSlug(category) ? category : '',
    cityId: city === 'todas' ? '' : city && validSlug(city) ? city : 'mundo-novo-ms',
    type: type === 'autonomo' || type === 'empresa' ? type : '' };
}
// Não interpolar sintaxe PostgREST fornecida pelo usuário em expressões OR.
export function searchTerm(value: string) {
  return value.normalize('NFC').slice(0, 200).replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim();
}
export function whatsappLink(value: string | null, name: string) {
  if (!value || !/^[+\d\s().-]+$/.test(value)) return null;
  let digits = value.replace(/\D/g, '');
  if (!/^[1-9][0-9]{9,14}$/.test(digits)) return null;
  // Compatibilidade de leitura: DDD + número brasileiro salvo sem DDI.
  // Não altera o registro nem duplica 55; + explícito preserva outro país.
  const nationalBrazil = /^(?:1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[134579]|8[1-9]|9[1-9])(?:9[0-9]{8}|[2-5][0-9]{7})$/;
  if (!value.trim().startsWith('+') && nationalBrazil.test(digits)) digits = '55' + digits;
  const message = `Olá! Encontrei o perfil de ${name} no PEREIRÃO e gostaria de saber mais sobre seus serviços.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
export function instagramLink(value: string | null) {
  if (!value) return null;
  let username = value.trim();
  if (/^https:\/\//i.test(username)) {
    try { const url = new URL(username); if (!['instagram.com', 'www.instagram.com'].includes(url.hostname) || url.username || url.password || url.port || url.search || url.hash) return null;
      username = url.pathname.replace(/^\//, '').replace(/\/$/, '');
    } catch { return null; }
  } else username = username.replace(/^@/, '');
  if (!/^[A-Za-z0-9_](?:[A-Za-z0-9._]{0,28}[A-Za-z0-9_])?$/.test(username) || username.includes('..')) return null;
  return `https://www.instagram.com/${username}/`;
}
