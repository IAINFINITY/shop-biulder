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

