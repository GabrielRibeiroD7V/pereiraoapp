export type Presentation = { profession: string; linkedin_url: string; headline: string; experience: string; education: string; certifications: string; professional_registration: string }
export const emptyPresentation: Presentation = { profession: '', linkedin_url: '', headline: '', experience: '', education: '', certifications: '', professional_registration: '' };
export const presentationLimits: Record<keyof Presentation, number> = { profession: 100, linkedin_url: 300, headline: 120, experience: 3000, education: 3000, certifications: 2000, professional_registration: 200 };
export function linkedinUrl(value: string): string | null {
  if (!value.trim()) return '';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || !['linkedin.com','www.linkedin.com'].includes(url.hostname) || url.username || url.password || url.port || url.search || url.hash || url.href.includes('?') || url.href.includes('#')
      || !/^\/(?:in|company)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return null;
    url.hostname = 'www.linkedin.com';
    return url.toString();
  } catch { return null; }
}
export function normalizePresentation(value: Presentation): Presentation {
  return { ...Object.fromEntries(Object.entries({ ...emptyPresentation, ...value }).map(([key, text]) => [key, text.trim()])), linkedin_url: linkedinUrl(value.linkedin_url) ?? value.linkedin_url.trim() } as Presentation;
}
export function validatePresentation(value: Presentation) {
  if (linkedinUrl(value.linkedin_url) === null) return 'Use um link HTTPS de perfil ou página do LinkedIn, sem parâmetros ou redirecionadores.';
  return Object.entries(presentationLimits).some(([key, limit]) => value[key as keyof Presentation].length > limit) ? 'Confira o tamanho dos campos da apresentação.' : '';
}
export interface PresentationRepository {
  get(id: string, publicOnly?: boolean): Promise<{ available: boolean; identityAvailable?: boolean; data: Presentation }>;
  save(id: string, value: Presentation): Promise<void>;
}
