export type AdminSection =
  | "personal_posts"
  | "reports"
  | "dashboard"
  | "users"
  | "businesses"
  | "posts"
  | "audit"
  | "detail"
  | "subscriptions"
  | "sandbox";
export type SandboxState =
  | "connected"
  | "missing"
  | "invalid"
  | "communication_error"
  | "not_validated";
export interface SandboxDiagnostic {
  state: SandboxState;
  httpStatus?: number;
  checkedAt: string;
}
export interface AdminFilters {
  q?: string;
  status?: string;
  page?: number;
  days?: number;
  id?: string;
}
export interface AdminBusiness {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string;
  category: string | null;
  city: string | null;
  whatsapp?: string | null;
  suspended: boolean;
  created_at?: string;
}
export interface AdminUser {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  confirmed: boolean;
  suspended: boolean;
}
export interface AdminPost {
  id: string;
  business_id: string;
  title: string;
  business_name: string;
  status: string;
  blocked: boolean;
  created_at: string;
}
export interface AuditEntry {
  id: string;
  actor_id: string | null;
  target_type?: string;
  target_id?: string;
  action: string;
  reason: string;
  before_state: string | null;
  after_state: string | null;
  created_at: string;
}
export interface AdminDashboard {
  conversations?: number;
  subscriptions?: number;
  openReports?: number;
  users: number;
  newUsers: number;
  autonomos: number;
  empresas: number;
  published: number;
  drafts: number;
  suspended: number;
  posts: number | null;
  postsAvailable: boolean;
  active7: null;
  active30: null;
  days: number;
}
export interface AdminPage<T> {
  items: T[];
  hasNext: boolean;
  available?: boolean;
  moderationAvailable?: boolean;
}
export interface AdminPhoto {
  id: string;
  storage_path: string;
  caption: string | null;
  media_state: string;
}
export interface ReviewCategory {
  id: string;
  name: string;
  active: boolean;
}
export interface ReviewCity {
  id: string;
  name: string;
  stateCode: string;
  active: boolean;
}
export interface AdminReviewCatalog {
  primaryCategory: ReviewCategory | null;
  additionalSpecialties: ReviewCategory[];
  originCity: ReviewCity | null;
  serviceCities: ReviewCity[];
}
export interface AdminDetail {
  reviewCatalog?: AdminReviewCatalog | null;
  profilePhoto?: string | null;
  servicesHasNext: boolean;
  photosHasNext: boolean;
  business: AdminBusiness;
  services: {
    id: string;
    name: string;
    description: string | null;
    active: boolean;
    pricing_type: string;
    price_amount_cents: number | null;
  }[];
  photos: AdminPhoto[];
  history: AuditEntry[];
}
export interface AdminAction {
  kind: "business" | "user" | "post";
  target: string;
  command: "publish" | "suspend" | "reactivate" | "withdraw" | "release";
  reason: string;
  expected_state: string;
}
export interface AdminRepository {
  access(signal?: AbortSignal): Promise<boolean>;
  query<T>(
    section: AdminSection,
    filters?: AdminFilters,
    signal?: AbortSignal,
  ): Promise<T>;
  act(input: AdminAction): Promise<void>;
  sandbox(): Promise<SandboxDiagnostic>;
  image(businessId: string, path: string): Promise<string>;
}
export function adminError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  return code === "SETUP_REQUIRED"
    ? "A administração aguarda ativação das migrações e concessão de acesso."
    : code === "FORBIDDEN"
      ? "Acesso restrito à administração da plataforma."
      : code === "CONFLICT"
        ? "Os dados mudaram. Atualize a lista e revise a decisão."
        : code === "INCOMPLETE"
          ? "O perfil está incompleto ou o responsável está suspenso. Confira categoria, descrição, WhatsApp e área de atendimento."
          : "Não foi possível concluir. Verifique sua conexão e tente novamente.";
}
