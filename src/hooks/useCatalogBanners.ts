import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CATALOG_BANNERS_TABLE,
  normalizeCatalogBannerFromSupabaseRow,
  type CatalogBanner,
} from "@/lib/catalogBanners";

type UseCatalogBannersOptions = {
  activeOnly?: boolean;
};

export function useCatalogBanners(options?: UseCatalogBannersOptions) {
  const activeOnly = options?.activeOnly !== false;

  return useQuery({
    queryKey: ["catalog-banners", activeOnly ? "active" : "all"],
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      let query = supabase
        .from(CATALOG_BANNERS_TABLE)
        .select("id,label,image_url,link_url,sort_order,active,created_at,updated_at")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (activeOnly) {
        query = query.eq("active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => normalizeCatalogBannerFromSupabaseRow(row)) as CatalogBanner[];
    },
    initialData: [] as CatalogBanner[],
  });
}

