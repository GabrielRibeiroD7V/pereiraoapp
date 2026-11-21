// Contratos para integração futura. Não é um webhook/endpoint nem altera direitos de uso.
export interface BillingWebhookNotice {
  provider: "asaas";
  environment: "sandbox";
  eventId: string;
  eventType: string;
  objectId: string;
  subscriptionId: string | null;
  requiresReconciliation: true;
  externalReference?: string | null;
}
export interface ReconciliationDecision {
  businessId: string;
  providerSubscriptionId: string;
  paymentId: string;
  expectedAmountCents: number;
  confirmedAmountCents: number;
  confirmedAt: string;
}
const identifier = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_&-]{3,200}$/.test(v);
export function billingNotice(value: unknown): BillingWebhookNotice | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    !identifier(v.id) ||
    typeof v.event !== "string" ||
    ![
      "PAYMENT_CREATED",
      "PAYMENT_CONFIRMED",
      "PAYMENT_RECEIVED",
      "PAYMENT_OVERDUE",
      "PAYMENT_REFUNDED",
      "PAYMENT_DELETED",
      "PAYMENT_UPDATED",
      "PAYMENT_RESTORED",
      "PAYMENT_PARTIALLY_REFUNDED",
      "PAYMENT_REFUND_IN_PROGRESS",
      "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
      "PAYMENT_AWAITING_RISK_ANALYSIS",
      "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
      "PAYMENT_CHARGEBACK_REQUESTED",
      "PAYMENT_CHARGEBACK_DISPUTE",
      "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
      "SUBSCRIPTION_CREATED",
      "SUBSCRIPTION_UPDATED",
      "SUBSCRIPTION_DELETED",
      "CHECKOUT_CREATED",
      "CHECKOUT_PAID",
      "CHECKOUT_CANCELED",
      "CHECKOUT_EXPIRED",
    ].includes(v.event)
  )
    return null;
  const object = v.event.startsWith("PAYMENT_")
    ? v.payment
    : v.event.startsWith("CHECKOUT_")
      ? v.checkout
      : v.subscription;
  if (!object || typeof object !== "object" || Array.isArray(object))
    return null;
  const data = object as Record<string, unknown>;
  if (!identifier(data.id)) return null;
  return {
    provider: "asaas",
    environment: "sandbox",
    eventId: v.id,
    eventType: v.event,
    objectId: data.id,
    subscriptionId: v.event.startsWith("SUBSCRIPTION_")
      ? data.id
      : identifier(data.subscription)
        ? data.subscription
        : null,
    requiresReconciliation: true,
    ...(v.event.startsWith("CHECKOUT_")
      ? {
          externalReference:
            typeof data.externalReference === "string" &&
            /^[0-9a-f-]{36}$/i.test(data.externalReference)
              ? data.externalReference
              : null,
        }
      : {}),
  };
}
export function billingEventKey(notice: BillingWebhookNotice) {
  return notice.provider + ":" + notice.environment + ":" + notice.eventId;
}
