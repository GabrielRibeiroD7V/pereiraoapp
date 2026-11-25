import { supabase } from "../lib/supabase";

export interface Conversation {
  id: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  customerName: string;
  side: "customer" | "professional" | "account";
  peerId?: string;
  peerName?: string;
  updatedAt: string;
  lastMessage: string;
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
}
const client = supabase;
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
