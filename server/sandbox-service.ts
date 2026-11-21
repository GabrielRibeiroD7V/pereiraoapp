import type {
  PaymentMethod,
  AsaasPayment,
  AsaasSubscription,
} from "./sandbox-provider.ts";
import {
  SandboxProvider,
  ProviderError,
  cents,
  sandboxLink,
  providerId,
} from "./sandbox-provider.ts";
import type { SandboxStore } from "./sandbox-store.ts";
import { BillingError } from "./sandbox-store.ts";
import type { BillingWebhookNotice } from "./billing-contracts.ts";
export interface SandboxContract {
  request_id: string;
  business_id: string;
  user_id: string;
  method: PaymentMethod;
  amount_cents: number;
  first_due_date: string;
  customer_id: string | null;
  subscription_id: string | null;
  checkout_id: string | null;
  invoice_url: string | null;
  state: string;
  created_at: string;
  provider_cancelled: boolean;
}
export interface SandboxOverview {
  contracts: SandboxContract[];
  payments: Record<string, unknown>[];
  summary?: Record<string, number>;
  environment: "sandbox";
  realRevenueAvailable: false;
}
const date = (value: unknown) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value));
const knownStatuses = new Set([
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
export function contractView(c: SandboxContract) {
  return {
    requestId: c.request_id,
    businessId: c.business_id,
    method: c.method,
    amountCents: c.amount_cents,
    firstDueDate: c.first_due_date,
    checkoutUrl: sandboxLink(c.invoice_url),
    state: c.state,
    createdAt: c.created_at,
  };
}
export function overviewView(value: SandboxOverview) {
  return {
    ...value,
    contracts: value.contracts.map(contractView),
    payments: value.payments.map((p) => ({
      paymentId: p.payment_id,
      requestId: p.request_id,
      amountCents: p.amount_cents,
      refundedCents: p.refunded_cents,
      status: p.status,
      dueDate: p.due_date,
      settled: p.settled,
      updatedAt: p.updated_at,
    })),
  };
}
export function validateSubscription(s: AsaasSubscription, c: SandboxContract) {
  if (
    !providerId(s.id) ||
    s.customer !== c.customer_id ||
    cents(s.value) !== c.amount_cents ||
    s.cycle !== "MONTHLY" ||
    s.billingType !== c.method ||
    !(
      s.externalReference === c.request_id ||
      (c.checkout_id && s.checkoutSession === c.checkout_id)
    )
  )
    throw new BillingError("RECONCILIATION_REQUIRED");
}
export function paymentSnapshot(p: AsaasPayment, c: SandboxContract) {
  if (
    !providerId(p.id) ||
    !p.id.startsWith("pay_") ||
    p.customer !== c.customer_id ||
    p.subscription !== c.subscription_id ||
    p.billingType !== c.method ||
    cents(p.value) !== c.amount_cents ||
    !date(p.dueDate)
  )
    throw new BillingError("RECONCILIATION_REQUIRED");
  const status = p.deleted ? "DELETED" : p.status;
  if (!knownStatuses.has(status))
    throw new BillingError("RECONCILIATION_REQUIRED");
  let refunded = 0;
  if (status === "REFUNDED") refunded = c.amount_cents;
  else if (p.refunds) {
    for (const refund of p.refunds)
      if (refund.status === "DONE") refunded += cents(refund.value);
  }
  if (
    refunded > c.amount_cents ||
    (status === "PARTIALLY_REFUNDED" && refunded === 0)
  )
    throw new BillingError("RECONCILIATION_REQUIRED");
  const rawConfirmed = p.confirmedDate ?? p.paymentDate ?? null;
  const confirmedAt =
    rawConfirmed && Number.isFinite(Date.parse(rawConfirmed))
      ? new Date(rawConfirmed).toISOString()
      : null;
  return {
    paymentId: p.id,
    requestId: c.request_id,
    subscriptionId: c.subscription_id,
    customerId: c.customer_id,
    amountCents: c.amount_cents,
    refundedCents: refunded,
    status,
    dueDate: p.dueDate,
    method: p.billingType,
    settled: status === "RECEIVED" || (refunded > 0 && !!p.paymentDate),
    confirmedAt,
  };
}
export class SandboxService {
  constructor(
    public store: SandboxStore,
    private provider: SandboxProvider,
  ) {}
  async start(
    userId: string,
    businessId: string,
    requestId: string,
    method: PaymentMethod,
    returnUrl: string,
  ) {
    const reserved = await this.store.call<{
      claimed: boolean;
      contract: SandboxContract;
    }>("reserve", {
      userId,
      businessId,
      requestId,
      method,
      accepted: true,
      termsVersion: "sandbox-v1",
      amountCents: 1999,
    });
    if (!reserved.claimed) return contractView(reserved.contract);
    let c = reserved.contract;
    try {
      if (!c.customer_id) {
        const reference = "pereirao:sandbox:" + businessId;
        const found = await this.provider.findCustomers(reference);
        if (
          found.length > 1 ||
          found.some(
            (x) => x.externalReference !== reference || !providerId(x.id),
          )
        )
          throw new BillingError("RECONCILIATION_REQUIRED");
        const id =
          found[0]?.id ?? (await this.provider.createCustomer(reference));
        c = await this.store.call<SandboxContract>("customer_saved", {
          requestId,
          customerId: id,
        });
      }
      if (!c.customer_id) throw new BillingError("RECONCILIATION_REQUIRED");
      await this.store.call("subscription_started", { requestId });
      if (method === "PIX") {
        const s = await this.provider.createPixSubscription(
          c.customer_id,
          requestId,
          c.first_due_date,
        );
        try {
          validateSubscription(s, c);
        } catch (error) {
          // Resposta divergente, mas inequivocamente da operação: preservar ID e
          // cancelar a recorrência não consentida. Nunca cancelar recurso alheio.
          if (
            /^sub_[A-Za-z0-9_-]+$/.test(s.id) &&
            s.customer === c.customer_id &&
            s.externalReference === requestId
          ) {
            await this.store.call("save_provider", {
              requestId,
              subscriptionId: s.id,
            });
            await this.provider.cancelSubscription(s.id);
            await this.store.call("cancelled", { requestId, userId });
          }
          throw error;
        }
        c = await this.store.call<SandboxContract>("save_provider", {
          requestId,
          subscriptionId: s.id,
        });
        const payments = await this.provider.payments(s.id);
        const first = payments
          .filter((p) => p.subscription === s.id)
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
        if (first) {
          paymentSnapshot(first, c);
          c = await this.store.call<SandboxContract>("save_provider", {
            requestId,
            invoiceUrl: sandboxLink(first.invoiceUrl),
          });
        }
      } else {
        const checkout = await this.provider.createCardCheckout(
          c.customer_id,
          requestId,
          c.first_due_date,
          returnUrl,
        );
        c = await this.store.call<SandboxContract>("save_provider", {
          requestId,
          checkoutId: checkout.id,
          invoiceUrl: checkout.link,
        });
      }
      return contractView(c);
    } catch (e) {
      await this.store.call("uncertain", { requestId }).catch(() => {});
      throw e;
    }
  }
  async reconcileContract(
    requestId: string,
    userId?: string,
    eventId?: string,
    focusPaymentId?: string,
  ) {
    const context = await this.store.call<SandboxContract>("context", {
      requestId,
      ...(userId ? { userId } : {}),
    });
    const locked = await this.store.call<{
      contract: SandboxContract;
      leaseToken: string;
    } | null>("claim_contract", { requestId });
    if (!locked) throw new BillingError("CONFLICT");
    let c = locked.contract;
    const leaseToken = locked.leaseToken;
    try {
      if (!c.customer_id) {
        const found = await this.provider.findCustomers(
          "pereirao:sandbox:" + c.business_id,
        );
        if (
          found.length !== 1 ||
          found[0]!.externalReference !== "pereirao:sandbox:" + c.business_id
        )
          throw new BillingError("RECONCILIATION_REQUIRED");
        c = await this.store.call<SandboxContract>("customer_saved", {
          requestId,
          customerId: found[0]!.id,
        });
      }
      let s: AsaasSubscription | null = null;
      if (c.subscription_id) {
        try {
          s = await this.provider.getSubscription(c.subscription_id);
        } catch (e) {
          if (e instanceof ProviderError && e.code === "NOT_FOUND") {
            await this.store.call("cancelled", { requestId, userId });
          } else {
            throw e;
          }
        }
      } else {
        const matches = (
          await this.provider.findSubscriptions(c.customer_id!)
        ).filter(
          (s) =>
            s.externalReference === c.request_id ||
            (c.checkout_id && s.checkoutSession === c.checkout_id),
        );
        if (matches.length !== 1)
          throw new BillingError("RECONCILIATION_REQUIRED");
        s = matches[0]!;
      }
      if (s) {
        validateSubscription(s, c);
        c = await this.store.call<SandboxContract>("save_provider", {
          requestId,
          subscriptionId: s.id,
        });
        if (s.deleted || s.status === "INACTIVE") {
          await this.store.call("cancelled", { requestId, userId });
        } else if (s.status !== "ACTIVE")
          throw new BillingError("RECONCILIATION_REQUIRED");
      }
      let payments: AsaasPayment[] = [];
      try {
        payments = await this.provider.payments(c.subscription_id!);
      } catch (e) {
        if (s || !(e instanceof ProviderError && e.code === "NOT_FOUND"))
          throw e;
      }
      const known = await this.store.call<string[]>("known_payments", {
        requestId,
      });
      const ids = new Set([
        ...payments.map((p) => p.id),
        ...known,
        ...(focusPaymentId ? [focusPaymentId] : []),
      ]);
      for (const id of ids) {
        const current = await this.provider.getPayment(id);
        const snapshot = paymentSnapshot(current, c);
        await this.store.call("apply_payment", {
          ...snapshot,
          leaseToken,
          eventId,
        });
      }
      const latest = payments
        .filter((p) => sandboxLink(p.invoiceUrl))
        .sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];
      if (latest)
        await this.store.call("save_provider", {
          requestId,
          invoiceUrl: sandboxLink(latest.invoiceUrl),
        });
    } catch (e) {
      await this.store
        .call("uncertain", { requestId: context.request_id })
        .catch(() => {});
      throw e;
    } finally {
      await this.store
        .call("release_contract", { requestId, leaseToken })
        .catch(() => {});
    }
  }
  async cancel(userId: string, requestId: string) {
    const c = await this.store.call<SandboxContract>("cancel_context", {
      userId,
      requestId,
    });
    if (c.state === "cancelled") return;
    try {
      if (c.subscription_id)
        await this.provider.cancelSubscription(c.subscription_id);
      else if (c.checkout_id) await this.provider.cancelCheckout(c.checkout_id);
      else throw new BillingError("RECONCILIATION_REQUIRED");
    } catch (e) {
      if (!(e instanceof ProviderError && e.code === "NOT_FOUND")) throw e;
    }
    await this.store.call("cancelled", { requestId, userId });
  }
  async refund(userId: string, requestId: string, paymentId: string) {
    const claim = await this.store.call<{ claimed: boolean }>("claim_refund", {
      userId,
      requestId,
      paymentId,
    });
    if (!claim.claimed) return;
    try {
      await this.provider.refund(paymentId);
      await this.store.call("refund_result", {
        requestId,
        state: "acknowledged",
      });
    } catch (e) {
      await this.store
        .call("refund_result", { requestId, state: "uncertain" })
        .catch(() => {});
      throw e;
    }
  }
  async processEvent(eventId: string) {
    const event = await this.store.call<{
      notice: BillingWebhookNotice;
      leaseToken: string;
    } | null>("claim_event", { eventId });
    if (!event) return;
    let outcome = "processed";
    try {
      const n = event.notice;
      let c: SandboxContract | null = null;
      if (n.eventType.startsWith("PAYMENT_")) {
        const p = await this.provider.getPayment(n.objectId);
        if (!p.subscription) {
          outcome = "ignored";
          return;
        }
        c = await this.store.call<SandboxContract | null>("find_contract", {
          subscriptionId: p.subscription,
        });
        if (!c) {
          const s = await this.provider.getSubscription(p.subscription);
          c = await this.store.call<SandboxContract | null>("find_contract", {
            subscriptionId: s.id,
            checkoutId: s.checkoutSession,
            externalReference: s.externalReference,
          });
        }
      } else if (n.eventType.startsWith("SUBSCRIPTION_")) {
        c = await this.store.call<SandboxContract | null>("find_contract", {
          subscriptionId: n.objectId,
        });
        if (!c) {
          const s = await this.provider.getSubscription(n.objectId);
          c = await this.store.call<SandboxContract | null>("find_contract", {
            subscriptionId: s.id,
            checkoutId: s.checkoutSession,
            externalReference: s.externalReference,
          });
        }
      } else {
        c = await this.store.call<SandboxContract | null>("find_contract", {
          checkoutId: n.objectId,
          externalReference: n.externalReference,
        });
        if (c && !c.checkout_id)
          c = await this.store.call<SandboxContract>("save_provider", {
            requestId: c.request_id,
            checkoutId: n.objectId,
          });
      }
      if (!c) {
        outcome = "ignored";
        return;
      }
      await this.reconcileContract(
        c.request_id,
        undefined,
        eventId,
        n.eventType.startsWith("PAYMENT_") ? n.objectId : undefined,
      );
    } catch {
      outcome = "reconcile_required";
    } finally {
      await this.store.call("event_done", {
        eventId,
        leaseToken: event.leaseToken,
        outcome,
      });
    }
  }
  async retryEvents(userId: string) {
    const r = await this.store.call<{ eventIds: string[] }>("retry_events", {
      userId,
    });
    for (const id of r.eventIds) await this.processEvent(id);
    return { processedAttempts: r.eventIds.length };
  }
}
