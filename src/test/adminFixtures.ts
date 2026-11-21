import type { AdminSubscriptions } from '../subscriptions/types';
// Fixtures locais; jamais importar no bundle do aplicativo.
import type {
  AdminRepository,
  AdminSection,
  AdminFilters,
  AdminAction,
  AdminDashboard,
  AdminBusiness,
  AdminUser,
  AdminPost,
  AuditEntry,
  AdminDetail,
} from "../admin/types";
import { fixtureBusinessId, fixtureImage } from "./workFixtures";
export const adminUserId = "00000000-0000-4000-8000-000000009001";
export function adminFixture(
  options: { allowed?: boolean; pendingPosts?: boolean; empty?: boolean } = {},
) {
  const business: AdminBusiness = {
    id: fixtureBusinessId,
    name: "Prestador sintético local",
    type: "autonomo",
    status: "draft",
    suspended: false,
    category: "Climatização",
    city: "Mundo Novo",
    description: "Perfil de demonstração, sem dados de prestadores reais.",
    whatsapp: "67999999999",
    created_at: "2026-11-20T12:00:00Z",
  };
  const user: AdminUser = {
    id: "00000000-0000-4000-8000-000000009002",
    display_name: "Usuário sintético",
    email: "conta-teste@example.invalid",
    confirmed: true,
    suspended: false,
    created_at: "2026-11-20T12:00:00Z",
  };
  const post: AdminPost = {
    id: "00000000-0000-4000-8000-000000009201",
    business_id: business.id,
    title: "Trabalho técnico sintético",
    business_name: business.name,
    status: "draft",
    blocked: false,
    created_at: "2026-11-20T12:00:00Z",
  };
  const history: AuditEntry[] = [];
  const detail: AdminDetail = {
    servicesHasNext: false,
    photosHasNext: false,
    business,
    services: [
      {
        id: "service-local",
        name: "Serviço demonstrativo",
        description: "Somente para testar a interface.",
        active: true,
        pricing_type: "quote",
        price_amount_cents: null,
      },
    ],
    photos: [
      {
        id: "photo-local",
        storage_path:
          business.id + "/portfolio/00000000-0000-4000-8000-000000009101.webp",
        caption: "Imagem sintética local",
        media_state: "ready",
      },
    ],
    history,
  };
  const dashboard = (): AdminDashboard => ({
    users: 2,
    newUsers: 2,
    autonomos: 1,
    empresas: 0,
    published: business.status === "published" ? 1 : 0,
    drafts: business.status === "draft" ? 1 : 0,
    suspended: business.suspended ? 1 : 0,
    posts: options.pendingPosts ? null : 1,
    postsAvailable: !options.pendingPosts,
    active7: null,
    active30: null,
    days: 30,
  });
  const repo: AdminRepository = {
    access: async () => options.allowed !== false,
    query: async <T>(section: AdminSection, filters: AdminFilters = {}) => {
      if (section === 'subscriptions') {
        const data: AdminSubscriptions = {
          items: options.empty ? [] : [{ businessId: business.id, businessName: business.name, state: 'awaiting_activation', trialStartedAt: null, trialEndsAt: null, sameOwnerActivations: 0 }],
          hasNext: false,
          summary: { trialActive: 0, trialEnded: 0, active: 0, pendingPayment: 0, cancelled: 0, confirmedRevenueCents: null, revenueAvailable: false },
          extensionsEnabled: false, checkoutAvailable: false, enforcementEnabled: false,
        };
        return data as T;
      }
      let value: unknown;
      const items =
        options.empty || (filters.page && filters.page > 1)
          ? []
          : section === "users"
            ? [user]
            : section === "businesses"
              ? [business]
              : section === "posts"
                ? [post]
                : history;
      value =
        section === "dashboard"
          ? dashboard()
          : section === "detail"
            ? detail
            : {
                items,
                hasNext: !filters.page || filters.page === 1,
                available:
                  section === "posts" ? !options.pendingPosts : undefined,
                moderationAvailable: true,
              };
      return value as T;
    },
    act: async (input: AdminAction) => {
      if (input.kind === "business") {
        business.suspended = input.command === "suspend";
        business.status = business.suspended ? "unpublished" : "published";
      }
      if (input.kind === "user") user.suspended = input.command === "suspend";
      if (input.kind === "post") {
        post.blocked = input.command === "withdraw";
        post.status = "unpublished";
      }
      history.unshift({
        id: "audit-" + history.length,
        actor_id: adminUserId,
        target_id: input.target,
        target_type: input.kind,
        action: input.command,
        reason: input.reason,
        before_state: input.expected_state,
        after_state:
          input.kind === "business"
            ? business.status
            : input.kind === "user"
              ? user.suspended
                ? "suspended"
                : "active"
              : post.status,
        created_at: "2026-11-20T12:00:00Z",
      });
    },
    sandbox: async () => ({
      state: "connected",
      httpStatus: 200,
      checkedAt: "2026-11-20T12:00:00Z",
    }),
    image: async () => fixtureImage,
  };
  return { repo, business, user, post, history, detail };
}
