// Dados sintéticos locais; não importados pelo entrypoint de produção.
import type {
  BillingOverview,
  SandboxBillingRepository,
} from "../billing/types";
export function billingFixture(open = false) {
  const data: BillingOverview = {
    environment: "sandbox",
    realRevenueAvailable: false,
    contracts: open
      ? [
          {
            requestId: "00000000-0000-4000-8000-000000000333",
            businessId: "00000000-0000-4000-8000-000000000001",
            method: "PIX",
            amountCents: 1999,
            firstDueDate: "2026-11-21",
            checkoutUrl: "https://sandbox.asaas.com/i/synthetic",
            state: "pending",
            createdAt: "2026-11-21T00:00:00Z",
          },
        ]
      : [],
    payments: [],
    summary: {
      testContracts: open ? 1 : 0,
      active: 0,
      pending: open ? 1 : 0,
      overdue: 0,
      cancelled: 0,
      refunded: 0,
      confirmedPayments: 0,
      receivedCents: 0,
      eventsPending: 0,
    },
  };
  const repo: SandboxBillingRepository = {
    available: true,
    overview: async () => structuredClone(data),
    admin: async () => structuredClone(data),
    start: async (businessId, requestId, method) => {
      const contract = {
        businessId,
        requestId,
        method,
        amountCents: 1999,
        firstDueDate: "2026-11-21",
        checkoutUrl: "https://sandbox.asaas.com/i/synthetic",
        state: "pending",
        createdAt: new Date().toISOString(),
      };
      data.contracts.push(contract);
      return contract;
    },
    reconcile: async () => {},
    cancel: async (id) => {
      const c = data.contracts.find((c) => c.requestId === id);
      if (c) c.state = "cancelled";
    },
    refund: async () => {},
    retry: async () => {},
  };
  return { repo, data };
}
