// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";
import {
  SandboxProvider,
  ProviderError,
  sandboxLink,
  cents,
} from "./sandbox-provider";
import {
  SandboxService,
  paymentSnapshot,
  validateSubscription,
  contractView,
} from "./sandbox-service";
import type { SandboxContract } from "./sandbox-service";
import type { AsaasPayment, AsaasSubscription } from "./sandbox-provider";
import { BillingError, makeSandboxStore } from "./sandbox-store";
import type { SandboxStore } from "./sandbox-store";
import {
  createSandboxBillingHandler,
  createSandboxWebhookHandler,
  webhookAuthorized,
} from "./sandbox-handlers";
import { adminClient } from "./admin-handler";
const uid = "00000000-0000-4000-8000-000000000001",
  bid = "00000000-0000-4000-8000-000000000002",
  rid = "00000000-0000-4000-8000-000000000003";
const env = {
  VERCEL_ENV: "preview",
  ASAAS_SANDBOX_ENABLED: "true",
  VITE_SUPABASE_URL: "https://yazdjiwaksamizrbqewq.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  ASAAS_SANDBOX_WEBHOOK_TOKEN: "local-webhook-fixture-000000000000000",
};
const contract = (): SandboxContract => ({
  request_id: rid,
  business_id: bid,
  user_id: uid,
  method: "PIX",
  amount_cents: 1999,
  first_due_date: "2026-11-21",
  customer_id: "cus_local",
  subscription_id: "sub_local",
  checkout_id: null,
  invoice_url: null,
  state: "pending",
  created_at: "2026-11-21T00:00:00Z",
  provider_cancelled: false,
});
const subscription = (): AsaasSubscription => ({
  id: "sub_local",
  customer: "cus_local",
  value: 19.99,
  cycle: "MONTHLY",
  billingType: "PIX",
  status: "ACTIVE",
  externalReference: rid,
  nextDueDate: "2026-11-21",
});
const payment = (): AsaasPayment => ({
  id: "pay_local",
  customer: "cus_local",
  subscription: "sub_local",
  billingType: "PIX",
  value: 19.99,
  status: "RECEIVED",
  dueDate: "2026-11-21",
  invoiceUrl: "https://sandbox.asaas.com/i/local",
  paymentDate: "2026-11-21",
});
function storeFixture(overrides: Record<string, unknown> = {}) {
  const calls: [string, unknown][] = [];
  const store: SandboxStore = {
    async call<T>(cmd: string, p: unknown): Promise<T> {
      calls.push([cmd, p]);
      if (cmd in overrides) {
        const v = overrides[cmd];
        if (v instanceof Error) throw v;
        return v as T;
      }
      return (
        cmd === "known_payments"
          ? []
          : cmd === "claim_contract"
            ? { contract: contract(), leaseToken: uid }
            : cmd === "reserve"
              ? { claimed: true, contract: contract() }
              : cmd === "claim_refund"
                ? { claimed: true }
                : contract()
      ) as T;
    },
  };
  return { store, calls };
}
function providerFixture() {
  return {
    getSubscription: vi.fn(async () => subscription()),
    getPayment: vi.fn(async () => payment()),
    payments: vi.fn(async () => [payment()]),
    findSubscriptions: vi.fn(async () => [subscription()]),
    findCustomers: vi.fn(async () => []),
    createCustomer: vi.fn(async () => "cus_local"),
    createPixSubscription: vi.fn(async () => subscription()),
    createCardCheckout: vi.fn(async () => ({
      id: rid,
      link: "https://sandbox.asaas.com/checkoutSession/show?id=" + rid,
    })),
    cancelSubscription: vi.fn(async () => {}),
    cancelCheckout: vi.fn(async () => {}),
    refund: vi.fn(async () => {}),
  };
}
const svc = (s: SandboxStore, p: ReturnType<typeof providerFixture>) =>
  new SandboxService(s, p as unknown as SandboxProvider);
describe("provider Sandbox: transporte e proteção de segredo", () => {
  it.each(["$aact_prod_invalid", "legacy", " $aact_hmlg_x", "$aact_hmlg_x\n"])(
    "rejeita chave inadequada %s",
    (key) => expect(() => new SandboxProvider(key)).toThrow("SANDBOX_DISABLED"),
  );
  it("usa host fixo, sem redirects, e Pix sem débito automático", async () => {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json(subscription()),
    );
    await new SandboxProvider(
      "$aact_hmlg_fixture",
      request,
    ).createPixSubscription("cus_local", rid, "2026-11-21");
    expect(request.mock.calls[0]?.[0]).toBe(
      "https://api-sandbox.asaas.com/v3/subscriptions",
    );
    const init = request.mock.calls[0]?.[1] as RequestInit;
    expect(init.redirect).toBe("error");
    expect(JSON.parse(String(init.body))).toMatchObject({
      billingType: "PIX",
      value: 19.99,
      pixAutomaticAuthorizationMode: "DISABLED",
    });
  });
  it("cartão é solicitado apenas no checkout hospedado", async () => {
    const request = vi.fn<typeof fetch>(async () => Response.json({ id: rid }));
    const c = await new SandboxProvider(
      "$aact_hmlg_fixture",
      request,
    ).createCardCheckout(
      "cus_local",
      rid,
      "2026-11-21",
      "https://preview.example/conta",
    );
    expect(c.link).toContain("https://sandbox.asaas.com/");
    expect(
      JSON.parse(String((request.mock.calls[0]?.[1] as RequestInit).body)),
    ).toMatchObject({
      customer: "cus_local",
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      subscription: { cycle: "MONTHLY" },
    });
    expect(JSON.stringify(request.mock.calls)).not.toContain('"creditCard"');
  });
  it.each([400, 401, 404, 429, 500])(
    "sanitiza erro HTTP %i",
    async (status) => {
      const provider = new SandboxProvider(
        "$aact_hmlg_fixture",
        async () => new Response("secret-provider-body", { status }),
      );
      await expect(provider.getPayment("pay_local")).rejects.not.toThrow(
        "secret-provider-body",
      );
    },
  );
  it("não repete POST após falha de rede", async () => {
    const request = vi.fn(async () => {
      throw Error("secret-internal");
    });
    await expect(
      new SandboxProvider("$aact_hmlg_fixture", request).createCustomer(
        "local",
      ),
    ).rejects.toThrow("PROVIDER_UNAVAILABLE");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([
    "https://www.asaas.com/i/a",
    "https://sandbox.asaas.com.evil/i/a",
    "https://sandbox.asaas.com/admin",
    "https://user@sandbox.asaas.com/i/a",
    "javascript:alert(1)",
  ])("bloqueia link externo %s", (url) => expect(sandboxLink(url)).toBeNull());
  it.each([NaN, Infinity, 19.991, -1, "19.99"])(
    "rejeita valor inválido %s",
    (value) => expect(() => cents(value)).toThrow(),
  );
});
describe("conciliação e operações idempotentes", () => {
  it("recusa e cancela retorno BOLETO para pedido PIX, preservando ID da tentativa", async () => {
    const p = providerFixture(),
      f = storeFixture();
    p.createPixSubscription.mockResolvedValue({
      ...subscription(),
      billingType: "BOLETO",
    });
    await expect(
      svc(f.store, p).start(uid, bid, rid, "PIX", "https://preview.example"),
    ).rejects.toThrow("RECONCILIATION_REQUIRED");
    expect(p.cancelSubscription).toHaveBeenCalledWith("sub_local");
    expect(f.calls.map((x) => x[0])).toEqual([
      "reserve",
      "subscription_started",
      "save_provider",
      "cancelled",
      "uncertain",
    ]);
    expect(p.payments).not.toHaveBeenCalled();
  });
  it("concilia estorno posterior ao cancelamento mesmo se a assinatura retornar 404", async () => {
    const p = providerFixture(),
      f = storeFixture({
        known_payments: ["pay_local"],
        claim_event: {
          notice: { eventType: "PAYMENT_REFUNDED", objectId: "pay_local" },
          leaseToken: uid,
        },
      });
    p.getSubscription.mockRejectedValue(new ProviderError("NOT_FOUND", 404));
    p.payments.mockRejectedValue(new ProviderError("NOT_FOUND", 404));
    p.getPayment.mockResolvedValue({ ...payment(), status: "REFUNDED" });
    await svc(f.store, p).processEvent("evt_refund_after_cancel");
    expect(f.calls.find((x) => x[0] === "apply_payment")?.[1]).toMatchObject({
      status: "REFUNDED",
      refundedCents: 1999,
    });
    expect(f.calls.at(-1)?.[1]).toMatchObject({ outcome: "processed" });
  });
  it.each([
    { customer: "cus_other" },
    { value: 20 },
    { cycle: "YEARLY" },
    { billingType: "CREDIT_CARD" },
    { externalReference: "other" },
  ])("valida identidade e preço %j", (change) =>
    expect(() =>
      validateSubscription({ ...subscription(), ...change }, contract()),
    ).toThrow(),
  );
  it("vincula assinatura de cartão pelo checkout confirmado pela API", () => {
    expect(() =>
      validateSubscription(
        {
          ...subscription(),
          externalReference: null,
          checkoutSession: rid,
          billingType: "CREDIT_CARD",
        },
        { ...contract(), method: "CREDIT_CARD", checkout_id: rid },
      ),
    ).not.toThrow();
  });
  it.each([
    { customer: "cus_other" },
    { subscription: "sub_other" },
    { value: 20 },
    { billingType: "CREDIT_CARD" },
    { status: "UNKNOWN" },
    { dueDate: "bad" },
  ])("rejeita pagamento divergente %j", (change) =>
    expect(() =>
      paymentSnapshot({ ...payment(), ...change }, contract()),
    ).toThrow(),
  );
  it("separa captura de receita recebida e soma estornos efetivos", () => {
    expect(
      paymentSnapshot(
        { ...payment(), status: "CONFIRMED", paymentDate: null },
        contract(),
      ).settled,
    ).toBe(false);
    expect(
      paymentSnapshot(
        {
          ...payment(),
          status: "PARTIALLY_REFUNDED",
          refunds: [
            { status: "DONE", value: 5 },
            { status: "PENDING", value: 2 },
          ],
        },
        contract(),
      ).refundedCents,
    ).toBe(500);
    expect(
      paymentSnapshot({ ...payment(), status: "REFUNDED" }, contract())
        .refundedCents,
    ).toBe(1999);
  });
  it("replay de contratação não acessa fornecedor", async () => {
    const p = providerFixture(),
      f = storeFixture({ reserve: { claimed: false, contract: contract() } });
    await svc(f.store, p).start(
      uid,
      bid,
      rid,
      "PIX",
      "https://preview.example",
    );
    expect(p.createPixSubscription).not.toHaveBeenCalled();
    expect(f.calls).toHaveLength(1);
  });
  it("marca tentativa antes do POST e estado incerto na falha", async () => {
    const p = providerFixture(),
      f = storeFixture();
    p.createPixSubscription.mockRejectedValue(Error("network"));
    await expect(
      svc(f.store, p).start(uid, bid, rid, "PIX", "https://preview.example"),
    ).rejects.toThrow();
    expect(f.calls.map((x) => x[0])).toEqual([
      "reserve",
      "subscription_started",
      "uncertain",
    ]);
    expect(p.createPixSubscription).toHaveBeenCalledTimes(1);
  });
  it("usa a leitura atual da API e não status declarado por evento antigo", async () => {
    const p = providerFixture(),
      f = storeFixture({
        claim_event: {
          notice: { eventType: "PAYMENT_CONFIRMED", objectId: "pay_local" },
          leaseToken: uid,
        },
      });
    p.getPayment.mockResolvedValue({ ...payment(), status: "REFUNDED" });
    await svc(f.store, p).processEvent("evt_old");
    expect(f.calls.find((x) => x[0] === "apply_payment")?.[1]).toMatchObject({
      status: "REFUNDED",
      refundedCents: 1999,
      leaseToken: uid,
    });
    expect(f.calls.at(-1)).toEqual([
      "event_done",
      { eventId: "evt_old", leaseToken: uid, outcome: "processed" },
    ]);
  });
  it("falha de API mantém inbox recuperável e libera lease", async () => {
    const p = providerFixture(),
      f = storeFixture({
        claim_event: {
          notice: { eventType: "SUBSCRIPTION_UPDATED", objectId: "sub_local" },
          leaseToken: uid,
        },
      });
    p.getSubscription.mockRejectedValue(Error("network"));
    await svc(f.store, p).processEvent("evt_failed");
    expect(f.calls.map((x) => x[0])).toContain("release_contract");
    expect(f.calls.at(-1)?.[1]).toMatchObject({
      outcome: "reconcile_required",
    });
    expect(f.calls.some((x) => x[0] === "apply_payment")).toBe(false);
  });
  it("worker concorrente não consulta pagamentos", async () => {
    const p = providerFixture(),
      f = storeFixture({ claim_contract: null });
    await expect(svc(f.store, p).reconcileContract(rid, uid)).rejects.toThrow(
      "CONFLICT",
    );
    expect(p.getPayment).not.toHaveBeenCalled();
  });
  it("estorno repetido não repete POST e não concede direitos", async () => {
    const p = providerFixture(),
      f = storeFixture({ claim_refund: { claimed: false } });
    await svc(f.store, p).refund(uid, rid, "pay_local");
    expect(p.refund).not.toHaveBeenCalled();
    expect(f.calls).toHaveLength(1);
  });
  it("falha em estorno registra incerteza", async () => {
    const p = providerFixture(),
      f = storeFixture();
    p.refund.mockRejectedValue(Error());
    await expect(
      svc(f.store, p).refund(uid, rid, "pay_local"),
    ).rejects.toThrow();
    expect(f.calls.at(-1)).toEqual([
      "refund_result",
      { requestId: rid, state: "uncertain" },
    ]);
  });
  it("cancelamento registra somente após resposta do fornecedor", async () => {
    const p = providerFixture(),
      f = storeFixture();
    await svc(f.store, p).cancel(uid, rid);
    expect(p.cancelSubscription).toHaveBeenCalledWith("sub_local");
    expect(f.calls.at(-1)).toEqual([
      "cancelled",
      { requestId: rid, userId: uid },
    ]);
  });
  it("não devolve IDs de cliente, assinatura ou usuário no contrato", () => {
    expect(contractView(contract())).not.toHaveProperty("customer_id");
    expect(JSON.stringify(contractView(contract()))).not.toContain("sub_local");
  });
});
describe("rotas: sessão normal, webhook e modo Preview", () => {
  const req = (
    value: unknown,
    headers: Record<string, string> = { Authorization: "Bearer fixture" },
  ) =>
    new Request("https://preview.example/api/sandbox-billing", {
      method: "POST",
      headers,
      body: JSON.stringify(value),
    });
  const auth = vi.fn(
    () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: uid } }, error: null }),
        },
      }) as unknown as ReturnType<typeof adminClient>,
  );
  it.each(["production", "development"])(
    "nega escrita em %s antes de criar cliente",
    async (VERCEL_ENV) => {
      const create = vi.fn();
      const r = await createSandboxBillingHandler(
        { ...env, VERCEL_ENV },
        create,
      )(req({ action: "start" }));
      expect(r.status).toBe(403);
      expect(create).not.toHaveBeenCalled();
    },
  );
  it("requer sessão", async () =>
    expect((await createSandboxBillingHandler(env)(req({}, {}))).status).toBe(
      401,
    ));
  it("não aceita identidade nem cartão no corpo", async () => {
    for (const extra of [
      { userId: uid },
      { creditCard: { number: "synthetic" } },
    ]) {
      const factory = vi.fn();
      expect(
        (
          await createSandboxBillingHandler(
            env,
            auth,
            factory,
          )(req({ action: "overview", businessId: bid, ...extra }))
        ).status,
      ).toBe(400);
      expect(factory).not.toHaveBeenCalled();
    }
  });
  it("rejeita JSON malformado e origem externa", async () => {
    const h = createSandboxBillingHandler(env, auth);
    expect(
      (
        await h(
          new Request("https://preview.example/api/sandbox-billing", {
            method: "POST",
            headers: { Authorization: "Bearer fixture" },
            body: "{",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await h(
          req(
            {},
            { Authorization: "Bearer fixture", Origin: "https://evil.example" },
          ),
        )
      ).status,
    ).toBe(403);
  });
  it("usa ID do Auth validado e exige consentimento", async () => {
    const f = storeFixture(),
      p = providerFixture(),
      start = vi
        .spyOn(svc(f.store, p), "start")
        .mockResolvedValue(contractView(contract()));
    const service = svc(f.store, p);
    service.start = start;
    const h = createSandboxBillingHandler(env, auth, () => service);
    const input = {
      action: "start",
      businessId: bid,
      requestId: rid,
      method: "PIX",
      accepted: true,
      amountCents: 1999,
      termsVersion: "sandbox-v1",
    };
    expect((await h(req({ ...input, accepted: false }))).status).toBe(400);
    const r = await h(req(input));
    expect(r.status).toBe(200);
    expect(start.mock.calls[0]?.[0]).toBe(uid);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });
  it("compara segredo do webhook sem exceção por Unicode", () => {
    expect(
      webhookAuthorized(env.ASAAS_SANDBOX_WEBHOOK_TOKEN, "é".repeat(37)),
    ).toBe(false);
    expect(
      webhookAuthorized(
        env.ASAAS_SANDBOX_WEBHOOK_TOKEN,
        env.ASAAS_SANDBOX_WEBHOOK_TOKEN,
      ),
    ).toBe(true);
  });
  it("nega webhook sem credencial", async () => {
    const factory = vi.fn();
    const h = createSandboxWebhookHandler(env, vi.fn(), factory);
    expect((await h(req({}))).status).toBe(401);
    expect(factory).not.toHaveBeenCalled();
  });
  it("não confirma webhook antes da persistência durável", async () => {
    const f = storeFixture({ enqueue: new BillingError("SETUP_REQUIRED") }),
      p = providerFixture(),
      defer = vi.fn();
    const h = createSandboxWebhookHandler(env, defer, () => svc(f.store, p));
    const r = await h(
      req(
        {
          id: "evt_local",
          event: "PAYMENT_RECEIVED",
          payment: { id: "pay_local" },
        },
        { "asaas-access-token": env.ASAAS_SANDBOX_WEBHOOK_TOKEN },
      ),
    );
    expect(r.status).toBe(503);
    expect(defer).not.toHaveBeenCalled();
  });
  it("não persiste dados de cartão do webhook", async () => {
    const f = storeFixture({ claim_event: null }),
      p = providerFixture(),
      defer = vi.fn();
    const h = createSandboxWebhookHandler(env, defer, () => svc(f.store, p));
    const r = await h(
      req(
        {
          id: "evt_local",
          event: "PAYMENT_RECEIVED",
          payment: { id: "pay_local", creditCard: { number: "private" } },
        },
        { "asaas-access-token": env.ASAAS_SANDBOX_WEBHOOK_TOKEN },
      ),
    );
    expect(r.status).toBe(200);
    expect(JSON.stringify(f.calls)).not.toContain("private");
    expect(defer).toHaveBeenCalledTimes(1);
  });
  it("assina bytes exatos, comando, nonce e prazo; não envia segredo", async () => {
    const secret = "local-signing-fixture-".repeat(4),
      rpc = vi.fn(async (_name: string, _args: unknown) => ({
        data: { ok: true },
        error: null,
      }));
    await makeSandboxStore({ BILLING_RPC_SIGNING_SECRET: secret }, {
      rpc,
    } as unknown as Parameters<typeof makeSandboxStore>[1]).call("context", {
      requestId: rid,
    });
    const args = rpc.mock.calls[0]?.[1] as {
      signature: string;
      nonce: string;
      issued_at: number;
      raw_payload: string;
      command: string;
    };
    expect(args.signature).toBe(
      createHmac("sha256", createHash("sha256").update(secret).digest())
        .update(
          args.command +
            "\n" +
            args.nonce +
            "\n" +
            args.issued_at +
            "\n" +
            args.raw_payload,
        )
        .digest("hex"),
    );
    expect(JSON.stringify(args)).not.toContain(secret);
  });
});
