export type OfferKind = "service" | "product";
export type ResultKind = OfferKind | "provider" | "project";
export interface Offer {
  id: string;
  source: "offer" | "legacy";
  business_id: string;
  kind: OfferKind;
  name: string;
  description: string;
  area_id: string;
  activity_ids: string[];
  pricing_type: "fixed" | "starting-at" | "quote";
  price_amount_cents: number | null;
  active: boolean;
  featured: boolean;
  image_id: string | null;
  image_path: string | null;
  created_at: string;
  updated_at?: string;
  author: string;
  slug: string;
}
export interface OfferInput {
  kind: OfferKind;
  name: string;
  description: string;
  areaId: string;
  activityIds: string[];
  pricingType: Offer["pricing_type"];
  price: string;
  active: boolean;
  featured: boolean;
  expectedUpdatedAt?: string;
}
export interface OfferCatalog {
  areas: { id: string; name: string }[];
  activities: {
    id: string;
    name: string;
    kind: "service" | "product" | "both";
  }[];
  links: { area_id: string; activity_id: string }[];
}
export interface SearchResult {
  id: string;
  kind: ResultKind;
  title: string;
  description: string;
  author: string;
  url: string;
  business_id: string | null;
  pricing_type: Offer["pricing_type"] | null;
  price_amount_cents: number | null;
  score: number;
}
export interface OfferFilters {
  query: string;
  city: string;
  area: string;
  kind: ResultKind | "";
  page: number;
  providerType: string;
}
export interface OffersRepository {
  postOffer(kind: string, post: string): Promise<Offer | null>;
  linkPost(kind: string, post: string, offer: Offer | null): Promise<void>;
  catalog(): Promise<OfferCatalog>;
  list(business: string, privateView: boolean): Promise<Offer[]>;
  get(id: string, source: string): Promise<Offer | null>;
  search(filters: OfferFilters): Promise<SearchResult[]>;
  save(business: string, id: string, input: OfferInput): Promise<Offer>;
  remove(business: string, id: string): Promise<void>;
  image(path: string): Promise<string>;
  upload(
    business: string,
    id: string,
    imageId: string,
    blob: Blob,
  ): Promise<void>;
}
export const kindLabel: Record<ResultKind, string> = {
  service: "Serviço",
  product: "Produto",
  provider: "Profissional",
  project: "Projeto",
};
export const emptyOffer = (kind: OfferKind): OfferInput => ({
  kind,
  name: "",
  description: "",
  areaId: "",
  activityIds: [],
  pricingType: "quote",
  price: "",
  active: false,
  featured: false,
});
export function offerInput(o: Offer): OfferInput {
  return {
    kind: o.kind,
    name: o.name,
    description: o.description,
    areaId: o.area_id,
    activityIds: o.activity_ids,
    pricingType: o.pricing_type,
    price:
      o.price_amount_cents === null
        ? ""
        : (o.price_amount_cents / 100).toFixed(2).replace(".", ","),
    active: o.active,
    featured: o.featured,
    expectedUpdatedAt: o.updated_at,
  };
}
