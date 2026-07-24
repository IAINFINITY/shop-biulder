import { useQuery } from "@tanstack/react-query";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import {
  CATALOG_BANNERS_TABLE,
  normalizeCatalogBannerFromSupabaseRow,
  type CatalogBanner,
} from "@/lib/catalogBanners";
import { isMissingColumnError } from "@/lib/products";

type UseCatalogBannersOptions = {
  activeOnly?: boolean;
};

const BANNER_SELECT_COLUMNS = "id,label,image_url,link_url,sort_order,active,placement,visible_to,created_at,updated_at" as const;
const BANNER_SELECT_COLUMNS_NO_PLACEMENT = "id,label,image_url,link_url,sort_order,active,visible_to,created_at,updated_at" as const;
const BANNER_SELECT_COLUMNS_LEGACY = "id,label,image_url,link_url,sort_order,active,created_at,updated_at" as const;

export function useCatalogBanners(options?: UseCatalogBannersOptions) {
  const activeOnly = options?.activeOnly !== false;

  return useQuery({
    queryKey: ["catalog-banners", activeOnly ? "active" : "all"],
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const supabase = await loadSupabaseClient();

      const columnSets = [BANNER_SELECT_COLUMNS, BANNER_SELECT_COLUMNS_NO_PLACEMENT, BANNER_SELECT_COLUMNS_LEGACY] as const;

      let data: unknown[] | null = null;
      let lastError: Error | null = null;

      for (const columns of columnSets) {
        let query = supabase
          .from(CATALOG_BANNERS_TABLE)
          .select(columns)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });

        if (activeOnly) {
          query = query.eq("active", true);
        }

        const result = await query;
        if (!result.error) {
          data = result.data ?? [];
          break;
        }
        lastError = result.error;

        if (
          !isMissingColumnError(result.error.message, "placement") &&
          !isMissingColumnError(result.error.message, "visible_to")
        ) {
          throw result.error;
        }
      }

      if (!data) throw lastError ?? new Error("Não foi possível carregar banners.");
      return (data ?? []).map((row) => normalizeCatalogBannerFromSupabaseRow(row)) as CatalogBanner[];
    },
    initialData: [] as CatalogBanner[],
  });
}
