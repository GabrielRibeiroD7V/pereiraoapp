import { MONTHLY_AMOUNT_CENTS, SANDBOX_TERMS_VERSION } from "./plan";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import type { SandboxBillingRepository } from "./types";
export function createBillingRepository(
  client: SupabaseClient<Database>,
  request: typeof fetch = fetch,
  available = import.meta.env.VITE_SANDBOX_BILLING === "true",
): SandboxBillingRepository {
  async function call<T>(body: unknown, signal?: AbortSignal): Promise<T> {
    if (!available) throw { code: "SANDBOX_DISABLED" };
    const session = await client.auth.getSession();
    if (session.error || !session.data.session) throw { code: "AUTH_REQUIRED" };
    const r = await request("/api/sandbox-billing", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + session.data.session.access_token,
      },
      body: JSON.stringify(body),
      signal,
    });
    const value = await r.json();
    if (!r.ok) throw { code: value.code ?? "UNAVAILABLE" };
    return value.data as T;
  }
  return {
    available,
    pixAvailable: import.meta.env.VITE_SANDBOX_PIX_VERIFIED === "true",
    overview: (businessId, signal) =>
      call({ action: "overview", businessId }, signal),
    start: (businessId, requestId, method) =>
      call({
        action: "start",
        businessId,
        requestId,
        method,
        accepted: true,
        termsVersion: SANDBOX_TERMS_VERSION,
        amountCents: MONTHLY_AMOUNT_CENTS,
      }),
    reconcile: async (requestId) => {
      await call({ action: "reconcile", requestId });
    },
    cancel: async (requestId) => {
      await call({ action: "cancel", requestId, confirmed: true });
    },
    admin: (signal) => call({ action: "admin" }, signal),
    retry: async () => {
      await call({ action: "retry" });
    },
    refund: async (paymentId, requestId) => {
      await call({ action: "refund", paymentId, requestId, confirmed: true });
    },
  };
}
