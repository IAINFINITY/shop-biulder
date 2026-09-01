import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CATALOG_NOTIFICATION_READS_TABLE,
  normalizeCatalogNotificationReadFromSupabaseRow,
  type CatalogNotificationRead,
} from "@/lib/catalogNotificationReads";

export function useCatalogNotificationReads(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["catalog-notification-reads", userId ?? "anonymous"],
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!userId) {
        return [] as CatalogNotificationRead[];
      }

      const { data, error } = await supabase
        .from(CATALOG_NOTIFICATION_READS_TABLE)
        .select("id,user_id,notification_id,read_at,dispensado_em,created_at,updated_at")
        .eq("user_id", userId)
        .order("read_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((row) => normalizeCatalogNotificationReadFromSupabaseRow(row)) as CatalogNotificationRead[];
    },
  // Sem `initialData`: o react-query o trata como recem-chegado do servidor, e
  // com `staleTime` acima de zero um array vazio ficaria "fresco" ate expirar —
  // a consulta nunca dispararia e a tela mostraria a lista vazia esse tempo todo.
  // Quem chama ja destrutura com `= []`, entao nao falta valor de partida.
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!userId) {
        throw new Error("Usuário não autenticado");
      }

      const payload = {
        user_id: userId,
        notification_id: notificationId,
        read_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from(CATALOG_NOTIFICATION_READS_TABLE)
        .upsert(payload, { onConflict: "user_id,notification_id" });

      if (error) throw error;
      return payload;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["catalog-notification-reads", userId ?? "anonymous"] });
    },
  });

  /**
   * Limpar a lista.
   *
   * Grava `dispensado_em` junto com `read_at`: quem tira um aviso não lido da
   * lista não quer continuar com o contador aceso por causa de algo que sumiu da
   * tela. Não apaga a notificação — ela é da loja e vale para todo mundo; ver a
   * migration `20260901180000`.
   */
  const dispensarMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      if (!userId || notificationIds.length === 0) return;

      const agora = new Date().toISOString();
      const { error } = await supabase.from(CATALOG_NOTIFICATION_READS_TABLE).upsert(
        notificationIds.map((notificationId) => ({
          user_id: userId,
          notification_id: notificationId,
          read_at: agora,
          dispensado_em: agora,
        })),
        { onConflict: "user_id,notification_id" },
      );

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["catalog-notification-reads", userId ?? "anonymous"] });
    },
  });

  return {
    ...query,
    markAsRead: markAsReadMutation.mutateAsync,
    isMarkingRead: markAsReadMutation.isPending,
    dispensar: dispensarMutation.mutateAsync,
    isDispensando: dispensarMutation.isPending,
  };
}
