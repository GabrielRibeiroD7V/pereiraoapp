// Diagnóstico GET padrão. Ensaio sintético requer opt-in explícito por Preview/branch.
import { checkAsaasSandbox } from "../server/asaas.ts";
if (process.env.VERCEL_ENV === "preview") {
  const result = await checkAsaasSandbox(process.env.ASSAS_API_KEY_SANDBOX);
  console.log("PEREIRAO_ASAAS_SANDBOX_DIAGNOSTIC " + JSON.stringify(result));
  if (process.env.ASAAS_SANDBOX_SMOKE_RUN) {
    process.argv[2] = process.env.ASAAS_SANDBOX_SMOKE_RUN;
    await import("./smoke-asaas-sandbox.mjs");
  }
}
