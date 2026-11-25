/** Contratos de domínio, independentes do formato futuro das tabelas Supabase. */
// IDs vêm do catálogo ativo; as seis ilustrações da Home são um recorte editorial.
export type CategoryId = string;

export interface City {
  id: string;
  name: string;
  state: string;
}

export interface OfficialCategoryImage {
  kind: 'official-category';
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface ProviderImage {
  kind: 'provider-upload';
  providerId: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface Category {
  id: CategoryId;
  name: string;
  officialImage: OfficialCategoryImage | null;
}

export type ProviderType = 'autonomo' | 'empresa';
export type PublicationStatus = 'draft' | 'published' | 'unpublished';

export interface RatingSummary {
  average: number;
  count: number;
}

export interface Provider {
  id: string;
  slug: string;
  ownerId: string;
  name: string;
  type: ProviderType;
  categoryId: CategoryId;
  specialty: string;
  city: City;
  serviceArea: string | null;
  about: string | null;
  avatar: ProviderImage | null;
  rating: RatingSummary | null;
  verification: { verifiedAt: string } | null;
  publicationStatus: PublicationStatus;
  whatsapp: string | null;
  instagram: string | null;
}

/** Preços em centavos; impedir combinações ambíguas como valor + sob orçamento. */
export type ServicePrice =
  | { type: 'quote' }
  | { type: 'fixed' | 'starting-at'; amountInCents: number; currency: 'BRL' };

export interface ProviderService {
  id: string;
  providerId: string;
  name: string;
  description: string | null;
  image: ProviderImage | null;
  price: ServicePrice;
}

export interface PortfolioItem {
  id: string;
  providerId: string;
  image: ProviderImage;
  caption: string | null;
}

export interface SearchFilters {
  query: string;
  cityId: string;
  categoryId?: CategoryId;
  providerType?: ProviderType;
}

export interface PageResult<T> {
  items: readonly T[];
  total: number;
  page: number;
  pageSize: number;
}

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };

export interface Account {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  professionalProfileId: string | null;
}
