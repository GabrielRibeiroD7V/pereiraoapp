// Tipos escritos a partir da migração PROPOSTA; não gerados do banco remoto vazio.
// Regenerar com Supabase CLI após aplicação autorizada em ambiente de desenvolvimento.
type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row; Insert: Insert; Update: Update; Relationships: [];
};
export type ProfileRow = {
  id: string; display_name: string; avatar_url: string | null; created_at: string; updated_at: string;
}
export type MembershipRow = {
  id: string; business_id: string; user_id: string; role: 'owner' | 'admin' | 'viewer'; created_at: string;
}
export type BusinessRow = {
  id: string; type: 'autonomo' | 'empresa'; name: string; slug: string; description: string | null;
  city_id: string; whatsapp: string | null; instagram: string | null; avatar_path: string | null;
  status: 'draft' | 'published' | 'unpublished'; created_at: string; updated_at: string;
}
export type ServiceRow = {
  id: string; business_id: string; category_id: string; name: string; description: string | null;
  pricing_type: 'fixed' | 'starting-at' | 'quote'; price_amount_cents: number | null;
  active: boolean; created_at: string; updated_at: string;
}
export type PortfolioRow = {
  id: string; business_id: string; service_id: string | null; storage_path: string;
  caption: string | null; sort_order: number; created_at: string;
}
export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow, never, Pick<ProfileRow, 'display_name' | 'avatar_url'>>;
      cities: Table<{ id: string; name: string; state_code: string; slug: string; active: boolean }, never, never>;
      categories: Table<{ id: string; name: string; active: boolean }, never, never>;
      businesses: Table<BusinessRow, never, Partial<Pick<BusinessRow, 'name' | 'slug' | 'type' | 'description' | 'city_id' | 'whatsapp' | 'instagram' | 'avatar_path' | 'status'>>>;
      business_members: Table<MembershipRow, never, never>;
      business_details: Table<{ business_id: string; legal_name: string | null; tax_id: string | null; updated_at: string }>;
      services: Table<ServiceRow>;
      portfolio_items: Table<PortfolioRow>;
      business_service_areas: Table<{ business_id: string; city_id: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      create_business: {
        Args: { business_name: string; business_slug: string; business_type: 'autonomo' | 'empresa'; initial_city_id: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
