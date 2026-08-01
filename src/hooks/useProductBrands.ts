import { useQuery } from "@tanstack/react-query";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import {
  PRODUCT_BRANDS_TABLE,
  normalizeProductBrandFromSupabaseRow,
  sortProductBrands,
  type ProductBrand,
} from "@/lib/productBrands";

export function useProductBrands(options?: { activeOnly?: boolean }) {
  const activeOnly = options?.activeOnly === true;

  return useQuery({
    queryKey: ["product-brands", activeOnly ? "active" : "all"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = await loadSupabaseClient();
      let query = supabase
        .from(PRODUCT_BRANDS_TABLE)
        .select("id,name,active,sort_order,created_at,updated_at");

      if (activeOnly) query = query.eq("active", true);

      const { data, error } = await query;
      // A tabela pode nao existir ainda em ambientes atrasados na fila de
      // migrations; sem marca o catalogo continua funcionando normalmente.
      if (error) return [] as ProductBrand[];

      return sortProductBrands((data ?? []).map(normalizeProductBrandFromSupabaseRow));
    },
  });
}
