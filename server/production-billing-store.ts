import { createHash, createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  ProductionBillingError,
  productionConfig,
} from "./production-billing-provider.ts";
import type { ProductionEnv } from "./production-billing-provider.ts";
export interface ProductionStore {
  call<T = Record<string, unknown>>(
    command: string,
    payload: unknown,
  ): Promise<T>;
}
export function productionStore(env: ProductionEnv): ProductionStore {
  const config = productionConfig(env),
    client = createClient(
      env.VITE_SUPABASE_URL!,
      env.VITE_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  return {
    async call<T>(command: string, payload: unknown) {
      const raw = JSON.stringify(payload),
        nonce = randomUUID(),
        issuedAt = Math.floor(Date.now() / 1000),
        signature = createHmac(
          "sha256",
          createHash("sha256").update(config.signing).digest(),
        )
          .update(command + "\n" + nonce + "\n" + issuedAt + "\n" + raw)
          .digest("hex");
      const { data, error } = await client.rpc("production_billing_server", {
        command,
        raw_payload: raw,
        issued_at: issuedAt,
        nonce,
        signature,
      });
      if (error)
        throw new ProductionBillingError(
          ["PGRST202", "42883", "42P01", "55000"].includes(error.code)
            ? "SETUP_REQUIRED"
            : error.code === "42501"
              ? "AUTH_REQUIRED"
              : error.code === "23505"
                ? "CONFLICT"
                : error.code === "22023"
                  ? "INVALID_INPUT"
                  : "UNAVAILABLE",
        );
      return data as T;
    },
  };
}
