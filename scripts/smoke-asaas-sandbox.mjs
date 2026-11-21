// Operação EXPLÍCITA de homologação; não participa do build normal nem toca no Supabase.
// Executar no build de um Preview desta branch, onde o segredo já existe no servidor.
import { SandboxProvider, cents } from "../server/sandbox-provider.ts";
const run = process.argv[2];
if (
  process.env.VERCEL_ENV !== "preview" ||
  process.env.VERCEL_GIT_COMMIT_REF !== "feat/asaas-sandbox" ||
  !run ||
  !/^pr17-[a-z0-9-]{6,40}$/.test(run)
)
  throw Error("SMOKE_NOT_AUTHORIZED");
const key = process.env.ASSAS_API_KEY_SANDBOX ?? "";
const provider = new SandboxProvider(key);
const reference = "pereirao:synthetic:" + run;
const report = { run, environment: "sandbox", supabaseWrites: 0 };
let createdSubscription = null;
// IDs sintéticos e estados são a única saída; nunca corpos, headers ou segredos.
const emit = () =>
  process.stdout.write("SANDBOX_SMOKE " + JSON.stringify(report) + "\n");
try {
  const existing = await provider.findCustomers(reference);
  if (existing.length) throw Error("RUN_ALREADY_EXISTS_DO_NOT_REPEAT_POST");
  const customer = await provider.createCustomer(reference);
  report.customerId = customer;
  emit();
  const due = new Date().toISOString().slice(0, 10);
  const requestId = crypto.randomUUID();
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
      headers: { access_token: key, "User-Agent": "PereiraoSandboxSmoke/1.0" },
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
