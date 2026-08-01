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

/**
 * Tentativas de leitura, da mais completa para a mais antiga.
 *
 * **`placement` saiu da lista.** A coluna nao existe no banco e `slot` faz o
 * trabalho dela melhor. Enquanto ela era pedida, a primeira tentativa falhava
 * *sempre*, e a leitura vivia no degrau de baixo — que por sua vez derrubava
 * `slot` junto. Toda linha voltava sem area, o normalizador assumia "topo", e os
 * banners de par, destaque e ajuda iam parar no carrossel do topo enquanto as
 * areas deles ficavam vazias. Sem erro no console, porque a consulta "funcionava".
 *
 * Agora a primeira tentativa passa direto, e cada degrau abaixo dela existe so
 * para banco antigo.
 */
const COLUNAS_BASE = "id,label,image_url,link_url,sort_order,active,created_at,updated_at";
const COLUNAS_ARTE = "image_url_avif,image_url_mobile,image_url_mobile_avif";

const BANNER_SELECT_COLUMNS = `${COLUNAS_BASE},${COLUNAS_ARTE},slot,visible_to` as const;
/** Sem `slot`: tudo cai em "topo", como era antes das areas existirem. */
const BANNER_SELECT_COLUMNS_NO_SLOT = `${COLUNAS_BASE},${COLUNAS_ARTE},visible_to` as const;
/** Banco antigo, so o essencial. */
const BANNER_SELECT_COLUMNS_LEGACY = COLUNAS_BASE;

/** Exportado para teste: cada degrau deve abrir mao de uma coluna por vez. */
export const BANNER_COLUMN_SETS = [
  BANNER_SELECT_COLUMNS,
  BANNER_SELECT_COLUMNS_NO_SLOT,
  BANNER_SELECT_COLUMNS_LEGACY,
] as const;

export function useCatalogBanners(options?: UseCatalogBannersOptions) {
  const activeOnly = options?.activeOnly !== false;

  return useQuery({
    queryKey: ["catalog-banners", activeOnly ? "active" : "all"],
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const supabase = await loadSupabaseClient();

      const columnSets = BANNER_COLUMN_SETS;

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
          !isMissingColumnError(result.error.message, "slot") &&
          !isMissingColumnError(result.error.message, "visible_to") &&
          !isMissingColumnError(result.error.message, "image_url_avif") &&
          !isMissingColumnError(result.error.message, "image_url_mobile")
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
