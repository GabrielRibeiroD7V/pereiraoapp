import { createHash, createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types.ts";
export type SandboxEnv = Record<string, string | undefined>;
export class BillingError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export interface SandboxStore {
  call<T = Record<string, unknown>>(
    command: string,
    payload: unknown,
  ): Promise<T>;
}
export function sandboxEnabled(env: SandboxEnv) {
  return env.VERCEL_ENV === "preview" && env.ASAAS_SANDBOX_ENABLED === "true";
}
export function makeSandboxStore(
  env: SandboxEnv,
  client = createClient<Database>(
    "https://yazdjiwaksamizrbqewq.supabase.co",
    env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  ),
): SandboxStore {
  const secret = env.BILLING_RPC_SIGNING_SECRET;
  if (!secret || secret.length < 48) throw new BillingError("SETUP_REQUIRED");
  return {
    async call<T>(command: string, payload: unknown) {
      const raw = JSON.stringify(payload),
        issuedAt = Math.floor(Date.now() / 1000),
        nonce = randomUUID();
      const signature = createHmac(
        "sha256",
        createHash("sha256").update(secret).digest(),
      )
        .update(command + "\n" + nonce + "\n" + issuedAt + "\n" + raw)
        .digest("hex");
      const r = await client.rpc("sandbox_billing_server", {
        command,
        raw_payload: raw,
        issued_at: issuedAt,
        nonce,
        signature,
      });
      if (r.error)
        throw new BillingError(
          ["PGRST202", "42883", "42P01", "55000"].includes(r.error.code)
            ? "SETUP_REQUIRED"
            : r.error.code === "42501"
              ? "FORBIDDEN"
              : r.error.code === "23505"
                ? "CONFLICT"
                : r.error.code === "22023"
                  ? "INVALID_INPUT"
                  : "UNAVAILABLE",
        );
      return r.data as T;
    },
  };
}
