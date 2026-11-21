// Exclusivamente servidor. Nunca importar por src/.
export type PaymentMethod = "PIX" | "CREDIT_CARD";
export interface AsaasSubscription {
  id: string;
  customer: string;
  value: number;
  cycle: string;
  billingType: string;
  status: string;
  deleted?: boolean;
  externalReference?: string | null;
  checkoutSession?: string | null;
  nextDueDate: string;
}
export interface AsaasPayment {
  id: string;
  customer: string;
  subscription: string | null;
  billingType: string;
  value: number;
  status: string;
  dueDate: string;
  invoiceUrl?: string;
  paymentDate?: string | null;
  confirmedDate?: string | null;
  deleted?: boolean;
  refunds?: { status: string; value: number }[];
}
export class ProviderError extends Error {
  public httpStatus?: number;
  public code:
    | "PROVIDER_UNAVAILABLE"
    | "PROVIDER_REJECTED"
    | "NOT_FOUND"
    | "INVALID_PROVIDER_RESPONSE"
    | "SANDBOX_DISABLED";
  constructor(
    code:
      | "PROVIDER_UNAVAILABLE"
      | "PROVIDER_REJECTED"
      | "NOT_FOUND"
      | "INVALID_PROVIDER_RESPONSE"
      | "SANDBOX_DISABLED",
    httpStatus?: number,
  ) {
    super(code);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
export const providerId = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_-]{3,160}$/.test(v);
export function sandboxLink(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    return u.origin === "https://sandbox.asaas.com" &&
      !u.username &&
      !u.password &&
      !u.hash &&
      (/^\/i\/[A-Za-z0-9_-]+$/.test(u.pathname) ||
        /^\/checkoutSession\/show(?:\/[0-9a-f-]{36})?$/.test(u.pathname))
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function cents(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    Math.abs(Math.round(value * 100) - value * 100) > 0.000001 ||
    !Number.isSafeInteger(Math.round(value * 100))
  )
    throw new ProviderError("INVALID_PROVIDER_RESPONSE");
  return Math.round(value * 100);
}
export class SandboxProvider {
  private key: string;
  private request: typeof fetch;
  constructor(key: string, request: typeof fetch = fetch) {
    this.key = key;
    this.request = request;
    if (
      !key.startsWith("$aact_hmlg_") ||
      key.trim() !== key ||
      /[\r\n]/.test(key)
    )
      throw new ProviderError("SANDBOX_DISABLED");
  }
  private async call<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (
      !/^\/(customers|subscriptions|payments|checkouts)(?:[/?][A-Za-z0-9_?=&%./:-]*)?$/.test(
        path,
      )
    )
      throw new ProviderError("SANDBOX_DISABLED");
    let response: Response;
    try {
      response = await this.request("https://api-sandbox.asaas.com/v3" + path, {
        method,
        headers: {
          access_token: this.key,
          accept: "application/json",
          "content-type": "application/json",
          "User-Agent": "PereiraoSandbox/1.0",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new ProviderError("PROVIDER_UNAVAILABLE");
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new ProviderError(
        response.status === 404
          ? "NOT_FOUND"
          : response.status >= 500 || response.status === 429
            ? "PROVIDER_UNAVAILABLE"
            : "PROVIDER_REJECTED",
        response.status,
      );
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    }
  }
  private async list<T>(path: string) {
    const rows: T[] = [];
    for (let offset = 0; offset <= 1000; offset += 100) {
      const page = await this.call<{ data: T[]; hasMore: boolean }>(
        "GET",
        path + (path.includes("?") ? "&" : "?") + "limit=100&offset=" + offset,
      );
      if (!Array.isArray(page.data) || typeof page.hasMore !== "boolean")
        throw new ProviderError("INVALID_PROVIDER_RESPONSE");
      rows.push(...page.data);
      if (!page.hasMore) return rows;
    }
    throw new ProviderError("PROVIDER_UNAVAILABLE");
  }
  findCustomers(reference: string) {
    return this.list<{ id: string; externalReference: string }>(
      "/customers?externalReference=" + encodeURIComponent(reference),
    );
  }
  async createCustomer(reference: string) {
    const data = await this.call<{ id: string }>("POST", "/customers", {
      name: "PEREIRAO TESTE SANDBOX",
      email: "sandbox@example.invalid",
      notificationDisabled: true,
      externalReference: reference,
    });
    if (!providerId(data.id) || !data.id.startsWith("cus_"))
      throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    return data.id;
  }
  findSubscriptions(customer: string) {
    if (!providerId(customer))
      throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    return this.list<AsaasSubscription>("/subscriptions?customer=" + customer);
  }
  async createPixSubscription(
    customer: string,
    requestId: string,
    dueDate: string,
  ) {
    const s = await this.call<AsaasSubscription>("POST", "/subscriptions", {
      customer,
      billingType: "PIX",
      cycle: "MONTHLY",
      value: 19.99,
      nextDueDate: dueDate,
      pixAutomaticAuthorizationMode: "DISABLED",
      externalReference: requestId,
      description: "PEREIRAO - simulacao mensal Sandbox",
    });
    if (!providerId(s.id) || s.customer !== customer)
      throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    return s;
  }
  async createCardCheckout(
    customer: string,
    requestId: string,
    dueDate: string,
    returnUrl: string,
  ) {
    const u = new URL(returnUrl);
    if (u.protocol !== "https:" || u.username || u.password || u.hash)
      throw new ProviderError("SANDBOX_DISABLED");
    const c = await this.call<{ id: string; link?: string }>(
      "POST",
      "/checkouts",
      {
        customer,
        billingTypes: ["CREDIT_CARD"],
        chargeTypes: ["RECURRENT"],
        minutesToExpire: 60,
        externalReference: requestId,
        callback: {
          successUrl: returnUrl,
          cancelUrl: returnUrl,
          expiredUrl: returnUrl,
        },
        items: [
          {
            name: "PEREIRAO Sandbox",
            description: "Simulacao, sem cobranca real",
            quantity: 1,
            value: 19.99,
          },
        ],
        subscription: { cycle: "MONTHLY", nextDueDate: dueDate },
      },
    );
    if (!/^[0-9a-f-]{36}$/i.test(c.id))
      throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    const link = sandboxLink(
      c.link ?? "https://sandbox.asaas.com/checkoutSession/show?id=" + c.id,
    );
    if (!link) throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    return { id: c.id, link };
  }
  getSubscription(id: string) {
    if (!providerId(id)) throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    return this.call<AsaasSubscription>("GET", "/subscriptions/" + id);
  }
  payments(subscription: string) {
    if (!providerId(subscription))
      throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    return this.list<AsaasPayment>(
      "/subscriptions/" + subscription + "/payments",
    );
  }
  getPayment(id: string) {
    if (!providerId(id)) throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    return this.call<AsaasPayment>("GET", "/payments/" + id);
  }
  async cancelSubscription(id: string) {
    if (!providerId(id)) throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    await this.call("DELETE", "/subscriptions/" + id);
  }
  async cancelCheckout(id: string) {
    if (!providerId(id)) throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    await this.call("POST", "/checkouts/" + id + "/cancel");
  }
  async refund(id: string) {
    if (!providerId(id)) throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    await this.call("POST", "/payments/" + id + "/refund", {});
  }
}
