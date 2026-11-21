import { describe, it, expect, vi } from "vitest";
import { createAdminRepository } from "./repository";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
function fixture(session = true) {
  const client = {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: session ? { access_token: "local-session-fixture" } : null,
        },
        error: null,
      })),
    },
  } as unknown as SupabaseClient<Database>;
  const request = vi.fn(async (_url: unknown, _options: unknown) =>
    Response.json({ data: true }),
  );
  return {
    repo: createAdminRepository(client, request as typeof fetch),
    request,
  };
}
describe("adaptador administrativo", () => {
  it("não chama o servidor sem sessão", async () => {
    const f = fixture(false);
    await expect(f.repo.access()).rejects.toEqual({ code: "AUTH_REQUIRED" });
    expect(f.request).not.toHaveBeenCalled();
  });
  it("envia a sessão apenas ao endpoint local, sem copiar para outro serviço", async () => {
    const f = fixture();
    await f.repo.access();
    expect(f.request).toHaveBeenCalledWith(
      "/api/admin",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer local-session-fixture",
        }),
        body: JSON.stringify({ action: "access" }),
      }),
    );
  });
  it("transmite decisão e estado esperado para revisão atômica", async () => {
    const f = fixture();
    const input = {
      kind: "business" as const,
      target: "00000000-0000-4000-8000-000000009001",
      command: "publish" as const,
      reason: "Perfil revisado",
      expected_state: "draft",
    };
    await f.repo.act(input);
    expect(f.request.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify({ action: "command", input }),
    });
  });
  it("retorna apenas código sanitizado em falha HTTP", async () => {
    const f = fixture();
    f.request.mockResolvedValueOnce(
      Response.json({ code: "FORBIDDEN", details: "private" }, { status: 403 }),
    );
    await expect(f.repo.query("users")).rejects.toEqual({ code: "FORBIDDEN" });
  });
  it("repassa cancelamento à consulta", async () => {
    const f = fixture();
    const signal = new AbortController().signal;
    await f.repo.query("users", { page: 2 }, signal);
    expect(f.request.mock.calls[0]?.[1]).toMatchObject({
      signal,
      body: JSON.stringify({
        action: "query",
        section: "users",
        filters: { page: 2 },
      }),
    });
  });
});
