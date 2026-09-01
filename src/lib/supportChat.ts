import { supabase } from "@/integrations/supabase/client";

export const SUPPORT_CONVERSATIONS_TABLE = "clinic+b2b_support_conversations";
export const SUPPORT_MESSAGES_TABLE = "clinic+b2b_support_messages";

export type SupportConversation = {
  id: string;
  customer_user_id: string;
  customer_name: string;
  customer_company: string | null;
  customer_phone: string | null;
  customer_cnpj: string | null;
  assigned_admin_id: string | null;
  subject: string;
  status: "open" | "closed" | "archived" | string;
  last_message_preview: string | null;
  last_message_at: string;
  /**
   * Quem falou por ultimo: "customer" ou "admin".
   *
   * E daqui que sai "esperando resposta". Mantido por gatilho no banco, nunca
   * pelo navegador — ver a migration 20260831170000.
   */
  ultima_mensagem_de: "customer" | "admin" | string | null;
  /**
   * Quando o atendimento foi encerrado. `null` = nunca encerrado.
   *
   * Encerrada de verdade so enquanto `finalizada_em >= last_message_at` — ver
   * `estaFinalizada`. E data, e nao booleano, para a resposta do cliente
   * reabrir a conversa sozinha.
   */
  finalizada_em: string | null;
  finalizada_por: string | null;
  customer_typing_at: string | null;
  admin_typing_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportMessage = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  sender_role: "customer" | "admin" | string;
  body: string;
  created_at: string;
  updated_at: string;
  sender_user_name?: string | null;
};

export async function ensureCurrentCustomerConversation(subject = "Atendimento") {
  const { data: conversationId, error: rpcError } = await supabase.rpc("ensure_support_conversation", {
    p_subject: subject,
  });

  if (rpcError) {
    throw rpcError;
  }

  const { data, error } = await supabase
    .from(SUPPORT_CONVERSATIONS_TABLE)
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as SupportConversation | null;
}

