import { supportedBillingEvents } from "../server/billing-contracts.ts";
const endpoint =
  "https://yazdjiwaksamizrbqewq.supabase.co/functions/v1/asaas-sandbox-webhook";
const name = "PEREIRAO PR17 SANDBOX";
export async function provisionSandboxWebhook(env, request = fetch) {
  const key = env.ASSAS_API_KEY_SANDBOX;
  const token = env.ASAAS_SANDBOX_WEBHOOK_TOKEN;
  if (
    env.VERCEL_ENV !== "preview" ||
    env.VERCEL_GIT_COMMIT_REF !== "feat/asaas-sandbox" ||
    env.ASAAS_SANDBOX_WEBHOOK_PROVISION !== "pr17-approved" ||
    typeof key !== "string" ||
    !/^\$aact_hmlg_[^\s]+$/.test(key) ||
    typeof token !== "string" ||
    !/^[!-~]{32,255}$/.test(token)
  )
    throw Error("WEBHOOK_PROVISION_NOT_AUTHORIZED");
  const headers = {
    access_token: key,
    "Content-Type": "application/json",
    "User-Agent": "PereiraoWebhookProvision/1.0",
  };
  const get = await request(
    "https://api-sandbox.asaas.com/v3/webhooks?limit=100&offset=0",
    {
      method: "GET",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!get.ok) {
    await get.body?.cancel();
    throw Error("WEBHOOK_LIST_FAILED_" + get.status);
  }
  const list = await get.json();
  if (!Array.isArray(list.data) || list.hasMore === true)
    throw Error("WEBHOOK_LIST_INCOMPLETE");
  const matches = list.data.filter(
    (item) => item.url === endpoint || item.name === name,
  );
  if (
    matches.length > 1 ||
    (matches.length === 1 &&
      (matches[0].url !== endpoint || matches[0].name !== name))
  )
    throw Error("WEBHOOK_IDENTITY_CONFLICT");
  let hook = matches[0],
    state = "existing";
  if (!hook) {
    try {
      const response = await request(
        "https://api-sandbox.asaas.com/v3/webhooks",
        {
          method: "POST",
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            name,
            url: endpoint,
            email: "77badblock@gmail.com",
            authToken: token,
            enabled: true,
            interrupted: false,
            sendType: "SEQUENTIALLY",
            apiVersion: 3,
            events: supportedBillingEvents,
          }),
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw Error("WEBHOOK_CREATE_FAILED_" + response.status);
      }
      hook = await response.json();
      state = "created";
    } catch (error) {
      if (
        error instanceof Error &&
        /^WEBHOOK_CREATE_FAILED_\d+$/.test(error.message)
      )
        throw error;
      throw Error("WEBHOOK_WRITE_UNCERTAIN_CHECK_LIST_BEFORE_RETRY");
    }
  }
  if (typeof hook.id !== "string" || !/^[A-Za-z0-9_-]{3,160}$/.test(hook.id))
    throw Error("WEBHOOK_ID_UNVERIFIED");
  const result = {
    state,
    id: hook.id,
    enabled: hook.enabled === true,
    interrupted: hook.interrupted,
    sendType: hook.sendType,
    eventCount: Array.isArray(hook.events) ? hook.events.length : 0,
    url: hook.url,
  };
  if (
    hook.url !== endpoint ||
    hook.name !== name ||
    hook.enabled !== true ||
    hook.interrupted !== false ||
    hook.sendType !== "SEQUENTIALLY" ||
    !supportedBillingEvents.every((event) => hook.events?.includes(event)) ||
    (hook.authToken && hook.authToken !== token)
  )
    return { ...result, state: "configuration_requires_review" };
  return result;
}
