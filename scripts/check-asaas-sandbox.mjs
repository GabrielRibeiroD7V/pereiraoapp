// Executado somente no servidor de build de Preview; nunca grava dados financeiros.
import { checkAsaasSandbox } from "../server/asaas.ts";
if (process.env.VERCEL_ENV === "preview") {
  const result = await checkAsaasSandbox(process.env.ASSAS_API_KEY_SANDBOX);
  console.log("PEREIRAO_ASAAS_SANDBOX_DIAGNOSTIC " + JSON.stringify(result));
  // Provisionamento EXPLÍCITO autorizado, não ocorre em builds normais.
  if (
    process.env.ASAAS_SANDBOX_WEBHOOK_PROVISION === "pr17-approved" &&
    process.env.VERCEL_GIT_COMMIT_REF === "feat/asaas-sandbox"
  ) {
    const { provisionSandboxWebhook } =
      await import("./provision-asaas-webhook.mjs");
    try {
      console.log(
        "PEREIRAO_WEBHOOK_PROVISION " +
          JSON.stringify(await provisionSandboxWebhook(process.env)),
      );
    } catch (error) {
      console.log(
        "PEREIRAO_WEBHOOK_PROVISION " +
          JSON.stringify({
            code: /^WEBHOOK_[A-Z_0-9]+$/.test(error?.message ?? "")
              ? error.message
              : "WEBHOOK_PROVISION_FAILED",
          }),
      );
    }
  }
  if (
    process.env.ASAAS_SANDBOX_PREFLIGHT_READ_ONLY === "true" &&
    process.env.VERCEL_GIT_COMMIT_REF === "feat/asaas-sandbox"
  ) {
    const { sandboxReadOnlyPreflight } =
      await import("./preflight-asaas-readonly.mjs");
    console.log(
      "PEREIRAO_ASAAS_READONLY_PREFLIGHT " +
        JSON.stringify(
          await sandboxReadOnlyPreflight(process.env.ASSAS_API_KEY_SANDBOX),
        ),
    );
  }
}
