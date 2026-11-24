import { timingSafeEqual } from "node:crypto";
import { adminClient } from "./admin-handler.ts";
import {
  boundedJson,
  productionConfig,
  ProductionBillingError,
  ProductionReadProvider,
} from "./production-billing-provider.ts";
import type { ProductionEnv } from "./production-billing-provider.ts";
import { productionStore } from "./production-billing-store.ts";
import {
  productionNotice,
  ProductionReconciler,
} from "./production-billing-service.ts";
const reply = (status: number, code: unknown) =>
  Response.json(code, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const failure = (error: unknown) => {
  const code =
    error instanceof ProductionBillingError ? error.code : "UNAVAILABLE";
  return reply(
    {
      DISABLED: 403,
      SETUP_REQUIRED: 503,
      AUTH_REQUIRED: 401,
      INVALID_INPUT: 400,
      CONFLICT: 409,
      UNAVAILABLE: 503,
      RECONCILIATION_REQUIRED: 503,
    }[code],
    { code },
  );
};
export const productionService = (env: ProductionEnv) =>
  new ProductionReconciler(
    productionStore(env),
    new ProductionReadProvider(env),
  );
export function createProductionWebhook(
  env: ProductionEnv,
  defer: (task: Promise<unknown>) => void,
  factory = productionService,
) {
  return async (request: Request) => {
    if (request.method !== "POST")
      return reply(405, { code: "METHOD_NOT_ALLOWED" });
    try {
      const { token } = productionConfig(env),
        received = request.headers.get("asaas-access-token") ?? "";
      if (
        Buffer.byteLength(received) !== Buffer.byteLength(token) ||
        !timingSafeEqual(Buffer.from(received), Buffer.from(token))
      )
        return reply(401, { code: "AUTH_REQUIRED" });
      if (!request.headers.get("content-type")?.includes("application/json"))
        return reply(400, { code: "INVALID_INPUT" });
      const notice = productionNotice(await boundedJson(request, 65536)),
        service = factory(env);
      const result = await service.store.call<{
        duplicate: boolean;
        retryable: boolean;
      }>("enqueue", notice);
      if (result.retryable)
        defer(service.process(notice.eventId).catch(() => {}));
      return reply(200, { received: true, duplicate: result.duplicate });
    } catch (error) {
      return failure(error);
    }
  };
}
// Operação de leitura/reconciliação manual, nunca de criação. Autenticação normal de admin.
export function createProductionRecovery(
  env: ProductionEnv,
  factory = productionService,
  clientFactory = adminClient,
) {
  return async (request: Request) => {
    if (request.method !== "POST")
      return reply(405, { code: "METHOD_NOT_ALLOWED" });
    try {
      productionConfig(env);
      const authorization = request.headers.get("authorization");
      if (!authorization || !/^Bearer \S+$/.test(authorization))
        return reply(401, { code: "AUTH_REQUIRED" });
      if (
        request.headers.get("origin") &&
        request.headers.get("origin") !== new URL(request.url).origin
      )
        return reply(403, { code: "FORBIDDEN" });
      const client = clientFactory(env, authorization),
        user = await client.auth.getUser();
      if (user.error || !user.data.user)
        return reply(401, { code: "AUTH_REQUIRED" });
      const access = await client.rpc("admin_access");
      if (access.error || access.data !== true)
        return reply(403, { code: "FORBIDDEN" });
      const body = await boundedJson(request, 1024);
      if (Object.keys(body).length !== 1 || body.action !== "reconcile")
        return reply(400, { code: "INVALID_INPUT" });
      return reply(200, await factory(env).retry());
    } catch (error) {
      return failure(error);
    }
  };
}
