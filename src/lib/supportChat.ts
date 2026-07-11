import { supabase } from "@/integrations/supabase/client";

export const SUPPORT_CONVERSATIONS_TABLE = "support_conversations";
export const SUPPORT_MESSAGES_TABLE = "support_messages";

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

export type InternalStaffRole = "user" | "admin" | "consultor" | "representante" | "admin_atendimento";

export type InternalStaffRecord = {
  user_id: string;
  email: string;
  role: InternalStaffRole;
  created_at: string;
};

export type SupportConversationInput = {
  customer_user_id: string;
  customer_name: string;
  customer_company?: string | null;
  customer_phone?: string | null;
  customer_cnpj?: string | null;
  assigned_admin_id?: string | null;
  subject?: string;
  status?: string;
};

function normalizeText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function formatSupportConversationTitle(conversation: Pick<SupportConversation, "customer_name" | "customer_company" | "customer_cnpj">) {
  const company = normalizeText(conversation.customer_company);
  if (company) return company;
  const name = normalizeText(conversation.customer_name);
  if (name) return name;
  const cnpj = normalizeText(conversation.customer_cnpj);
  if (cnpj) return cnpj;
  return "Conversa sem título";
}

export function formatSupportLastMessagePreview(conversation: Pick<SupportConversation, "last_message_preview">) {
  const preview = normalizeText(conversation.last_message_preview);
  return preview || "Sem mensagens ainda";
}

export function isTypingRecently(typingAt: string | null | undefined, now = Date.now(), timeoutMs = 4500) {
  if (!typingAt) return false;
  const timestamp = new Date(typingAt).getTime();
  if (Number.isNaN(timestamp)) return false;
  return now - timestamp <= timeoutMs;
}

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

export async function sendSupportMessage(params: {
  conversationId: string;
  senderUserId: string;
  senderRole: "customer" | "admin";
  body: string;
}) {
  const body = params.body.trim();
  if (!body) {
    throw new Error("Digite uma mensagem antes de enviar.");
  }

  const { error } = await supabase.from(SUPPORT_MESSAGES_TABLE).insert({
    conversation_id: params.conversationId,
    sender_user_id: params.senderUserId,
    sender_role: params.senderRole,
    body,
  });

  if (error) {
    throw error;
  }
}
