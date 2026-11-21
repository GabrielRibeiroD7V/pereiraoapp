// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { checkAsaasSandbox } from "./asaas";
import { createAdminHandler, adminClient } from "./admin-handler";
const env = {
  VITE_SUPABASE_URL: "https://yazdjiwaksamizrbqewq.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_test",
  ASSAS_API_KEY_SANDBOX: "$aact_hmlg_local_test",
};
function fixture(allowed = true) {
  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-test" } },
        error: null,
      })),
    },
    rpc: vi.fn(async (name: string) =>
      name === "admin_access"
        ? { data: allowed, error: null }
        : { data: { items: [], hasNext: false }, error: null },
    ),
    storage: { from: vi.fn() },
  };
  const probe = vi.fn(async () => ({
    state: "connected" as const,
    httpStatus: 200,
    checkedAt: "2026-11-20T00:00:00Z",
  }));
  const create = vi.fn(
    () => client as unknown as ReturnType<typeof adminClient>,
  );
  return {
    client,
    probe,
    create,
    handler: createAdminHandler(env, create, probe),
  };
}
function req(
  body: unknown = { action: "access" },
  headers: Record<string, string> = { Authorization: "Bearer local-token" },
) {
  return new Request("https://preview.example/api/admin", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
describe("diagnóstico Asaas exclusivamente de servidor", () => {
  it.each([undefined, "$aact_prod_local", "legacy-local", " $aact_hmlg_bad"])(
    "não transmite chave ausente ou de ambiente incorreto: %s",
    async (key) => {
      const request = vi.fn();
      const result = await checkAsaasSandbox(key, request);
      expect(result.state).toBe(key ? "not_validated" : "missing");
      expect(request).not.toHaveBeenCalled();
    },
  );
  it("executa somente GET no sandbox e descarta o corpo", async () => {
    const cancel = vi.fn();
    const request = vi.fn(
      async (_url: unknown, _options: unknown) =>
        ({
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          body: { cancel },
        }) as unknown as Response,
    );
    const result = await checkAsaasSandbox(
      env.ASSAS_API_KEY_SANDBOX,
      request as typeof fetch,
    );
    expect(result.state).toBe("connected");
    expect(cancel).toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("local_test");
    expect(request.mock.calls[0]?.[0]).toBe(
      "https://api-sandbox.asaas.com/v3/customers?limit=1&offset=0",
    );
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      redirect: "error",
    });
  });
  it.each([401, 403, 429, 500])(
    "sanitiza HTTP %s sem devolver mensagem do fornecedor",
    async (status) => {
      const result = await checkAsaasSandbox(
        env.ASSAS_API_KEY_SANDBOX,
        vi.fn(
          async () => new Response("dados privados", { status }),
        ) as typeof fetch,
      );
      expect(result.state).toBe(
        status < 404 ? "invalid" : "communication_error",
      );
      expect(result.httpStatus).toBe(status);
      expect(JSON.stringify(result)).not.toContain("privados");
    },
  );
  it("trata timeout e exceções sem registrar segredos", async () => {
    expect(
      (
        await checkAsaasSandbox(
          env.ASSAS_API_KEY_SANDBOX,
          vi.fn(async () => {
            throw Error("private-key");
          }),
        )
      ).state,
    ).toBe("communication_error");
  });
});
describe("API administrativa", () => {
  it("nega acesso sem sessão antes de consultar o banco", async () => {
    const f = fixture();
    expect((await f.handler(req({}, {}))).status).toBe(401);
    expect(f.create).not.toHaveBeenCalled();
  });
  it("nega usuário comum e não verifica Asaas", async () => {
    const f = fixture(false);
    expect((await f.handler(req({ action: "sandbox" }))).status).toBe(403);
    expect(f.probe).not.toHaveBeenCalled();
  });
  it("verifica a sessão no Auth, não apenas a existência de bearer", async () => {
    const f = fixture();
    f.client.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: {},
    } as never);
    expect((await f.handler(req())).status).toBe(401);
    expect(f.client.rpc).not.toHaveBeenCalled();
  });
  it("verifica autorização no banco a cada requisição", async () => {
    const f = fixture();
    const r = await f.handler(req({ action: "sandbox" }));
    expect(r.status).toBe(200);
    expect(f.client.rpc).toHaveBeenCalledWith("admin_access");
    expect(f.probe).toHaveBeenCalledWith(env.ASSAS_API_KEY_SANDBOX);
    expect(await r.json()).toEqual({
      data: {
        state: "connected",
        httpStatus: 200,
        checkedAt: "2026-11-20T00:00:00Z",
      },
    });
    expect(r.headers.get("cache-control")).toContain("no-store");
  });
  it("não aceita chamadas de outra origem", async () => {
    const f = fixture();
    expect(
      (
        await f.handler(
          req(
            {},
            { Authorization: "Bearer local", Origin: "https://other.example" },
          ),
        )
      ).status,
    ).toBe(403);
    expect(f.create).not.toHaveBeenCalled();
  });
  it("não aceita GET nem outro projeto", async () => {
    const f = fixture();
    expect(
      (await f.handler(new Request("https://preview.example/api/admin")))
        .status,
    ).toBe(405);
    const other = createAdminHandler(
      { ...env, VITE_SUPABASE_URL: "https://other.supabase.co" },
      f.create,
    );
    expect((await other(req())).status).toBe(503);
    expect(f.create).not.toHaveBeenCalled();
  });
  it("retorna ativação pendente sem expor erro SQL", async () => {
    const f = fixture();
    f.client.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST202", message: "private details" },
    } as never);
    const r = await f.handler(req());
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ code: "SETUP_REQUIRED" });
  });
  it("encaminha somente consultas conhecidas à RPC", async () => {
    const f = fixture();
    expect(
      (
        await f.handler(
          req({ action: "query", section: "users", filters: { page: 2 } }),
        )
      ).status,
    ).toBe(200);
    expect(f.client.rpc).toHaveBeenLastCalledWith("admin_query", {
      section: "users",
      filters: { page: 2 },
    });
    expect(
      (await f.handler(req({ action: "query", section: "auth.users" }))).status,
    ).toBe(400);
  });
  it("recusa corpo excessivo, inválido e caminho de outro negócio", async () => {
    const f = fixture();
    expect(
      (await f.handler(req({ action: "x", x: "x".repeat(8192) }))).status,
    ).toBe(413);
    expect((await f.handler(req(null))).status).toBe(400);
    expect(
      (
        await f.handler(
          req({
            action: "image",
            businessId: "00000000-0000-4000-8000-000000000001",
            path: "other/portfolio/p.webp",
          }),
        )
      ).status,
    ).toBe(400);
  });
  it("trata decisão obsoleta e perfil incompleto com diagnóstico sanitizado", async () => {
    for (const [code, status] of [
      ["40001", 409],
      ["23514", 422],
    ] as const) {
      const f = fixture();
      f.client.rpc
        .mockResolvedValueOnce({ data: true, error: null } as never)
        .mockResolvedValueOnce({
          data: null,
          error: { code, message: "private details" },
        } as never);
      const r = await f.handler(
        req({
          action: "command",
          input: {
            kind: "business",
            target: "00000000-0000-4000-8000-000000000001",
            command: "publish",
            reason: "Revisado localmente",
            expected_state: "draft",
          },
        }),
      );
      expect(r.status).toBe(status);
      expect(JSON.stringify(await r.json())).not.toContain("private details");
    }
  });
});
