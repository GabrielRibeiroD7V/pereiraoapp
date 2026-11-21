// Operação EXPLÍCITA de homologação; não participa do build normal nem toca no Supabase.
// Executar no build de um Preview desta branch, onde o segredo já existe no servidor.
import { SandboxProvider, cents } from "../server/sandbox-provider.ts";
const run = process.argv[2];
if (
  process.env.VERCEL_ENV !== "preview" ||
  process.env.VERCEL_GIT_COMMIT_REF !== "feat/asaas-sandbox" ||
  !run ||
  !/^pr17-(?:[a-z0-9-]{6,40}|inspect-sub_[a-z0-9]{8,40})$/.test(run)
)
  throw Error("SMOKE_NOT_AUTHORIZED");
const key = process.env.ASSAS_API_KEY_SANDBOX ?? "";
const reference = "pereirao:synthetic:" + run;
const report = { run, environment: "sandbox", supabaseWrites: 0 };
const provider = new SandboxProvider(key, async (url, init) => {
  const response = await fetch(url, init);
  if (!response.ok) {
    try {
      const errors = (await response.clone().json()).errors;
      // Somente diagnóstico desta fixture sintética: remove chave, e-mails e identificadores.
      report.providerValidation = Array.isArray(errors)
        ? errors.slice(0, 3).map((e) => ({
            code:
              typeof e.code === "string" && /^[a-z_]{3,60}$/.test(e.code)
                ? e.code
                : "provider_error",
            description: String(e.description ?? "")
              .replaceAll(key, "[credential]")
              .replace(/\$aact_[^\s"'<>]+/g, "[credential]")
              .replace(/[\w.+%-]+@[\w.-]+\.[A-Za-z]+/g, "[email]")
              .replace(/\b(?:cus|sub|pay)_[A-Za-z0-9_-]+\b/g, "[id]")
              .replace(/\b\d{5,}\b/g, "[number]")
              .slice(0, 200),
          }))
        : [];
    } catch {
      /* Nenhum corpo bruto é impresso. */
    }
  }
  return response;
});
let createdSubscription = null;
// IDs sintéticos e estados são a única saída; nunca corpos, headers ou segredos.
const emit = () =>
  process.stdout.write("SANDBOX_SMOKE " + JSON.stringify(report) + "\n");
try {
  if (run === "pr17-card-audit-20261121-a") {
    const customer = "cus_000010060912",
      checkout = "4fa84e61-980f-4110-b35a-8f4678c8808e";
    const owners = await provider.findCustomers(
      "pereirao:synthetic:pr17-card-20261121-a",
    );
    if (owners.length !== 1 || owners[0].id !== customer)
      throw Error("RUN_CONFLICT");
    const subscriptions = await provider.findSubscriptions(customer);
    report.observedSubscriptions = subscriptions.map((s) => ({
      id: s.id,
      customer: s.customer,
      checkout: s.checkoutSession,
      externalReference: s.externalReference,
      method: s.billingType,
      value: s.value,
      cycle: s.cycle,
      status: s.status,
    }));
    emit();
    const matches = subscriptions.filter(
      (s) =>
        s.customer === customer &&
        s.checkoutSession === checkout &&
        s.billingType === "CREDIT_CARD" &&
        s.cycle === "MONTHLY" &&
        cents(s.value) === 1999,
    );
    if (matches.length !== 1) throw Error("PROVIDER_MAPPING_NOT_FOUND");
    const s = await provider.getSubscription(matches[0].id);
    if (s.customer !== customer || s.checkoutSession !== checkout)
      throw Error("PROVIDER_MISMATCH");
    const payments = await provider.payments(s.id);
    report.cardSubscriptionId = s.id;
    report.cardPayments = payments.map((p) => ({
      id: p.id,
      method: p.billingType,
      value: p.value,
      status: p.status,
      subscription: p.subscription,
      customer: p.customer,
    }));
    emit();
    for (const item of payments) {
      const p = await provider.getPayment(item.id);
      if (
        p.customer !== customer ||
        p.subscription !== s.id ||
        p.billingType !== "CREDIT_CARD" ||
        cents(p.value) !== 1999
      )
        throw Error("PROVIDER_MISMATCH");
      if (["CONFIRMED", "RECEIVED"].includes(p.status)) {
        await provider.refund(p.id);
        report.cardRefund = {
          paymentId: p.id,
          status: (await provider.getPayment(p.id)).status,
        };
        emit();
      }
    }
    await provider.cancelSubscription(s.id);
    report.cardCancelled = true;
    emit();
    process.exit(0);
  }
  if (run.startsWith("pr17-inspect-sub_")) {
    const id = run.slice("pr17-inspect-".length);
    const s = await provider.getSubscription(id);
    report.inspection = {
      id: s.id,
      method: s.billingType,
      cycle: s.cycle,
      value: s.value,
      customerId: s.customer,
      externalReference: s.externalReference,
      deleted: s.deleted,
    };
    emit();
    process.exit(0);
  }
  const existing = await provider.findCustomers(reference);
  if (existing.length) throw Error("RUN_ALREADY_EXISTS_DO_NOT_REPEAT_POST");
  const customer = await provider.createCustomer(reference);
  report.customerId = customer;
  emit();
  const due = new Date().toISOString().slice(0, 10);
  const requestId = crypto.randomUUID();
  if (!run.startsWith("pr17-card-")) {
    const subscription = await provider.createPixSubscription(
      customer,
      requestId,
      due,
    );
    report.pixSubscriptionId = subscription.id;
    createdSubscription = subscription.id;
    emit();
    if (
      subscription.customer !== customer ||
      subscription.externalReference !== requestId ||
      cents(subscription.value) !== 1999 ||
      subscription.billingType !== "PIX"
    )
      throw Error("PROVIDER_MISMATCH");
    const payments = await provider.payments(subscription.id);
    const payment = payments[0];
    if (
      !payment ||
      payment.customer !== customer ||
      payment.subscription !== subscription.id ||
      cents(payment.value) !== 1999
    )
      throw Error("PAYMENT_NOT_READY");
    report.pixPaymentId = payment.id;
    report.pixInitialStatus = payment.status;
    emit();
    // Endpoint oficial exclusivamente Sandbox. Não recebe IDs externos ao ensaio.
    const confirmed = await fetch(
      "https://api-sandbox.asaas.com/v3/sandbox/payment/" +
        payment.id +
        "/confirm",
      {
        method: "POST",
        headers: {
          access_token: key,
          "User-Agent": "PereiraoSandboxSmoke/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      },
    );
    report.confirmHttp = confirmed.status;
    await confirmed.body?.cancel();
    const after = await provider.getPayment(payment.id);
    report.pixConfirmedStatus = after.status;
    emit();
    if (["CONFIRMED", "RECEIVED"].includes(after.status)) {
      await provider.refund(payment.id);
      report.refundStatus = (await provider.getPayment(payment.id)).status;
      emit();
    }
    await provider.cancelSubscription(subscription.id);
    report.pixCancelled = true;
    emit();
  }
  const checkout = await provider.createCardCheckout(
    customer,
    crypto.randomUUID(),
    due,
    "https://pereirao.vercel.app/conta/assinaturas",
  );
  report.cardCheckoutId = checkout.id;
  report.cardCheckoutUrl = checkout.link;
  report.cardPaymentExecuted = false;
  report.cardPending =
    "Pagamento hospedado depende da conclusão do checkout de homologação";
  emit();
} catch (error) {
  report.errorCode =
    error instanceof Error && /^[A-Z_]+$/.test(error.message)
      ? error.message
      : "SMOKE_FAILED";
  if (error instanceof Error && "httpStatus" in error)
    report.httpStatus = error.httpStatus;
  if (error instanceof Error && "reason" in error) report.reason = error.reason;
  emit();
  process.exitCode = 1;
} finally {
  if (createdSubscription && !report.pixCancelled) {
    try {
      await provider.cancelSubscription(createdSubscription);
      report.pixCancelled = true;
    } catch {
      report.cancellationPending = true;
    }
    emit();
  }
}
