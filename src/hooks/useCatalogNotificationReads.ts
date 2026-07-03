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
        .select("id,user_id,notification_id,read_at,created_at,updated_at")
        .eq("user_id", userId)
        .order("read_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((row) => normalizeCatalogNotificationReadFromSupabaseRow(row)) as CatalogNotificationRead[];
    },
    initialData: [] as CatalogNotificationRead[],
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

  return {
    ...query,
    markAsRead: markAsReadMutation.mutateAsync,
    isMarkingRead: markAsReadMutation.isPending,
  };
}
