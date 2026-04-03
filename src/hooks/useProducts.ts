import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTS_TABLE } from "@/lib/products";

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PRODUCTS_TABLE)
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
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
