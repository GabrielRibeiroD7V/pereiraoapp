// Tipos manuais das duas migrações aplicadas. O cliente não gerencia publicação.
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
  city_id: string; category_id: string | null; whatsapp: string | null; instagram: string | null; avatar_path: string | null;
  status: 'draft' | 'published' | 'unpublished'; created_at: string; updated_at: string;
}
export type ServiceRow = {
  id: string; business_id: string; category_id: string; name: string; description: string | null;
  pricing_type: 'fixed' | 'starting-at' | 'quote'; price_amount_cents: number | null;
  active: boolean; created_at: string; updated_at: string;
}
export type PortfolioRow = {
  id: string; business_id: string; service_id: string | null; storage_path: string;
  caption: string | null; sort_order: number; created_at: string; media_state: 'pending' | 'ready' | 'deleting';
}
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type WorkPostRow = { id: string; business_id: string; title: string; description: string; status: 'draft' | 'published' | 'unpublished'; created_at: string; updated_at: string; published_at: string | null };
export interface Database {
  public: {
    Tables: {
      work_posts: Table<WorkPostRow, never, never>;
      work_post_images: Table<{ post_id: string; business_id: string; portfolio_item_id: string; sort_order: number }, never, never>;
      profiles: Table<ProfileRow, never, Partial<Pick<ProfileRow, 'display_name' | 'avatar_url'>>>;
      cities: Table<{ id: string; name: string; state_code: string; slug: string; active: boolean }, never, never>;
      categories: Table<{ id: string; name: string; active: boolean }, never, never>;
      businesses: Table<BusinessRow, never, Partial<Pick<BusinessRow, 'name' | 'slug' | 'type' | 'category_id' | 'description' | 'city_id' | 'whatsapp' | 'instagram' | 'avatar_path'>>>;
      business_members: Table<MembershipRow, never, never>;
      business_details: Table<{ business_id: string; legal_name: string | null; tax_id: string | null; updated_at: string }>;
      services: Table<ServiceRow, Pick<ServiceRow, 'id' | 'business_id' | 'category_id' | 'name' | 'description' | 'pricing_type' | 'price_amount_cents' | 'active'>, Partial<Pick<ServiceRow, 'category_id' | 'name' | 'description' | 'pricing_type' | 'price_amount_cents' | 'active'>>>;
      portfolio_items: Table<PortfolioRow, never, Partial<Pick<PortfolioRow, 'caption' | 'service_id'>>>;
      business_service_areas: Table<{ business_id: string; city_id: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      admin_access: {Args: Record<string, never>; Returns: boolean};
      admin_query: {Args: {section: string; filters?: Json}; Returns: Json};
      admin_action: {Args: {kind:string; target:string; command:string; reason:string; expected_state:string}; Returns: Json};
      work_post_command: { Args: { command: string; target_business: string; target_post: string; post_title?: string; post_description?: string; photo_ids?: string[] }; Returns: Json };
      portfolio_command: { Args: { command: string; target_business: string; target_item?: string; target_service?: string | null; item_caption?: string | null; ordered_items?: string[] }; Returns: Json };
      delete_business_service: { Args: { target_business: string; target_service: string }; Returns: undefined };
      create_business: {
        Args: { business_name: string; business_slug: string; business_type: 'autonomo' | 'empresa'; initial_city_id: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
