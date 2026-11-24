export type SubscriptionState =
  | "initial_free"
  | "exempt"
  | "awaiting_activation"
  | "trial_active"
  | "trial_ended"
  | "active"
  | "pending_payment"
  | "cancelled";
export interface BusinessSubscription {
  businessId: string;
  businessName: string;
  accessPhase?: "initial_free";
  state: SubscriptionState;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  contractedAt: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  serverNow: string;
  checkoutAvailable: false;
  enforcementEnabled: false;
}
export interface SubscriptionPage {
  items: BusinessSubscription[];
  hasNext: boolean;
}
export interface AccessStatus {
  phase: "initial_free";
  effectiveAt: string;
  trialClockRunning: false;
  checkoutAvailable: false;
  enforcementEnabled: false;
  automaticConversion: false;
}
export interface SubscriptionRepository {
  accessStatus?(): Promise<AccessStatus | null>;
  list(
    businessId?: string,
    page?: number,
    signal?: AbortSignal,
  ): Promise<SubscriptionPage>;
}
export interface AdminSubscriptionRow {
  businessId: string;
  businessName: string;
  state: SubscriptionState;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  sameOwnerActivations: number;
}
export interface AdminSubscriptions {
  items: AdminSubscriptionRow[];
  hasNext: boolean;
  summary: {
    trialActive: number;
    trialEnded: number;
    active: number;
    pendingPayment: number;
    cancelled: number;
    confirmedRevenueCents: null;
    revenueAvailable: false;
  };
  extensionsEnabled: boolean;
  checkoutAvailable: false;
  enforcementEnabled: false;
}
export const subscriptionLabels: Record<SubscriptionState, string> = {
  initial_free: "Fase inicial gratuita",
  exempt: "Isento de assinatura",
  awaiting_activation: "Aguardando ativação",
  trial_active: "Gratuidade ativa",
  trial_ended: "Gratuidade encerrada",
  active: "Assinatura ativa",
  pending_payment: "Pagamento pendente",
  cancelled: "Assinatura cancelada",
};
export function subscriptionError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  return ["SETUP_REQUIRED", "PGRST202", "42883", "42P01", "PGRST205"].includes(
    code,
  )
    ? "Consulta indisponível neste momento."
    : code === "42501" || code === "AUTH_REQUIRED"
      ? "Entre com a conta responsável pelo negócio para consultar a situação."
      : "Não foi possível consultar a situação. Verifique sua conexão e tente novamente.";
}
