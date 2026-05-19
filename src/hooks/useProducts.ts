import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PRODUCTS_TABLE,
  PRODUCT_SELECT_COLUMNS,
  PRODUCT_SELECT_COLUMNS_LEGACY,
  PRODUCT_SELECT_COLUMNS_NO_CODE,
  PRODUCT_SELECT_COLUMNS_NO_GALLERY,
  normalizeProductFromSupabaseRow,
  isMissingImageUrlsColumnError,
  isMissingProductCodeColumnError,
} from "@/lib/products";

export type UseProductsOptions = {
  /** Admin: listar também inativos. No catálogo público omitir ou deixar false. */
  includeInactive?: boolean;
};

export function useProducts(options?: UseProductsOptions) {
  const includeInactive = options?.includeInactive === true;
  return useQuery({
    queryKey: ["products", includeInactive ? "all" : "active"],
    queryFn: async () => {
      const runQuery = (columns: string) => {
        let q = supabase.from(PRODUCTS_TABLE).select(columns).order("name");
        if (!includeInactive) {
          q = q.eq("active", true);
        }
        return q;
      };

      const columnSets = [
        PRODUCT_SELECT_COLUMNS,
        PRODUCT_SELECT_COLUMNS_NO_GALLERY,
        PRODUCT_SELECT_COLUMNS_NO_CODE,
        PRODUCT_SELECT_COLUMNS_LEGACY,
      ] as const;

      let data: Record<string, unknown>[] | null = null;
      let lastError: Error | null = null;

      for (const columns of columnSets) {
        const result = await runQuery(columns);
        if (!result.error) {
          data = (result.data ?? []) as Record<string, unknown>[];
          break;
        }
        lastError = result.error;
        const missingColumn =
          isMissingImageUrlsColumnError(result.error.message) ||
          isMissingProductCodeColumnError(result.error.message);
        if (!missingColumn) throw result.error;
      }

      if (!data) throw lastError ?? new Error("Não foi possível carregar produtos.");
      return data.map((row) => normalizeProductFromSupabaseRow(row));
    },
  });
}

export function useProductFamilies() {
  const { data: products } = useProducts();
  if (!products) return [];
  return [...new Set(products.map((p) => p.family))].sort();
}

export function useProductTypes() {
  const { data: products } = useProducts();
  if (!products) return [];
  return [...new Set(products.map((p) => p.type))].sort();
}
