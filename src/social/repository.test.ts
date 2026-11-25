import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { createSocialRepository } from "./repository";
const pid = "00000000-0000-4000-8000-000000000111",
  iid = "00000000-0000-4000-8000-000000000112",
  uid = "00000000-0000-4000-8000-000000000113";
function setup(uploadFails = false) {
  const calls: {
    path: string;
    body: Record<string, unknown>;
    method: string;
  }[] = [];
  let finalized = false;
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
          const path = new URL(String(input)).pathname,
            body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
          calls.push({ path, body, method: init?.method ?? "GET" });
          let result: unknown = {},
            status = 200;
          if (path.endsWith("/personal_post_command")) {
            if (body.command === "prepare")
              result = {
                path: `${uid}/posts/${iid}.webp`,
                mediaState: finalized ? "ready" : "pending",
              };
            if (body.command === "finalize") finalized = true;
            if (body.command === "delete")
              result = { paths: [`${uid}/posts/${iid}.webp`] };
          } else if (path.endsWith("/publication_feed"))
            result = { items: [], hasNext: false };
          else if (path.includes("/storage/v1/object/") && uploadFails) {
            status = 400;
            result = {
              message: "Upload response lost or duplicate",
              statusCode: 400,
            };
          }
          return new Response(JSON.stringify(result), {
            status,
            headers: { "content-type": "application/json" },
          });
        },
      },
    },
  );
  return { repo: createSocialRepository(client), calls };
}
describe("personal SDK transport with synthetic responses", () => {
  it("lost upload response finalizes same ID; retry never sends a second object", async () => {
    const f = setup(true),
      input = {
        title: "Local only",
        description: "",
        images: [
          {
            id: iid,
            path: "",
            bucket: "personal-posts" as const,
            blob: new Blob(["synthetic"], { type: "image/webp" }),
          },
        ],
      };
    await f.repo.save(pid, input);
    await f.repo.save(pid, input);
    expect(
      f.calls.filter((c) => c.path.includes("/storage/v1/object/")),
    ).toHaveLength(1);
    expect(
      f.calls
        .filter((c) => c.body.command === "prepare")
        .every(
          (c) =>
            c.body.target_post === pid &&
            (c.body.data as { photoId: string }).photoId === iid,
        ),
    ).toBe(true);
    expect(f.calls.filter((c) => c.body.command === "save")).toHaveLength(2);
  });
  it("native unsupported file never reaches RPC", async () => {
    const f = setup();
    await expect(
      f.repo.save(pid, {
        title: "",
        description: "",
        images: [
          {
            id: iid,
            path: "",
            bucket: "personal-posts",
            blob: new Blob(["x"], { type: "image/heic" }),
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "22023" });
    expect(f.calls).toHaveLength(0);
  });
  it("feed sends only public cursor/author parameters, no owner flag", async () => {
    const f = setup();
    await f.repo.feed(
      { time: "2026-11-20T00:00:00Z", id: pid, kind: "personal" },
      uid,
    );
    expect(f.calls[0]?.body).toEqual({
      before_time: "2026-11-20T00:00:00Z",
      before_id: pid,
      before_kind: "personal",
      author_filter: uid,
    });
  });
});
