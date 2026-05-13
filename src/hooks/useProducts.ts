import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTS_TABLE, type Product } from "@/lib/products";
import { coercePrice } from "@/lib/formatMoney";

function normalizeProductRow(row: Record<string, unknown>): Product {
  return {
    ...(row as Product),
    price: coercePrice(row.price),
  };
}

export type UseProductsOptions = {
  /** Admin: listar também inativos. No catálogo público omitir ou deixar false. */
  includeInactive?: boolean;
};

export function useProducts(options?: UseProductsOptions) {
  const includeInactive = options?.includeInactive === true;
  return useQuery({
    queryKey: ["products", includeInactive ? "all" : "active"],
    queryFn: async () => {
      let q = supabase.from(PRODUCTS_TABLE).select("*").order("name");
      if (!includeInactive) {
        q = q.eq("active", true);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row) => normalizeProductRow(row as Record<string, unknown>));
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
