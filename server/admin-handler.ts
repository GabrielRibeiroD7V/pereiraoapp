import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../src/lib/database.types.ts";
import { checkAsaasSandbox } from "./asaas.ts";
import { imageBucket, validId } from "../src/lib/mediaPath.ts";
type Env = Record<string, string | undefined>;
export const adminClient = (env: Env, authorization: string) =>
  createClient<Database>(
    "https://yazdjiwaksamizrbqewq.supabase.co",
    env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: authorization } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
function reply(status: number, value: unknown) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Authorization",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
function rpcFailure(code: string) {
  if (["PGRST202", "42883", "42P01", "PGRST205", "55000"].includes(code))
    return reply(503, { code: "SETUP_REQUIRED" });
  if (code === "42501") return reply(403, { code: "FORBIDDEN" });
  if (code === "40001") return reply(409, { code: "CONFLICT" });
  if (code === "23514") return reply(422, { code: "INCOMPLETE" });
  if (["22023", "22P02", "22007", "22008"].includes(code))
    return reply(400, { code: "INVALID_INPUT" });
  if (code === "P0002") return reply(404, { code: "NOT_FOUND" });
  return reply(502, { code: "UNAVAILABLE" });
}
export function createAdminHandler(
  env: Env,
  clientFactory = adminClient,
  probe = checkAsaasSandbox,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST")
      return reply(405, { code: "METHOD_NOT_ALLOWED" });
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      return reply(403, { code: "FORBIDDEN" });
    const authorization = request.headers.get("authorization");
    if (!authorization || !/^Bearer [^\s]+$/.test(authorization))
      return reply(401, { code: "AUTH_REQUIRED" });
    if (
      !env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_") ||
      env.VITE_SUPABASE_URL !== "https://yazdjiwaksamizrbqewq.supabase.co"
    )
      return reply(503, { code: "SETUP_REQUIRED" });
    try {
      const client = clientFactory(env, authorization);
      const user = await client.auth.getUser();
      if (user.error || !user.data.user)
        return reply(401, { code: "AUTH_REQUIRED" });
      const access = await client.rpc("admin_access");
      if (access.error) return rpcFailure(access.error.code);
      if (!access.data) return reply(403, { code: "FORBIDDEN" });
      const content = await request.text();
      if (content.length > 8192) return reply(413, { code: "INVALID_INPUT" });
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(content);
      } catch {
        return reply(400, { code: "INVALID_INPUT" });
      }
      if (!body || typeof body !== "object" || Array.isArray(body))
        return reply(400, { code: "INVALID_INPUT" });
      if (body.action === "access") return reply(200, { data: true });
      if (body.action === "sandbox")
        return reply(200, { data: await probe(env.ASSAS_API_KEY_SANDBOX) });
      if (body.action === "query") {
        if (
          typeof body.section !== "string" ||
          ![
            "dashboard",
            "users",
            "businesses",
            "posts",
            "audit",
            "detail",
            "subscriptions",
          ].includes(body.section)
        )
          return reply(400, { code: "INVALID_INPUT" });
        const filters = body.filters ?? {};
        if (
          typeof filters !== "object" ||
          filters === null ||
          Array.isArray(filters)
        )
          return reply(400, { code: "INVALID_INPUT" });
        const result =
          body.section === "subscriptions"
            ? await client.rpc("admin_subscription_overview", {
                filters: filters as Json,
              })
            : await client.rpc("admin_query", {
                section: body.section,
                filters: filters as Json,
              });
        if (body.section === 'detail' && !result.error && result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
          const target = (filters as Record<string, unknown>).id;
          if (typeof target !== 'string' || !validId(target)) return reply(400, { code: 'INVALID_INPUT' });
          const photo = await client.rpc('admin_profile_photo', { target_business: target });
          if (photo.error && !['PGRST202','42883'].includes(photo.error.code)) return rpcFailure(photo.error.code);
          return reply(200, { data: { ...result.data, profilePhoto: photo.error ? null : photo.data } });
        }
        return result.error
          ? rpcFailure(result.error.code)
          : reply(200, { data: result.data });
      }
      if (body.action === "command") {
        const input = body.input as Record<string, unknown> | null;
        if (
          !input ||
          typeof input !== "object" ||
          !["kind", "target", "command", "reason", "expected_state"].every(
            (k) => typeof input[k] === "string",
          ) ||
          !validId(String(input.target)) ||
          String(input.reason).trim().length < 5 ||
          String(input.reason).length > 500
        )
          return reply(400, { code: "INVALID_INPUT" });
        const result = await client.rpc("admin_action", {
          kind: String(input.kind),
          target: String(input.target),
          command: String(input.command),
          reason: String(input.reason),
          expected_state: String(input.expected_state),
        });
        return result.error
          ? rpcFailure(result.error.code)
          : reply(200, { data: result.data });
      }
      if (body.action === "image") {
        const id = String(body.businessId ?? ""),
          path = String(body.path ?? "");
        const bucket = imageBucket(id, path);
        if (!validId(id) || !bucket)
          return reply(400, { code: "INVALID_INPUT" });
        const result = await client.storage
          .from(bucket)
          .createSignedUrl(path, 60);
        if (result.error) return reply(404, { code: "NOT_FOUND" });
        const url = new URL(result.data.signedUrl);
        if (
          url.origin !== "https://yazdjiwaksamizrbqewq.supabase.co" ||
          url.pathname !==
            `/storage/v1/object/sign/${bucket}/` + path ||
          url.username ||
          url.password ||
          url.hash
        )
          return reply(502, { code: "UNAVAILABLE" });
        return reply(200, { data: result.data.signedUrl });
      }
      return reply(400, { code: "INVALID_INPUT" });
    } catch {
      return reply(502, { code: "UNAVAILABLE" });
    }
  };
}
