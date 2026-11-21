// Contratos para integração futura. Não é um webhook/endpoint nem altera direitos de uso.
export interface BillingWebhookNotice {
  provider: "asaas";
  environment: "sandbox";
  eventId: string;
  eventType: string;
  objectId: string;
  subscriptionId: string | null;
  requiresReconciliation: true;
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
      "SUBSCRIPTION_CREATED",
      "SUBSCRIPTION_UPDATED",
      "SUBSCRIPTION_DELETED",
    ].includes(v.event)
  )
    return null;
  const object = v.event.startsWith("PAYMENT_") ? v.payment : v.subscription;
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
  };
}
export function billingEventKey(notice: BillingWebhookNotice) {
  return notice.provider + ":" + notice.environment + ":" + notice.eventId;
}
