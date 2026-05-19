import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PRODUCTS_TABLE,
  PRODUCT_SELECT_COLUMNS,
  PRODUCT_SELECT_COLUMNS_LEGACY,
  normalizeProductFromSupabaseRow,
  isMissingImageUrlsColumnError,
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

      let { data, error } = await runQuery(PRODUCT_SELECT_COLUMNS);
      if (error && isMissingImageUrlsColumnError(error.message)) {
        ({ data, error } = await runQuery(PRODUCT_SELECT_COLUMNS_LEGACY));
      }
      if (error) throw error;
      return (data ?? []).map((row) => normalizeProductFromSupabaseRow(row as Record<string, unknown>));
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
