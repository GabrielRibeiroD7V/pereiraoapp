import { createOneoffSandboxRelay } from '../_shared/oneoff-sandbox-relay.ts';
// Deploy separately only after the endpoint/secret preflight. Disabled without its own flag.
// This function alone needs verify_jwt=false: Asaas uses the authenticated webhook header.
Deno.serve(createOneoffSandboxRelay({
 ASAAS_ADMIN_ONEOFF_SANDBOX_RELAY_ENABLED: Deno.env.get('ASAAS_ADMIN_ONEOFF_SANDBOX_RELAY_ENABLED'),
 ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN: Deno.env.get('ASAAS_ADMIN_ONEOFF_SANDBOX_WEBHOOK_TOKEN'),
 ASAAS_ADMIN_ONEOFF_SANDBOX_PREVIEW_BYPASS: Deno.env.get('ASAAS_ADMIN_ONEOFF_SANDBOX_PREVIEW_BYPASS'),
 ASAAS_SANDBOX_WEBHOOK_TOKEN: Deno.env.get('ASAAS_SANDBOX_WEBHOOK_TOKEN'),
}));
