import { createSandboxRelay } from "../_shared/sandbox-relay.ts";

// verify_jwt=false somente neste webhook: autenticação própria antes de ler/encaminhar o body.
Deno.serve(
  createSandboxRelay({
    ASAAS_SANDBOX_WEBHOOK_TOKEN: Deno.env.get("ASAAS_SANDBOX_WEBHOOK_TOKEN"),
    ASAAS_SANDBOX_PREVIEW_BYPASS: Deno.env.get("ASAAS_SANDBOX_PREVIEW_BYPASS"),
    ASAAS_SANDBOX_WEBHOOK_RELAY_ENABLED: Deno.env.get(
      "ASAAS_SANDBOX_WEBHOOK_RELAY_ENABLED",
    ),
  }),
);
