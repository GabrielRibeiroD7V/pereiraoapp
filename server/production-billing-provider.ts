// Somente servidor. Este provider não implementa operações de criação ou pagamento.
export type ProductionEnv = Record<string, string | undefined>;
export const productionFinancialCapabilities = Object.freeze({
  checkout: false,
  subscriptions: false,
  charges: false,
  enforcement: false,
  pix: false,
});
export type ProductionBillingCode =
  | "DISABLED"
  | "SETUP_REQUIRED"
  | "AUTH_REQUIRED"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "UNAVAILABLE"
  | "RECONCILIATION_REQUIRED";
export class ProductionBillingError extends Error {
  public code: ProductionBillingCode;
  constructor(code: ProductionBillingCode) {
    super(code);
    this.code = code;
  }
}
export function productionConfig(env: ProductionEnv) {
  if (
    env.VERCEL_ENV !== "production" ||
    env.ASAAS_PRODUCTION_WEBHOOK_ENABLED !== "true"
  )
    throw new ProductionBillingError("DISABLED");
  if (
    [
      "ASAAS_PRODUCTION_CHECKOUT_ENABLED",
      "ASAAS_PRODUCTION_SUBSCRIPTIONS_ENABLED",
      "ASAAS_PRODUCTION_CHARGES_ENABLED",
      "ASAAS_PRODUCTION_ENFORCEMENT_ENABLED",
      "ASAAS_PRODUCTION_PIX_ENABLED",
    ].some((k) => env[k] !== undefined && env[k] !== "false")
  )
    throw new ProductionBillingError("DISABLED");
  const key = env.ASAAS_API_KEY_PRODUCTION,
    token = env.ASAAS_PRODUCTION_WEBHOOK_TOKEN,
    signing = env.BILLING_PRODUCTION_RPC_SIGNING_SECRET;
  if (
    !key ||
    !/^\$aact_prod_[\x21-\x7E]{1,2048}$/.test(key) ||
    !token ||
    !/^[A-Za-z0-9_-]{48,200}$/.test(token) ||
    !signing ||
    !/^[A-Za-z0-9_-]{48,200}$/.test(signing) ||
    token === signing ||
    key === env.ASSAS_API_KEY_SANDBOX ||
    token === env.ASAAS_SANDBOX_WEBHOOK_TOKEN ||
    signing === env.BILLING_RPC_SIGNING_SECRET ||
    env.VITE_SUPABASE_URL !== "https://yazdjiwaksamizrbqewq.supabase.co" ||
    !env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")
  )
    throw new ProductionBillingError("SETUP_REQUIRED");
  return { key, token, signing };
}
export async function boundedJson(
  response: Response | Request,
  limit: number,
): Promise<Record<string, unknown>> {
  const reader = response.body?.getReader();
  if (!reader) throw new ProductionBillingError("INVALID_INPUT");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ProductionBillingError("INVALID_INPUT");
      }
      parts.push(part.value);
    }
  } catch (error) {
    if (error instanceof ProductionBillingError) throw error;
    throw new ProductionBillingError("UNAVAILABLE");
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error();
    return value as Record<string, unknown>;
  } catch {
    throw new ProductionBillingError("INVALID_INPUT");
  }
}
export class ProductionReadProvider {
  private key: string;
  private request: typeof fetch;
  constructor(env: ProductionEnv, request: typeof fetch = fetch) {
    this.key = productionConfig(env).key;
    this.request = request;
  }
  async read(kind: "payments" | "subscriptions", id: string) {
    if (
      !new RegExp(
        `^${kind === "payments" ? "pay" : "sub"}_[A-Za-z0-9_-]{1,150}$`,
      ).test(id)
    )
      throw new ProductionBillingError("INVALID_INPUT");
    let response: Response;
    try {
      response = await this.request(`https://api.asaas.com/v3/${kind}/${id}`, {
        method: "GET",
        headers: {
          access_token: this.key,
          accept: "application/json",
          "User-Agent": "PereiraoProductionReconciliation/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new ProductionBillingError("UNAVAILABLE");
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new ProductionBillingError(
        response.status === 429 || response.status >= 500
          ? "UNAVAILABLE"
          : "RECONCILIATION_REQUIRED",
      );
    }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      await response.body?.cancel();
      throw new ProductionBillingError("RECONCILIATION_REQUIRED");
    }
    const value = await boundedJson(response, 512 * 1024);
    if (value.id !== id)
      throw new ProductionBillingError("RECONCILIATION_REQUIRED");
    return value;
  }
}
