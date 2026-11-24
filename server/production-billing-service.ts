import { createHash } from "node:crypto";
import { isSupportedBillingEvent } from "./billing-contracts.ts";
import {
  ProductionBillingError,
  ProductionReadProvider,
} from "./production-billing-provider.ts";
import type { ProductionStore } from "./production-billing-store.ts";
export interface ProductionNotice {
  eventId: string;
  eventType: string;
  objectId: string;
  subscriptionId: string | null;
  environment: "production";
}
const id = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_&-]{3,200}$/.test(value);
export function productionNotice(
  body: Record<string, unknown>,
): ProductionNotice {
  if (
    !id(body.id) ||
    !isSupportedBillingEvent(body.event) ||
    !/^(PAYMENT|SUBSCRIPTION)_/.test(body.event)
  )
    throw new ProductionBillingError("INVALID_INPUT");
  const value = body.event.startsWith("PAYMENT_")
    ? body.payment
    : body.subscription;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ProductionBillingError("INVALID_INPUT");
  const object = value as Record<string, unknown>,
    prefix = body.event.startsWith("PAYMENT_") ? "pay_" : "sub_";
  if (!id(object.id) || !object.id.startsWith(prefix))
    throw new ProductionBillingError("INVALID_INPUT");
  return {
    eventId: body.id,
    eventType: body.event,
    objectId: object.id,
    subscriptionId:
      prefix === "sub_"
        ? object.id
        : id(object.subscription)
          ? object.subscription
          : null,
    environment: "production",
  };
}
interface Binding {
  id: string;
  business_id: string;
  customer_id: string;
  subscription_id: string;
  external_reference: string;
  amount_cents: number;
  method: string;
  cycle: string;
}
interface Claim {
  claimed: boolean;
  notice?: ProductionNotice;
  leaseToken?: string;
}
const cents = (value: unknown) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    !Number.isSafeInteger(Math.round(value * 100)) ||
    Math.abs(value * 100 - Math.round(value * 100)) > 0.00001
  )
    throw new ProductionBillingError("RECONCILIATION_REQUIRED");
  return Math.round(value * 100);
};
const paymentStatuses = new Set([
  "PENDING",
  "CONFIRMED",
  "RECEIVED",
  "OVERDUE",
  "REFUNDED",
  "DELETED",
  "PARTIALLY_REFUNDED",
  "REFUND_REQUESTED",
  "AWAITING_RISK_ANALYSIS",
  "CREDIT_CARD_CAPTURE_REFUSED",
  "REPROVED_BY_RISK_ANALYSIS",
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
  "AWAITING_CHARGEBACK_REVERSAL",
]);
export type ProductionLog = (entry: {
  component: "production-billing";
  eventHash: string;
  outcome: string;
}) => void;
export const productionLog: ProductionLog = (entry) =>
  console.info(JSON.stringify(entry));
export class ProductionReconciler {
  public store: ProductionStore;
  private provider: Pick<ProductionReadProvider, "read">;
  private log: ProductionLog;
  constructor(
    store: ProductionStore,
    provider: Pick<ProductionReadProvider, "read">,
    log: ProductionLog = productionLog,
  ) {
    this.store = store;
    this.provider = provider;
    this.log = log;
  }
  async process(eventId: string) {
    const eventHash = createHash("sha256")
      .update(eventId)
      .digest("hex")
      .slice(0, 16);
    let claim: Claim;
    try {
      claim = await this.store.call<Claim>("claim", { eventId });
    } catch {
      this.log({
        component: "production-billing",
        eventHash,
        outcome: "claim_unavailable",
      });
      throw new ProductionBillingError("UNAVAILABLE");
    }
    if (!claim.claimed || !claim.notice || !claim.leaseToken) return;
    const notice = claim.notice,
      leaseToken = claim.leaseToken;
    let bindingId: string | undefined;
    try {
      const paymentEvent = notice.eventType.startsWith("PAYMENT_");
      // Scope comes only from a pre-existing consented local binding. Never resolve
      // a foreign account payment through the provider just to discover its scope.
      const subscriptionId = notice.subscriptionId;
      const binding = subscriptionId
        ? await this.store.call<Binding | null>("binding", {
            eventId,
            leaseToken,
            subscriptionId,
          })
        : null;
      if (!binding) {
        await this.store.call("ignore_unbound", { eventId, leaseToken });
        this.log({ component: "production-billing", eventHash, outcome: "ignored_unbound" });
        return;
      }
      bindingId = binding.id;
      // Leituras após o lease do vínculo: um evento antigo nunca aplica o payload do webhook.
      const subscription = await this.provider.read(
        "subscriptions",
        binding.subscription_id,
      );
      if (
        subscription.customer !== binding.customer_id ||
        subscription.externalReference !== binding.external_reference ||
        cents(subscription.value) !== binding.amount_cents ||
        subscription.billingType !== binding.method ||
        subscription.cycle !== binding.cycle
      )
        throw new ProductionBillingError("RECONCILIATION_REQUIRED");
      const subscriptionStatus = subscription.deleted
        ? "DELETED"
        : subscription.status;
      if (
        !["ACTIVE", "INACTIVE", "EXPIRED", "DELETED"].includes(
          String(subscriptionStatus),
        )
      )
        throw new ProductionBillingError("RECONCILIATION_REQUIRED");
      let paymentSnapshot: Record<string, unknown> | null = null;
      if (paymentEvent) {
        const payment = await this.provider.read("payments", notice.objectId),
          status = payment.deleted ? "DELETED" : payment.status;
        if (
          payment.customer !== binding.customer_id ||
          payment.subscription !== binding.subscription_id ||
          cents(payment.value) !== binding.amount_cents ||
          payment.billingType !== binding.method ||
          !paymentStatuses.has(String(status))
        )
          throw new ProductionBillingError("RECONCILIATION_REQUIRED");
        let refundedCents = status === "REFUNDED" ? binding.amount_cents : 0;
        if (status !== "REFUNDED" && payment.refunds !== undefined) {
          if (!Array.isArray(payment.refunds))
            throw new ProductionBillingError("RECONCILIATION_REQUIRED");
          for (const refund of payment.refunds) {
            if (!refund || typeof refund !== "object")
              throw new ProductionBillingError("RECONCILIATION_REQUIRED");
            if (refund.status === "DONE") refundedCents += cents(refund.value);
          }
        }
        if (
          refundedCents > binding.amount_cents ||
          (status === "PARTIALLY_REFUNDED" && refundedCents === 0)
        )
          throw new ProductionBillingError("RECONCILIATION_REQUIRED");
        paymentSnapshot = {
          paymentId: notice.objectId,
          subscriptionId: binding.subscription_id,
          customerId: binding.customer_id,
          amountCents: binding.amount_cents,
          refundedCents,
          status,
          settled: status === "RECEIVED",
        };
      }
      await this.store.call("complete", {
        eventId,
        leaseToken,
        bindingId,
        subscriptionStatus,
        payment: paymentSnapshot,
      });
      this.log({
        component: "production-billing",
        eventHash,
        outcome: "reconciled_observation_only",
      });
    } catch (error) {
      const code =
        error instanceof ProductionBillingError ? error.code : "UNAVAILABLE";
      try {
        await this.store.call("fail", { eventId, leaseToken, bindingId, code });
      } finally {
        this.log({ component: "production-billing", eventHash, outcome: code });
      }
    }
  }
  async retry() {
    const result = await this.store.call<{ eventIds: string[] }>("due", {});
    for (const id of result.eventIds) await this.process(id);
    return { examined: result.eventIds.length };
  }
}
