import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  SUPPORT_CONVERSATIONS_TABLE,
  SUPPORT_MESSAGES_TABLE,
  ensureCurrentCustomerConversation,
  type InternalStaffRecord,
  type InternalStaffRole,
  type SupportConversation,
  type SupportMessage,
} from "@/lib/supportChat";

export function useCustomerSupportConversation(userId: string | null, enabled = true) {
  return useQuery<SupportConversation | null>({
    queryKey: ["support-conversation", userId],
    enabled: enabled && Boolean(userId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchInterval: enabled ? 5_000 : false,
    queryFn: async () => {
      const conversation = await ensureCurrentCustomerConversation("Atendimento");
      return conversation;
    },
  });
}

export function useSupportInbox(enabled = true) {
  return useQuery<SupportConversation[]>({
    queryKey: ["support-inbox"],
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    refetchInterval: enabled ? 4_000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(SUPPORT_CONVERSATIONS_TABLE)
        .select("*")
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as SupportConversation[];
    },
  });
}

export function useSupportMessages(conversationId: string | null, enabled = true) {
  return useQuery<SupportMessage[]>({
    queryKey: ["support-messages", conversationId],
    enabled: enabled && Boolean(conversationId),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    refetchInterval: enabled ? 3_000 : false,
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from(SUPPORT_MESSAGES_TABLE)
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const messages = (data ?? []) as SupportMessage[];

      const senderIds = [...new Set(messages.map((m) => m.sender_user_id))];
      if (senderIds.length === 0) return messages;

      const names = new Map<string, string>();

      const { data: adminUsers } = await supabase
        .from("admin_users")
        .select("user_id, display_name")
        .in("user_id", senderIds);

      if (adminUsers) {
        for (const u of adminUsers) {
          if (u.display_name) names.set(u.user_id, u.display_name);
        }
      }

      const customerIds = senderIds.filter((id) => !names.has(id));
      if (customerIds.length > 0) {
        const { data: customers } = await supabase
          .from("customer_profiles")
          .select("user_id, name")
          .in("user_id", customerIds);

        if (customers) {
          for (const c of customers) {
            names.set(c.user_id, c.name);
          }
        }
      }

      return messages.map((m) => ({
        ...m,
        sender_user_name: names.get(m.sender_user_id) ?? null,
      }));
    },
  });
}

export function useUpdateSupportConversationTyping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      conversationId: string;
      typingRole: "customer" | "admin";
      isTyping: boolean;
    }) => {
      const patch =
        params.typingRole === "customer"
          ? { customer_typing_at: params.isTyping ? new Date().toISOString() : null }
          : { admin_typing_at: params.isTyping ? new Date().toISOString() : null };

      const { error } = await supabase.from(SUPPORT_CONVERSATIONS_TABLE).update(patch).eq("id", params.conversationId);

      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["support-inbox"] }),
        queryClient.invalidateQueries({ queryKey: ["support-conversation"] }),
      ]);
    },
  });
}

export function useSendSupportMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      conversationId: string;
      senderUserId: string;
      senderRole: "customer" | "admin";
      body: string;
    }) => {
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

      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["support-inbox"] }),
        queryClient.invalidateQueries({ queryKey: ["support-conversation"] }),
        queryClient.invalidateQueries({ queryKey: ["support-messages", variables.conversationId] }),
      ]);
    },
  });
}

export function useInternalStaff() {
  return useQuery<InternalStaffRecord[]>({
    queryKey: ["internal-staff"],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_internal_staff");
      if (error) throw error;
      return (data ?? []) as InternalStaffRecord[];
    },
  });
}

export function useSetInternalStaffRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { email: string; role: InternalStaffRole }) => {
      const { error } = await supabase.rpc("set_internal_staff_role", {
        p_email: params.email,
        p_role: params.role,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["internal-staff"] });
    },
  });
}
