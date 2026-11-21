import { timingSafeEqual } from "node:crypto";
import { adminClient } from "./admin-handler.ts";
import { SandboxProvider, ProviderError } from "./sandbox-provider.ts";
import {
  makeSandboxStore,
  sandboxEnabled,
  BillingError,
} from "./sandbox-store.ts";
import type { SandboxEnv } from "./sandbox-store.ts";
import { SandboxService, overviewView } from "./sandbox-service.ts";
import type { SandboxOverview } from "./sandbox-service.ts";
import { billingNotice } from "./billing-contracts.ts";
import { validId } from "../src/lib/mediaPath.ts";
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
function errorReply(e: unknown) {
  const code =
    e instanceof BillingError || e instanceof ProviderError
      ? e.code
      : "UNAVAILABLE";
  return reply(
    code === "FORBIDDEN"
      ? 403
      : code === "AUTH_REQUIRED"
        ? 401
        : code === "INVALID_INPUT"
          ? 400
          : code === "CONFLICT"
            ? 409
            : code === "SETUP_REQUIRED" ||
                code === "SANDBOX_DISABLED" ||
                code === "PIX_NOT_VALIDATED"
              ? 503
              : 502,
    { code },
  );
}
async function body(request: Request, max = 32768) {
  if (Number(request.headers.get("content-length") ?? 0) > max)
    throw new BillingError("INVALID_INPUT");
  const reader = request.body?.getReader();
  if (!reader) throw new BillingError("INVALID_INPUT");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    size += r.value.length;
    if (size > max) {
      await reader.cancel();
      throw new BillingError("INVALID_INPUT");
    }
    chunks.push(r.value);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new BillingError("INVALID_INPUT");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BillingError("INVALID_INPUT");
  return value as Record<string, unknown>;
}
export const serviceFor = (env: SandboxEnv) =>
  new SandboxService(
    makeSandboxStore(env),
    new SandboxProvider(env.ASSAS_API_KEY_SANDBOX ?? ""),
  );
export function createSandboxBillingHandler(
  env: SandboxEnv,
  clientFactory = adminClient,
  serviceFactory = serviceFor,
) {
  return async (request: Request) => {
    if (request.method !== "POST")
      return reply(405, { code: "METHOD_NOT_ALLOWED" });
    if (!sandboxEnabled(env)) return reply(403, { code: "SANDBOX_DISABLED" });
    if (
      env.VITE_SUPABASE_URL !== "https://yazdjiwaksamizrbqewq.supabase.co" ||
      !env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")
    )
      return reply(503, { code: "SETUP_REQUIRED" });
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      return reply(403, { code: "FORBIDDEN" });
    const authorization = request.headers.get("authorization");
    if (!authorization || !/^Bearer \S+$/.test(authorization))
      return reply(401, { code: "AUTH_REQUIRED" });
    try {
      const client = clientFactory(env, authorization),
        user = await client.auth.getUser();
      if (user.error || !user.data.user)
        throw new BillingError("AUTH_REQUIRED");
      const uid = user.data.user.id,
        input = await body(request);
      const action = input.action;
      const allowed: Record<string, string[]> = {
        overview: ["action", "businessId"],
        start: [
          "action",
          "businessId",
          "requestId",
          "method",
          "accepted",
          "amountCents",
          "termsVersion",
        ],
        reconcile: ["action", "requestId"],
        cancel: ["action", "requestId", "confirmed"],
        admin: ["action"],
        retry: ["action"],
        refund: ["action", "requestId", "paymentId", "confirmed"],
      };
      if (
        typeof action !== "string" ||
        !allowed[action] ||
        Object.keys(input).some((key) => !allowed[action]!.includes(key))
      )
        throw new BillingError("INVALID_INPUT");
      if (
        ["overview", "start"].includes(action) &&
        !validId(String(input.businessId))
      )
        throw new BillingError("INVALID_INPUT");
      if (
        ["start", "reconcile", "cancel", "refund"].includes(action) &&
        !validId(String(input.requestId))
      )
        throw new BillingError("INVALID_INPUT");
      if (
        action === "start" &&
        input.method === "PIX" &&
        env.ASAAS_SANDBOX_PIX_VERIFIED !== "true"
      )
        throw new BillingError("PIX_NOT_VALIDATED");
      const service = serviceFactory(env);
      if (action === "overview")
        return reply(200, {
          data: overviewView(
            await service.store.call<SandboxOverview>("owner_overview", {
              userId: uid,
              businessId: input.businessId,
            }),
          ),
          environment: "sandbox",
        });
      if (action === "start") {
        if (
          input.accepted !== true ||
          input.amountCents !== 1999 ||
          input.termsVersion !== "sandbox-v1" ||
          !["PIX", "CREDIT_CARD"].includes(String(input.method))
        )
          throw new BillingError("INVALID_INPUT");
        const origin = new URL(request.url).origin;
        const url =
          origin + "/conta/profissional/" + input.businessId + "/assinatura";
        return reply(200, {
          data: await service.start(
            uid,
            String(input.businessId),
            String(input.requestId),
            input.method as "PIX" | "CREDIT_CARD",
            url,
          ),
          environment: "sandbox",
        });
      }
      if (action === "reconcile") {
        await service.reconcileContract(String(input.requestId), uid);
        return reply(200, { data: { ok: true } });
      }
      if (action === "cancel") {
        if (input.confirmed !== true) throw new BillingError("INVALID_INPUT");
        await service.cancel(uid, String(input.requestId));
        return reply(200, { data: { ok: true } });
      }
      if (action === "admin")
        return reply(200, {
          data: overviewView(
            await service.store.call<SandboxOverview>("admin_overview", {
              userId: uid,
            }),
          ),
          environment: "sandbox",
        });
      if (action === "retry")
        return reply(200, { data: await service.retryEvents(uid) });
      if (action === "refund") {
        if (
          input.confirmed !== true ||
          typeof input.paymentId !== "string" ||
          !/^pay_[A-Za-z0-9_-]+$/.test(input.paymentId)
        )
          throw new BillingError("INVALID_INPUT");
        await service.refund(uid, String(input.requestId), input.paymentId);
        return reply(200, { data: { ok: true } });
      }
      throw new BillingError("INVALID_INPUT");
    } catch (e) {
      return errorReply(e);
    }
  };
}
export function webhookAuthorized(
  expected: string | undefined,
  received: string | null,
) {
  if (
    !expected ||
    expected.length < 32 ||
    expected.length > 255 ||
    /\s/.test(expected) ||
    !received ||
    received.length > 255 ||
    Buffer.byteLength(received) !== Buffer.byteLength(expected)
  )
    return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
export function createSandboxWebhookHandler(
  env: SandboxEnv,
  defer: (task: Promise<unknown>) => void,
  serviceFactory = serviceFor,
) {
  return async (request: Request) => {
    if (request.method !== "POST")
      return reply(405, { code: "METHOD_NOT_ALLOWED" });
    if (!sandboxEnabled(env)) return reply(403, { code: "SANDBOX_DISABLED" });
    if (
      !webhookAuthorized(
        env.ASAAS_SANDBOX_WEBHOOK_TOKEN,
        request.headers.get("asaas-access-token"),
      )
    )
      return reply(401, { code: "AUTH_REQUIRED" });
    try {
      const input = await body(request, 65536),
        notice = billingNotice(input);
      if (!notice) return reply(200, { ignored: true });
      const service = serviceFactory(env);
      await service.store.call("enqueue", notice);
      // Acknowledge somente após persistência. Falhas de processamento permanecem na inbox.
      defer(service.processEvent(notice.eventId).catch(() => {}));
      return reply(200, { received: true });
    } catch (e) {
      return errorReply(e);
    }
  };
}
