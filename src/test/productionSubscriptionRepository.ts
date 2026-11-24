// Decoder da produção deb455a, preservado somente para testar expansão antes do deploy.
// Fonte SHA-256: 819c08755debe3aee6589d2b7ccd84c82761385cbaa7380baf4b2ad40f8749f5; só nome/export e caminhos de imports ajustados; enum antigo congelado.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { validId } from "../lib/mediaPath";
import type { SubscriptionRepository, SubscriptionPage } from "../subscriptions/types";
const subscriptionLabels = {exempt:'Isento',awaiting_activation:'Aguardando',trial_active:'Ativa',trial_ended:'Encerrada',active:'Ativa',pending_payment:'Pendente',cancelled:'Cancelada'};
export function createProductionSubscriptionRepository(
  client: SupabaseClient<Database>,
): SubscriptionRepository {
  return {
    async list(businessId, page = 1, signal) {
      if (
        (businessId && !validId(businessId)) ||
        !Number.isInteger(page) ||
        page < 1 ||
        page > 100000
      )
        throw { code: "INVALID_INPUT" };
      const user = await client.auth.getUser();
      if (user.error || !user.data.user) throw { code: "AUTH_REQUIRED" };
      const result = await client
        .rpc("my_subscriptions", {
          ...(businessId ? { target_business: businessId } : {}),
          page_number: page,
        })
        .abortSignal(signal ?? new AbortController().signal);
      if (result.error) throw result.error;
      const value = result.data as unknown as SubscriptionPage;
      if (
        !value ||
        !Array.isArray(value.items) ||
        typeof value.hasNext !== "boolean" ||
        value.items.some(
          (i) =>
            !i ||
            !validId(i.businessId) ||
            typeof i.businessName !== "string" ||
            !Object.hasOwn(subscriptionLabels, i.state) ||
            !Number.isFinite(Date.parse(i.serverNow)) ||
            [
              i.trialStartedAt,
              i.trialEndsAt,
              i.contractedAt,
              i.billingPeriodStart,
              i.billingPeriodEnd,
            ].some(
              (date) => date !== null && !Number.isFinite(Date.parse(date)),
            ) ||
            i.checkoutAvailable !== false ||
            i.enforcementEnabled !== false,
        )
      )
        throw { code: "INVALID_RESPONSE" };
      return value;
    },
  };
}
