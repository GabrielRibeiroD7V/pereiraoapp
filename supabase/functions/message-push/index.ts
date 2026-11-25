import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";
import webpush from "npm:web-push@3.6.7";

type PushRequest = {
  recipientId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
};
type Subscription = { endpoint: string; p256dh: string; auth: string };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(503, { error: "configuration_unavailable" });
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: config, error: configError } = await admin.rpc(
    "message_push_config",
  );
  if (
    configError ||
    !config?.publicKey ||
    !config?.privateKey ||
    !config?.webhookSecret
  )
    return json(503, { error: "push_not_configured" });
  if (request.headers.get("x-pereirao-push-secret") !== config.webhookSecret)
    return json(401, { error: "unauthorized" });

  let payload: PushRequest;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  if (!payload.recipientId || !payload.conversationId || !payload.senderName)
    return json(400, { error: "invalid_payload" });

  const { data, error } = await admin.rpc("message_push_targets", {
    target_user: payload.recipientId,
  });
  if (error) return json(500, { error: "subscriptions_unavailable" });
  const subscriptions = (data ?? []) as Subscription[];
  if (!subscriptions.length) return json(200, { delivered: 0 });

  webpush.setVapidDetails(
    "mailto:suporte@pereirao.app",
    config.publicKey,
    config.privateKey,
  );
  const notification = JSON.stringify({
    title: payload.senderName,
    body: payload.body || "Nova mensagem no PEREIRÃO",
    url: `/mensagens/${payload.conversationId}`,
    tag: `conversation-${payload.conversationId}`,
  });
  let delivered = 0;
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          notification,
        );
        delivered++;
      } catch (cause) {
        const statusCode =
          typeof cause === "object" && cause && "statusCode" in cause
            ? Number(cause.statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410)
          await admin.rpc("remove_expired_message_push_endpoint", {
            push_endpoint: subscription.endpoint,
          });
      }
    }),
  );
  return json(200, { delivered });
});
