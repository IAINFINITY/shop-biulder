import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CATALOG_NOTIFICATIONS_TABLE,
  normalizeCatalogNotificationFromSupabaseRow,
  type CatalogNotification,
} from "@/lib/catalogNotifications";

type UseCatalogNotificationsOptions = {
  activeOnly?: boolean;
};

export function useCatalogNotifications(options?: UseCatalogNotificationsOptions) {
  const activeOnly = options?.activeOnly !== false;

  return useQuery({
    queryKey: ["catalog-notifications", activeOnly ? "active" : "all"],
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      let query = supabase
        .from(CATALOG_NOTIFICATIONS_TABLE)
        .select(
          "id,title,summary,body,image_url,cta_label,cta_url,target_user_id,active,priority,starts_at,ends_at,created_at,updated_at",
        )
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (activeOnly) {
        query = query.eq("active", true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []).map((row) => normalizeCatalogNotificationFromSupabaseRow(row)) as CatalogNotification[];
    },
    initialData: [] as CatalogNotification[],
  });
}
