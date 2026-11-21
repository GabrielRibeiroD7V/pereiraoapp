import { categories } from '../config/categories';
import type { PublicFilters } from './types';

export const validSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 160;
export const validId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const pageNumber = (value: string | number | null) => Math.min(1000, Math.max(1, Math.floor(Number(value) || 1)));
export function readFilters(params: URLSearchParams): PublicFilters {
  const category = params.get('categoria') ?? '';
  const city = params.get('cidade');
  const type = params.get('tipo');
  return { query: (params.get('q') ?? '').trim().slice(0, 200),
    categoryId: categories.some((item) => item.id === category) ? category : '',
    cityId: city === 'todas' ? '' : city && validSlug(city) ? city : 'mundo-novo-ms',
    type: type === 'autonomo' || type === 'empresa' ? type : '' };
}
// Não interpolar sintaxe PostgREST fornecida pelo usuário em expressões OR.
export function searchTerm(value: string) {
  return value.normalize('NFC').slice(0, 200).replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim();
}
export function whatsappLink(value: string | null, name: string) {
  if (!value || !/^[+\d\s().-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  if (!/^[1-9][0-9]{9,14}$/.test(digits)) return null;
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
export function imagePath(id: string, path: string) {
  return validId(id) && path.startsWith(`${id}/portfolio/`) && /^[0-9a-f-]{36}\.(?:webp|png|jpe?g)$/i.test(path.slice(`${id}/portfolio/`.length))
    && validId(path.slice(`${id}/portfolio/`.length).replace(/\.[^.]+$/, ''));
}
