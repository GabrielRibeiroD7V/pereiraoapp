import type { City, ProviderType } from '../types/domain';
import type { ServiceRow } from '../lib/database.types';

// Projeções públicas: sem proprietário, memberships, dados legais ou perfil pessoal.
export interface PublicProvider {
  id: string; slug: string; name: string; type: ProviderType; description: string | null;
  categoryId: string | null; specialty: string; additionalSpecialties?: { id: string; name: string }[]; city: City; avatarPath: string | null;
  whatsapp: string | null; instagram: string | null;
}
export type PublicService = Pick<ServiceRow, 'id' | 'name' | 'description' | 'pricing_type' | 'price_amount_cents'>;
export interface PublicPhoto { id: string; caption: string | null; storagePath: string; serviceName?:string|null; serviceAssociated?:boolean }
export interface PublicPage<T> { items: T[]; page: number; hasNext: boolean }
export interface PublicFilters { query: string; categoryId: string; cityId: string; type: '' | ProviderType }
export interface PublicMarketplace {
  search(filters: PublicFilters, page: number, signal?: AbortSignal): Promise<PublicPage<PublicProvider>>;
  getProvider(slug: string, signal?: AbortSignal): Promise<PublicProvider | null>;
  getCities(signal?: AbortSignal): Promise<City[]>;
  getAreas(id: string, page: number, signal?: AbortSignal): Promise<PublicPage<City>>;
  getServices(id: string, page: number, signal?: AbortSignal): Promise<PublicPage<PublicService>>;
  getPhotos(id: string, page: number, signal?: AbortSignal): Promise<PublicPage<PublicPhoto>>;
  getPhoto(id: string, photoId: string, signal?: AbortSignal): Promise<PublicPhoto | null>;
  getImageUrl(id: string, path: string): Promise<string>;
}
