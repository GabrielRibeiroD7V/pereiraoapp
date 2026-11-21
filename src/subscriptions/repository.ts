import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { validId } from "../lib/mediaPath";
import type { SubscriptionRepository, SubscriptionPage } from "./types";
import { subscriptionLabels } from "./types";
export function createSubscriptionRepository(
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
