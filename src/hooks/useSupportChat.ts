import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  SUPPORT_CONVERSATIONS_TABLE,
  SUPPORT_MESSAGES_TABLE,
  ensureCurrentCustomerConversation,
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

/**
 * Quantas conversas estao esperando resposta nossa, agora.
 *
 * ## Por que uma consulta separada da caixa
 *
 * Este numero aparece na barra lateral do painel **inteiro** — em Produtos, em
 * Pedidos, em qualquer tela — que e o ponto do pedido: "ninguem e notificado
 * sobre isso dentro da plataforma". Reaproveitar `useSupportInbox` traria todas
 * as conversas com previa e datas a cada 4 segundos, o tempo todo, so para
 * desenhar um numero. Aqui vem `count` com `head: true`: o banco conta e nao
 * devolve linha nenhuma, e a cada 30 segundos, que e a resolucao util para um
 * aviso que a pessoa nem esta olhando.
 *
 * O criterio e o mesmo de `estadoDaConversa` — aberta, ultima palavra do
 * cliente, e com mensagem de verdade. **Se um mudar, o outro muda junto**, ou o
 * aviso passa a discordar da lista que ele manda abrir.
 */
export function useConversasEsperando(enabled = true) {
  return useQuery<number>({
    queryKey: ["support-esperando"],
    enabled,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
    refetchInterval: enabled ? 30_000 : false,
    queryFn: async () => {
      const { count, error } = await supabase
        .from(SUPPORT_CONVERSATIONS_TABLE)
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .eq("ultima_mensagem_de", "customer")
        // A conversa nasce quando o cliente abre a secao, sem escrever nada.
        // Sem este filtro o aviso ficaria aceso sem ninguem ter falado.
        .not("last_message_preview", "is", null);

      if (error) throw error;
      return count ?? 0;
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
        .from("clinic+b2b_admin_users")
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
          .from("clinic+b2b_customer_profiles")
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
        // Responder tira a conversa da fila. Sem esta linha o aviso da barra
        // lateral so cairia no proximo ciclo de 30s, e o atendente veria o
        // numero antigo logo depois de ter resolvido o caso.
        queryClient.invalidateQueries({ queryKey: ["support-esperando"] }),
        queryClient.invalidateQueries({ queryKey: ["support-conversation"] }),
        queryClient.invalidateQueries({ queryKey: ["support-messages", variables.conversationId] }),
      ]);
    },
  });
}


/**
 * Encerrar (ou reabrir) o atendimento.
 *
 * ## Grava uma data, e nao um booleano
 *
 * `finalizada_em = now()` encerra; `null` reabre. A conversa conta como
 * encerrada so enquanto essa data for **mais recente que a ultima mensagem** —
 * ver `estaFinalizada`. E o que faz a resposta do cliente reabrir sozinha, sem
 * ninguem precisar clicar em nada.
 *
 * O aviso ao cliente sai de um gatilho no banco, e nao daqui: se dependesse
 * desta chamada, todo encerramento feito com a aba velha, ou direto no banco,
 * sairia calado.
 */
export function useFinalizarConversa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { conversationId: string; finalizar: boolean; adminUserId: string | null }) => {
      const { error } = await supabase
        .from(SUPPORT_CONVERSATIONS_TABLE)
        .update({
          finalizada_em: params.finalizar ? new Date().toISOString() : null,
          finalizada_por: params.finalizar ? params.adminUserId : null,
        })
        .eq("id", params.conversationId);

      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["support-inbox"] }),
        queryClient.invalidateQueries({ queryKey: ["support-esperando"] }),
        queryClient.invalidateQueries({ queryKey: ["support-conversation"] }),
      ]);
    },
  });
}
