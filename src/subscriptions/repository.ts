import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { validId } from "../lib/mediaPath";
import type { SubscriptionRepository, SubscriptionPage, AccessStatus } from "./types";
import { subscriptionLabels } from "./types";
export function createSubscriptionRepository(
  client: SupabaseClient<Database>,
): SubscriptionRepository {
  return {
    async accessStatus() {
      const result = await client.rpc('platform_access_status');
      if (result.error) {
        if (['PGRST202','42883'].includes(result.error.code)) return null;
        throw result.error;
      }
      const value = result.data as unknown as AccessStatus;
      if (!value || value.phase !== 'initial_free' || !Number.isFinite(Date.parse(value.effectiveAt)) || [value.trialClockRunning,value.checkoutAvailable,value.enforcementEnabled,value.automaticConversion].some(flag=>flag!==false)) throw {code:'INVALID_RESPONSE'};
      return value;
    },
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
            (i.accessPhase !== undefined && (i.accessPhase !== 'initial_free' || !['exempt','awaiting_activation'].includes(i.state) || [i.trialStartedAt,i.trialEndsAt,i.contractedAt,i.billingPeriodStart,i.billingPeriodEnd].some(date=>date!==null))) ||
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
      return {...value,items:value.items.map(item=>item.accessPhase==='initial_free' && item.state==='awaiting_activation'?{...item,state:'initial_free' as const}:item)};
    },
  };
}
