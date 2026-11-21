// Executado somente no servidor de build de Preview; nunca grava dados financeiros.
import { checkAsaasSandbox } from "../server/asaas.ts";
if (process.env.VERCEL_ENV === "preview") {
  const result = await checkAsaasSandbox(process.env.ASSAS_API_KEY_SANDBOX);
  console.log("PEREIRAO_ASAAS_SANDBOX_DIAGNOSTIC " + JSON.stringify(result));
}
