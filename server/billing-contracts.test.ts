// @vitest-environment node
import { describe, it, expect } from "vitest";
import { billingNotice, billingEventKey } from "./billing-contracts";
describe("contratos futuros de conciliação", () => {
  it("projeta apenas identificadores e exige conciliação inclusive para pagamento confirmado", () => {
    const notice = billingNotice({
      id: "evt_local&001",
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_local",
        subscription: "sub_local",
        creditCard: { number: "private-card" },
        customer: "private-customer",
      },
    });
    expect(notice).toEqual({
      provider: "asaas",
      environment: "sandbox",
      eventId: "evt_local&001",
      eventType: "PAYMENT_CONFIRMED",
      objectId: "pay_local",
      subscriptionId: "sub_local",
      requiresReconciliation: true,
    });
    expect(JSON.stringify(notice)).not.toContain("private");
    expect(notice).not.toHaveProperty("status");
  });
  it("deduplica por fornecedor ambiente e ID, independente de repetição", () => {
    const event = {
      id: "evt_local",
      event: "SUBSCRIPTION_UPDATED",
      subscription: { id: "sub_local" },
    };
    expect(billingEventKey(billingNotice(event)!)).toBe(
      billingEventKey(billingNotice(event)!),
    );
    expect(billingEventKey(billingNotice(event)!)).toBe(
      "asaas:sandbox:evt_local",
    );
  });
  it.each([
    null,
    [],
    {},
    { id: "evt_local", event: "UNKNOWN", payment: { id: "pay_local" } },
    { id: "evt_local", event: "PAYMENT_RECEIVED", payment: { id: "bad/id" } },
  ])("ignora contrato inválido %j", (v) => expect(billingNotice(v)).toBeNull());
});
