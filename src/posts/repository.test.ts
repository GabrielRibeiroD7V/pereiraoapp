import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../lib/database.types";
import { createManagedPosts, createPublicPosts } from "./repository";
import { fixtureBusinessId as bid } from "../test/workFixtures";
import {
  fixturePostId as pid,
  fixturePostPhotos as photos,
} from "../test/postsFixtures";
function setup(
  options: {
    member?: boolean;
    missing?: boolean;
    error?: boolean;
    rows?: unknown;
    rpcFail?: boolean;
  } = {},
) {
  const calls: { url: URL; method: string; body: unknown }[] = [];
  const client = createClient<Database>(
    "https://yazdjiwaksamizrbqewq.supabase.co",
    "sb_publishable_fixture",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: crypto.randomUUID(),
      },
      global: {
        fetch: async (input, init) => {
          const url = new URL(String(input)),
            method = init?.method ?? "GET",
            body =
              typeof init?.body === "string" ? JSON.parse(init.body) : null;
          calls.push({ url, method, body });
          let result: unknown = [],
            status = 200;
          if (url.pathname.endsWith("/business_members"))
            result = options.member === false ? [] : [{ id: "owner" }];
          else if (url.pathname.includes("/rpc/")) {
            result = options.rpcFail
              ? { code: "23514", message: "not publishable" }
              : { id: pid, status: "draft" };
            status = options.rpcFail ? 400 : 200;
          } else if (options.missing) {
            result = { code: "PGRST205", message: "schema not ready" };
            status = 404;
          } else if (options.error) {
            result = { code: "400", message: "unavailable" };
            status = 400;
          } else if (url.pathname.endsWith("/work_posts"))
            result = options.rows ?? [];
          return new Response(JSON.stringify(result), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        },
      },
    },
  );
  vi.spyOn(client.auth, "getUser").mockResolvedValue({
    data: {
      user: {
        id: "verified-user",
        aud: "authenticated",
        created_at: "",
        user_metadata: {},
        app_metadata: {},
      },
    },
    error: null,
  });
  return {
    managed: createManagedPosts(client),
    publicPosts: createPublicPosts(client),
    calls,
  };
}
describe("publicações: SDK real com transporte interceptado", () => {
  it("bloqueia gravação sem gerente ou antes da migração", async () => {
    for (const options of [{ member: false }, { missing: true }]) {
      const { managed, calls } = setup(options);
      await expect(
        managed.save(bid, pid, {
          title: "Trabalho",
          description: "",
          photos: [],
        }),
      ).rejects.toBeDefined();
      expect(calls.every((c) => c.method === "GET")).toBe(true);
    }
  });
  it("usa ID estável e envia somente campos de conteúdo à RPC transacional", async () => {
    const { managed, calls } = setup();
    const input = { title: " Trabalho ", description: "Descrição", photos };
    await managed.save(bid, pid, input);
    await managed.save(bid, pid, input);
    const writes = calls.filter((c) => c.method === "POST");
    expect(writes).toHaveLength(2);
    expect(writes[0]?.body).toEqual({
      command: "save",
      target_business: bid,
      target_post: pid,
      post_title: "Trabalho",
      post_description: "Descrição",
      photo_ids: photos.map((p) => p.id),
    });
    expect(writes[1]?.body).toEqual(writes[0]?.body);
    expect(
      writes.every((c) => c.url.pathname.endsWith("/rpc/work_post_command")),
    ).toBe(true);
  });
  it("não tenta publicar o negócio nem remover arquivos quando a publicação falha", async () => {
    const { managed, calls } = setup({ rpcFail: true });
    await expect(managed.command(bid, pid, "publish")).rejects.toMatchObject({
      code: "23514",
    });
    expect(
      calls
        .filter((c) => c.method !== "GET")
        .every((c) => c.url.pathname.endsWith("/rpc/work_post_command")),
    ).toBe(true);
  });
  it("exclui só pelo comando de publicação e não chama Storage", async () => {
    const { managed, calls } = setup();
    await managed.command(bid, pid, "delete");
    expect(calls.some((c) => c.url.pathname.includes("/storage/"))).toBe(false);
    expect(calls.at(-1)?.body).toEqual({
      command: "delete",
      target_business: bid,
      target_post: pid,
    });
  });
  it("suprime seção pública somente para ausência conhecida de tabela", async () => {
    expect(await setup({ missing: true }).publicPosts.list()).toBeNull();
    await expect(
      setup({ error: true }).publicPosts.list(),
    ).rejects.toBeDefined();
  });
  it("mantém microssegundos no cursor e limita resultado e capa no servidor", async () => {
    const { publicPosts, calls } = setup();
    const cursor = { publishedAt: "2026-11-20T21:00:00.123456+00:00", id: pid };
    await publicPosts.list(cursor, bid);
    const q = calls[0]!.url.searchParams;
    expect(q.get("or")).toContain(".123456+00:00");
    expect(q.get("status")).toBe("eq.published");
    expect(q.get("business.status")).toBe("eq.published");
    expect(q.get("business_id")).toBe(`eq.${bid}`);
    expect(q.get("limit")).toBe("7");
    expect(q.get("images.limit")).toBe("1");
    expect(q.get("select")).not.toMatch(/user_id|tax_id|\*/);
  });
  it("rejeita cursores maliciosos e IDs inválidos antes de consultar", async () => {
    const { publicPosts, calls } = setup();
    await expect(
      publicPosts.list({ publishedAt: "x),status.eq.draft", id: pid }),
    ).rejects.toBeDefined();
    expect(await publicPosts.get("../secret")).toBeNull();
    expect(calls).toHaveLength(0);
  });
  it("retorna seis itens, cursor da última linha exibida e somente dados públicos", async () => {
    const rows = Array.from({ length: 7 }, (_, n) => ({
      id: pid.slice(0, -1) + n,
      business_id: bid,
      title: "Título",
      description: "Descrição",
      published_at: "2026-11-20T21:00:00.123456+00:00",
      owner_id: "never-expose",
      images: [],
      business: {
        id: bid,
        name: "Negócio público simulado",
        slug: "simulado",
        avatar_path: null,
        city: { name: "Mundo Novo", state_code: "MS" },
        category: { name: "Climatização" },
      },
    }));
    const { publicPosts } = setup({ rows });
    const page = await publicPosts.list();
    expect(page?.items).toHaveLength(6);
    expect(page?.next?.id).toBe(rows[5]?.id);
    expect(page?.items[0]).not.toHaveProperty("owner_id");
    expect(page?.items[0]?.business).not.toHaveProperty("user_id");
  });
  it("rejeita seleção repetida e acima de seis imagens antes da escrita", async () => {
    const { managed, calls } = setup();
    await expect(
      managed.save(bid, pid, {
        title: "Trabalho",
        description: "",
        photos: [photos[0]!, photos[0]!],
      }),
    ).rejects.toBeDefined();
    expect(calls).toHaveLength(0);
  });
});
