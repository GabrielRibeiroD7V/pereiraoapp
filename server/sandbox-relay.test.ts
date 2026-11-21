// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createSandboxRelay } from "../supabase/functions/_shared/sandbox-relay.ts";
const token = "a".repeat(96),
  bypass = "b".repeat(64);
const env = {
  ASAAS_SANDBOX_WEBHOOK_TOKEN: token,
  ASAAS_SANDBOX_PREVIEW_BYPASS: bypass,
  ASAAS_SANDBOX_WEBHOOK_RELAY_ENABLED: "true",
};
const url =
  "https://yazdjiwaksamizrbqewq.supabase.co/functions/v1/asaas-sandbox-webhook";
const req = (headers: Record<string, string> = {}, body = "{}") =>
  new Request(url, {
    method: "POST",
    headers: { "asaas-access-token": token, ...headers },
    body,
  });
describe("receptor restrito do webhook Sandbox", () => {
  it("mantém destino fixo e não encaminha cookies, identidade ou bypass do chamador", async () => {
    const upstream = vi.fn(async () => Response.json({ received: true }));
    const response = await createSandboxRelay(
      env,
      upstream,
    )(
      req(
        {
          cookie: "private",
          authorization: "Bearer private",
          "x-vercel-protection-bypass": "attacker",
          "x-target": "https://evil.test",
        },
        '{"id":"evt_test"}',
      ),
    );
    expect(response.status).toBe(200);
    const [target, init] = upstream.mock.calls[0]! as unknown as [
      string,
      RequestInit,
    ];
    expect(target).toBe(
      "https://pereirao-git-feat-asaas-sandbox-77badblock-5101s-projects.vercel.app/api/asaas-webhook",
    );
    expect(init.redirect).toBe("error");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      "asaas-access-token": token,
      "x-vercel-protection-bypass": bypass,
      "User-Agent": "PereiraoSandboxWebhookRelay/1.0",
    });
    expect(new TextDecoder().decode(init.body as Uint8Array)).toBe(
      '{"id":"evt_test"}',
    );
    expect(await response.text()).not.toContain(token);
  });
  it.each(["", "wrong", "a".repeat(256)])(
    "rejeita token inadequado antes de encaminhar",
    async (value) => {
      const upstream = vi.fn();
      expect(
        (
          await createSandboxRelay(
            env,
            upstream,
          )(req({ "asaas-access-token": value }))
        ).status,
      ).toBe(401);
      expect(upstream).not.toHaveBeenCalled();
    },
  );
  it.each([
    {},
    { ...env, ASAAS_SANDBOX_WEBHOOK_RELAY_ENABLED: "false" },
    { ...env, ASAAS_SANDBOX_PREVIEW_BYPASS: token },
  ])("falha fechado sem setup ou com segredos iguais", async (value) => {
    const upstream = vi.fn();
    expect((await createSandboxRelay(value, upstream)(req())).status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("não oferece outras rotas ou métodos", async () => {
    const upstream = vi.fn();
    const handler = createSandboxRelay(env, upstream);
    expect(
      (await handler(new Request(url + "/admin", { method: "POST" }))).status,
    ).toBe(404);
    expect((await handler(new Request(url))).status).toBe(405);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("limita o corpo inclusive sem Content-Length", async () => {
    const upstream = vi.fn();
    expect(
      (await createSandboxRelay(env, upstream)(req({}, "x".repeat(65537))))
        .status,
    ).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });
  it.each([401, 403, 500, 503])(
    "não confirma entrega se upstream responde %s",
    async (status) => {
      const response = await createSandboxRelay(
        env,
        async () => new Response("PRIVATE", { status }),
      )(req());
      expect(response.status).toBe(502);
      expect(await response.text()).not.toContain("PRIVATE");
    },
  );
  it.each(["<html>Vercel Authentication</html>", '{"ok":true}'])(
    "não transforma resposta desconhecida em ACK",
    async (body) => {
      expect(
        (await createSandboxRelay(env, async () => new Response(body))(req()))
          .status,
      ).toBe(502);
    },
  );
  it("preserva rejeição de evento malformado", async () => {
    expect(
      (
        await createSandboxRelay(
          env,
          async () => new Response("PRIVATE", { status: 400 }),
        )(req())
      ).status,
    ).toBe(400);
  });
  it("reconhece somente a projeção de evento ignorado", async () => {
    expect(
      await (
        await createSandboxRelay(env, async () =>
          Response.json({ ignored: true }),
        )(req())
      ).json(),
    ).toEqual({ ignored: true });
  });
  it("mantém falha de rede recuperável sem expor dados", async () => {
    const response = await createSandboxRelay(env, async () => {
      throw Error("PRIVATE");
    })(req());
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).not.toContain("PRIVATE");
  });
});
