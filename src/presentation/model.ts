export type Presentation = { headline: string; experience: string; education: string; certifications: string; professional_registration: string }
export const emptyPresentation: Presentation = { headline: '', experience: '', education: '', certifications: '', professional_registration: '' };
export const presentationLimits: Record<keyof Presentation, number> = { headline: 120, experience: 3000, education: 3000, certifications: 2000, professional_registration: 200 };
export function normalizePresentation(value: Presentation): Presentation {
  return Object.fromEntries(Object.entries(value).map(([key, text]) => [key, text.trim()])) as unknown as Presentation;
}
export function validatePresentation(value: Presentation) {
  return Object.entries(presentationLimits).some(([key, limit]) => value[key as keyof Presentation].length > limit) ? 'Confira o tamanho dos campos da apresentação.' : '';
}
export interface PresentationRepository {
  get(id: string, publicOnly?: boolean): Promise<{ available: boolean; data: Presentation }>;
  save(id: string, value: Presentation): Promise<void>;
}
