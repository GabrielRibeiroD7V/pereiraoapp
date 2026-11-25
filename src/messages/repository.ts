import { supabase } from "../lib/supabase";

export interface Conversation {
  id: string;
  kind?: "business" | "account";
  businessId: string;
  businessName: string;
  businessSlug: string;
  businessAvatarPath?: string | null;
  customerName: string;
  customerAvatarUrl?: string | null;
  side: "customer" | "professional" | "account";
  peerId?: string;
  peerName?: string;
  peerAvatarUrl?: string | null;
  updatedAt: string;
  lastMessage: string;
  unreadCount?: number;
}
export interface ChatMessage {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
}
export interface MessagePage {
  items: ChatMessage[];
  hasMore: boolean;
  customerId: string;
}
export interface MessageTarget {
  id: string;
  name: string;
  kind: "business" | "account";
  slug?: string;
  businessAvatarPath?: string | null;
  avatarUrl?: string | null;
}
export interface MessageEvent {
  conversationId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}
export type PushState = "unsupported" | "available" | "denied" | "enabled";
export interface MessageRepository {
  list(): Promise<Conversation[]>;
  messages(id: string, before?: string): Promise<MessagePage>;
  open(businessId: string, body: string): Promise<string>;
  send(id: string, body: string, requestId?: string): Promise<void>;
  openAccount?(
    target: { author?: string; work?: string },
    body: string,
    requestId: string,
  ): Promise<string>;
  markRead?(id: string): Promise<void>;
  unreadCount?(): Promise<number>;
  subscribe?(userId: string, listener: (event: MessageEvent) => void): () => void;
  businessTarget?(businessId: string): Promise<MessageTarget | null>;
  accountTarget?(target: { author?: string; work?: string }): Promise<MessageTarget | null>;
  pushState?(): Promise<PushState>;
  enablePush?(): Promise<PushState>;
}
const client = supabase;
const rpc = client?.rpc.bind(client) as unknown as
  | ((name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>)
  | undefined;

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const decoded = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export const messagesRepository: MessageRepository | null = client
  ? {
      async list() {
        const { data, error } = await client.rpc("account_conversations_query");
        if (error) throw error;
        return data as unknown as Conversation[];
      },
      async messages(id, before) {
        const { data, error } = await client.rpc(
          "account_conversation_messages",
          { target_conversation: id, before_message: before ?? null },
        );
        if (error) throw error;
        return data as unknown as MessagePage;
      },
      async open(businessId, body) {
        const { data, error } = await client.rpc("open_conversation", {
          target_business: businessId,
          message_body: body,
        });
        if (error) throw error;
        return data;
      },
      async openAccount(target, body, requestId) {
        const { data, error } = await client.rpc("open_account_conversation", {
          message_body: body,
          request_id: requestId,
          target_author: target.author ?? null,
          target_work: target.work ?? null,
        });
        if (error) throw error;
        return data;
      },
      async send(id, body, requestId) {
        const { error } = await client.rpc(
          "send_account_conversation_message",
          {
            target_conversation: id,
            message_body: body,
            request_id: requestId ?? crypto.randomUUID(),
          },
        );
        if (error) throw error;
      },
      async markRead(id) {
        const { error } = await rpc!("mark_conversation_read", {
          target_conversation: id,
        });
        if (error) throw error;
      },
      async unreadCount() {
        const { data, error } = await rpc!("message_unread_count");
        if (error) throw error;
        return Number(data ?? 0);
      },
      subscribe(userId, listener) {
        let stopped = false;
        const channel = client.channel(`messages:user:${userId}`, {
          config: { private: true },
        });
        channel.on(
          "broadcast",
          { event: "message_created" },
          ({ payload }) => listener(payload as MessageEvent),
        );
        void client.realtime.setAuth().then(() => {
          if (!stopped) channel.subscribe();
        });
        return () => {
          stopped = true;
          void client.removeChannel(channel);
        };
      },
      async businessTarget(businessId) {
        const { data, error } = await rpc!("message_business_target", {
          target_business: businessId,
        });
        if (error) throw error;
        return data as MessageTarget | null;
      },
      async accountTarget(target) {
        const { data, error } = await rpc!("message_account_target", {
          target_author: target.author ?? null,
          target_work: target.work ?? null,
        });
        if (error) throw error;
        return data as MessageTarget | null;
      },
      async pushState() {
        if (
          typeof Notification === "undefined" ||
          !("serviceWorker" in navigator) ||
          !("PushManager" in window)
        )
          return "unsupported";
        if (Notification.permission === "denied") return "denied";
        const registration = await navigator.serviceWorker.ready;
        return (await registration.pushManager.getSubscription())
          ? "enabled"
          : "available";
      },
      async enablePush() {
        if (
          typeof Notification === "undefined" ||
          !("serviceWorker" in navigator) ||
          !("PushManager" in window)
        )
          return "unsupported";
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return "denied";
        const { data: key, error: keyError } = await rpc!(
          "message_push_public_key",
        );
        if (keyError || typeof key !== "string" || !key) throw keyError ?? new Error("Push unavailable");
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        const subscription =
          existing ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey(key),
          }));
        const serialized = subscription.toJSON();
        if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth)
          throw new Error("Invalid push subscription");
        const { error } = await rpc!("save_message_push_subscription", {
          push_endpoint: serialized.endpoint,
          push_p256dh: serialized.keys.p256dh,
          push_auth: serialized.keys.auth,
        });
        if (error) throw error;
        return "enabled";
      },
    }
  : null;

export function messageError(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "23514")
      return "Não foi possível enviar agora. Confira o texto, aguarde alguns segundos e verifique se o destinatário está disponível.";
    if (error.code === "42501")
      return "Você não tem acesso a esta conversa. Entre na conta correta.";
  }
  return "Não foi possível carregar ou enviar mensagens. Tente novamente.";
}
