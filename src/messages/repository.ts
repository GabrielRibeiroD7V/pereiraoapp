import { supabase } from '../lib/supabase';

export interface Conversation {
  id: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  customerName: string;
  side: 'customer' | 'professional';
  updatedAt: string;
  lastMessage: string;
}
export interface ChatMessage { id: string; body: string; senderId: string; createdAt: string }
export interface MessagePage { items: ChatMessage[]; hasMore: boolean; customerId: string }
export interface MessageRepository {
  list(): Promise<Conversation[]>;
  messages(id: string, before?: string): Promise<MessagePage>;
  open(businessId: string, body: string): Promise<string>;
  send(id: string, body: string): Promise<void>;
}
const client = supabase;
export const messagesRepository: MessageRepository | null = client ? {
  async list() {
    const { data, error } = await client.rpc('my_conversations');
    if (error) throw error;
    return data as unknown as Conversation[];
  },
  async messages(id, before) {
    const { data, error } = await client.rpc('my_conversation_messages', { target_conversation: id, before_message: before ?? null });
    if (error) throw error;
    return data as unknown as MessagePage;
  },
  async open(businessId, body) {
    const { data, error } = await client.rpc('open_conversation', { target_business: businessId, message_body: body });
    if (error) throw error;
    return data;
  },
  async send(id, body) {
    const { error } = await client.rpc('send_conversation_message', { target_conversation: id, message_body: body });
    if (error) throw error;
  },
} : null;

export function messageError(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === '23514') return 'Não foi possível enviar agora. Confira o texto, aguarde alguns segundos e verifique se o perfil continua publicado.';
    if (error.code === '42501') return 'Você não tem acesso a esta conversa. Entre na conta correta.';
  }
  return 'Não foi possível carregar ou enviar mensagens. Tente novamente.';
}
