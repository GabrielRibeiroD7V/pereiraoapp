// @vitest-environment node
import { expect, it, vi } from "vitest";
import { provisionSandboxWebhook } from "../scripts/provision-asaas-webhook.mjs";
const env = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "feat/asaas-sandbox",
  ASAAS_SANDBOX_WEBHOOK_PROVISION: "pr17-approved",
  ASSAS_API_KEY_SANDBOX: "$aact_hmlg_fixture",
  ASAAS_SANDBOX_WEBHOOK_TOKEN: "a".repeat(96),
};
it.each([
  { ...env, VERCEL_ENV: "production" },
  { ...env, VERCEL_GIT_COMMIT_REF: "main" },
  { ...env, ASAAS_SANDBOX_WEBHOOK_PROVISION: "" },
  { ...env, ASSAS_API_KEY_SANDBOX: "$aact_prod_fixture" },
])("não provisiona fora do opt-in exato", async (e) => {
  const request = vi.fn();
  await expect(provisionSandboxWebhook(e, request)).rejects.toThrow(
    "NOT_AUTHORIZED",
  );
  expect(request).not.toHaveBeenCalled();
});
it("cria somente webhook Sandbox com token independente e projeção sem segredos", async () => {
  const request = vi.fn(async (url, init) =>
    init.method === "GET"
      ? Response.json({ data: [], hasMore: false })
      : Response.json({ id: "whk_fixture", ...JSON.parse(init.body) }),
  );
  const result = await provisionSandboxWebhook(env, request);
  expect(result.state).toBe("created");
  expect(JSON.stringify(result)).not.toContain(env.ASAAS_SANDBOX_WEBHOOK_TOKEN);
  for (const [url, init] of request.mock.calls) {
    expect(url).toMatch(/^https:\/\/api-sandbox\.asaas\.com\/v3\/webhooks/);
    expect(init.redirect).toBe("error");
  }
  const config = JSON.parse(request.mock.calls[1][1].body);
  expect(config.url).toBe(
    "https://yazdjiwaksamizrbqewq.supabase.co/functions/v1/asaas-sandbox-webhook",
  );
  expect(config.authToken).toBe(env.ASAAS_SANDBOX_WEBHOOK_TOKEN);
  expect(config.sendType).toBe("SEQUENTIALLY");
  const existing = vi.fn(async () =>
    Response.json({ data: [{ id: "whk_fixture", ...config }], hasMore: false }),
  );
  expect((await provisionSandboxWebhook(env, existing)).state).toBe("existing");
  expect(existing).toHaveBeenCalledTimes(1);
});
it("não cria sobre listagem incompleta ou identidade de outro webhook", async () => {
  for (const list of [
    { data: [], hasMore: true },
    { data: [{ name: "PEREIRAO PR17 SANDBOX", url: "https://other.test" }] },
  ]) {
    const request = vi.fn(async () => Response.json(list));
    await expect(provisionSandboxWebhook(env, request)).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  }
});
it("resposta perdida de POST não dispara repetição cega nem revela erro bruto", async () => {
  const request = vi.fn(async (url, init) => {
    if (init.method === "GET")
      return Response.json({ data: [], hasMore: false });
    throw Error("PRIVATE");
  });
  await expect(provisionSandboxWebhook(env, request)).rejects.toThrow(
    "WEBHOOK_WRITE_UNCERTAIN_CHECK_LIST_BEFORE_RETRY",
  );
  expect(request).toHaveBeenCalledTimes(2);
});
