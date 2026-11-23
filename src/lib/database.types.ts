// Contratos manuais das migrações versionadas; algumas ainda aguardam aplicação remota.
type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};
export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};
export type MembershipRow = {
  id: string;
  business_id: string;
  user_id: string;
  role: "owner" | "admin" | "viewer";
  created_at: string;
};
export type BusinessRow = {
  id: string;
  type: "autonomo" | "empresa";
  name: string;
  slug: string;
  description: string | null;
  city_id: string;
  category_id: string | null;
  whatsapp: string | null;
  instagram: string | null;
  avatar_path: string | null;
  profile_avatar_path?: string | null;
  status: "draft" | "published" | "unpublished";
  created_at: string;
  updated_at: string;
};
export type ServiceRow = {
  id: string;
  business_id: string;
  category_id: string;
  name: string;
  description: string | null;
  pricing_type: "fixed" | "starting-at" | "quote";
  price_amount_cents: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};
export type PortfolioRow = {
  id: string;
  business_id: string;
  service_id: string | null;
  storage_path: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
  media_state: "pending" | "ready" | "deleting";
};
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type BusinessSubscriptionRow = {
  business_id: string;
  plan_code: "professional";
  status: "trial" | "active" | "pending_payment" | "cancelled";
  trial_started_at: string;
  trial_original_ends_at: string;
  trial_ends_at: string;
  contracted_at: string | null;
  price_version_id: string | null;
  contracted_price_cents: number | null;
  billing_cycle: "monthly" | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  created_at: string;
  updated_at: string;
};
export type WorkPostRow = {
  id: string;
  business_id: string;
  title: string;
  description: string;
  status: "draft" | "published" | "unpublished";
  created_at: string;
  updated_at: string;
  published_at: string | null;
};
export interface Database {
  public: {
    Tables: {
      business_presentations: Table<import('../presentation/model').Presentation & { business_id: string }>;
      business_subscriptions: Table<BusinessSubscriptionRow, never, never>;
      work_posts: Table<WorkPostRow, never, never>;
      work_post_images: Table<
        {
          post_id: string;
          business_id: string;
          portfolio_item_id: string;
          sort_order: number;
        },
        never,
        never
      >;
      profiles: Table<
        ProfileRow,
        never,
        Partial<Pick<ProfileRow, "display_name" | "avatar_url">>
      >;
      cities: Table<
        {
          id: string;
          name: string;
          state_code: string;
          slug: string;
          active: boolean;
        },
        never,
        never
      >;
      categories: Table<
        { id: string; name: string; active: boolean },
        never,
        never
      >;
      businesses: Table<
        BusinessRow,
        never,
        Partial<
          Pick<
            BusinessRow,
            | "name"
            | "slug"
            | "type"
            | "category_id"
            | "description"
            | "city_id"
            | "whatsapp"
            | "instagram"
          >
        >
      >;
      business_categories: Table<{ business_id: string; category_id: string }, never, never>;
      business_members: Table<MembershipRow, never, never>;
      business_details: Table<{
        business_id: string;
        legal_name: string | null;
        tax_id: string | null;
        updated_at: string;
      }>;
      services: Table<
        ServiceRow,
        Pick<
          ServiceRow,
          | "id"
          | "business_id"
          | "category_id"
          | "name"
          | "description"
          | "pricing_type"
          | "price_amount_cents"
          | "active"
        >,
        Partial<
          Pick<
            ServiceRow,
            | "category_id"
            | "name"
            | "description"
            | "pricing_type"
            | "price_amount_cents"
            | "active"
          >
        >
      >;
      portfolio_items: Table<
        PortfolioRow,
        never,
        Partial<Pick<PortfolioRow, "caption" | "service_id">>
      >;
      business_service_areas: Table<{ business_id: string; city_id: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      admin_review_catalog: { Args: { target_business: string }; Returns: Json };
      save_business_presentation: { Args: { target_business: string; p_headline: string; p_experience: string; p_education: string; p_certifications: string; p_registration: string }; Returns: undefined };
      admin_profile_photo: { Args: { target_business: string }; Returns: string | null };
      profile_photo_command: { Args: { command: string; target_business: string; target_photo?: string; expected_avatar_path?: string | null }; Returns: Json };

      open_conversation: { Args: { target_business: string; message_body: string }; Returns: string };
      send_conversation_message: { Args: { target_conversation: string; message_body: string }; Returns: string };
      my_conversations: { Args: Record<string, never>; Returns: Json };
      my_conversation_messages: { Args: { target_conversation: string; before_message?: string | null }; Returns: Json };
      set_business_specialties: {
        Args: { target_business_id: string; primary_category_id: string; additional_category_ids: string[]; expected_primary_category_id: string | null; expected_additional_category_ids: string[] };
        Returns: undefined;
      };
      search_public_businesses: {
        Args: { p_query?: string; p_category?: string; p_city?: string; p_type?: string; p_page?: number };
        Returns: Json[];
      };
      search_public_businesses_profile: {
        Args: { p_query?: string; p_category?: string; p_city?: string; p_type?: string; p_page?: number };
        Returns: Json[];
      };
      sandbox_billing_server: {
        Args: {
          command: string;
          raw_payload: string;
          issued_at: number;
          nonce: string;
          signature: string;
        };
        Returns: Json;
      };
      my_subscriptions: {
        Args: { target_business?: string; page_number?: number };
        Returns: Json;
      };
      admin_subscription_overview: { Args: { filters?: Json }; Returns: Json };
      admin_extend_trial: {
        Args: {
          target_business: string;
          operation_id: string;
          days: number;
          reason: string;
          expected_end: string;
        };
        Returns: Json;
      };
      admin_access: { Args: Record<string, never>; Returns: boolean };
      admin_query: { Args: { section: string; filters?: Json }; Returns: Json };
      admin_action: {
        Args: {
          kind: string;
          target: string;
          command: string;
          reason: string;
          expected_state: string;
        };
        Returns: Json;
      };
      work_post_command: {
        Args: {
          command: string;
          target_business: string;
          target_post: string;
          post_title?: string;
          post_description?: string;
          photo_ids?: string[];
        };
        Returns: Json;
      };
      portfolio_command: {
        Args: {
          command: string;
          target_business: string;
          target_item?: string;
          target_service?: string | null;
          item_caption?: string | null;
          ordered_items?: string[];
        };
        Returns: Json;
      };
      delete_business_service: {
        Args: { target_business: string; target_service: string };
        Returns: undefined;
      };
      create_business: {
        Args: {
          business_name: string;
          business_slug: string;
          business_type: "autonomo" | "empresa";
          initial_city_id: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
