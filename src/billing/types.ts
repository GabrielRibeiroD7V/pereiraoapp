export interface TestContract {
  requestId: string;
  businessId: string;
  method: "PIX" | "CREDIT_CARD";
  amountCents: number;
  firstDueDate: string;
  checkoutUrl: string | null;
  state: string;
  createdAt: string;
}
export interface TestPayment {
  paymentId: string;
  requestId: string;
  amountCents: number;
  refundedCents: number;
  status: string;
  dueDate: string;
  settled: boolean;
  updatedAt: string;
}
export interface BillingOverview {
  contracts: TestContract[];
  payments: TestPayment[];
  summary?: {
    testContracts: number;
    active: number;
    pending: number;
    overdue: number;
    cancelled: number;
    refunded: number;
    confirmedPayments: number;
    receivedCents: number;
    eventsPending: number;
  };
  environment: "sandbox";
  realRevenueAvailable: false;
}
export interface SandboxBillingRepository {
  available: boolean;
  pixAvailable: boolean;
  overview(businessId: string, signal?: AbortSignal): Promise<BillingOverview>;
  start(
    businessId: string,
    requestId: string,
    method: "PIX" | "CREDIT_CARD",
  ): Promise<TestContract>;
  reconcile(requestId: string): Promise<void>;
  cancel(requestId: string): Promise<void>;
  admin(signal?: AbortSignal): Promise<BillingOverview>;
  retry(): Promise<void>;
  refund(paymentId: string, requestId: string): Promise<void>;
}
export function billingError(e: unknown) {
  const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
  return code === "SETUP_REQUIRED"
    ? "A homologação aguarda a migração e a configuração segura do servidor."
    : code === "PIX_NOT_VALIDATED"
      ? "O Pix ainda depende de homologação neste Sandbox. Utilize o teste com cartão."
      : code === "SANDBOX_DISABLED"
        ? "Os testes financeiros ficam disponíveis somente no ambiente Preview autorizado."
        : code === "CONFLICT"
          ? "Já existe uma operação de teste para este negócio. Atualize a consulta antes de tentar novamente."
          : code === "FORBIDDEN" || code === "AUTH_REQUIRED"
            ? "Sua conta não tem acesso a esta operação."
            : "Não foi possível concluir. Consulte a situação antes de tentar novamente; não será criada outra assinatura automaticamente.";
}
export const testStates: Record<string, string> = {
  prepared: "Preparando simulação",
  customer_ready: "Cliente de teste preparado",
  subscription_pending: "Aguardando resposta do Asaas",
  pending: "Aguardando pagamento de teste",
  active: "Ativa no Sandbox",
  overdue: "Pagamento de teste vencido",
  cancelled: "Simulação cancelada",
  refunded: "Pagamento de teste estornado",
  uncertain: "Conciliação necessária",
};
