import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { uploadDirectPostPhoto } from "./directMedia";
import type { Database } from "../lib/database.types";
const bid = "00000000-0000-4000-8000-000000000001",
  pid = "00000000-0000-4000-8000-000000000002",
  id = "00000000-0000-4000-8000-000000000003";
const input = {
  title: "Título técnico",
  description: "Legenda técnica",
  photos: [],
};
describe("envio direto de postagem", () => {
  it("resposta perdida no upload é reconciliada antes de repetir bytes", async () => {
    let finalizations = 0;
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      if (path.includes("prepare_work_post_photo"))
        return new Response(
          JSON.stringify({
            storage_path: `${bid}/posts/${id}.webp`,
            media_state: "pending",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      if (path.includes("finalize_work_post_photo")) {
        finalizations++;
        return finalizations === 1
          ? new Response(
              JSON.stringify({ code: "22023", message: "incomplete" }),
              { status: 400 },
            )
          : new Response(null, { status: 204 });
      }
      expect(path).toContain("/storage/v1/object/business-posts/");
      expect(new Headers(init?.headers).get("x-upsert")).toBe("false");
      return new Response(JSON.stringify({ message: "network failure" }), {
        status: 500,
      });
    });
    const client = createClient<Database>(
      "https://example.supabase.co",
      "public-test",
      {
        global: { fetch },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    await uploadDirectPostPhoto(
      client,
      bid,
      pid,
      id,
      new Blob(["x"], { type: "image/webp" }),
      input,
    );
    expect(finalizations).toBe(2);
    expect(
      fetch.mock.calls.filter(([url]) => String(url).includes("/storage/")),
    ).toHaveLength(1);
  });
  it("metadado já pronto não duplica objeto", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            storage_path: `${bid}/posts/${id}.webp`,
            media_state: "ready",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const client = createClient<Database>(
      "https://example.supabase.co",
      "public-test",
      {
        global: { fetch },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    await uploadDirectPostPhoto(
      client,
      bid,
      pid,
      id,
      new Blob(["x"], { type: "image/webp" }),
      input,
    );
    expect(fetch).toHaveBeenCalledOnce();
  });
});
