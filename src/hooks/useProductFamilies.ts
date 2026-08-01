import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PRODUCT_FAMILIES_TABLE,
  normalizeProductFamilyFromSupabaseRow,
  sortProductFamilies,
  type ProductFamily,
} from "@/lib/productFamilies";

export function useProductFamilies() {
  return useQuery({
    queryKey: ["product-families"],
    queryFn: async () => {
      // type_id nao entra mais no select: subcategoria e global e serve qualquer
      // categoria. A coluna segue no banco apenas como historico.
      const { data, error } = await supabase
        .from(PRODUCT_FAMILIES_TABLE)
        .select("id,name,created_at,updated_at")
        .order("name");

      if (error) return [] as ProductFamily[];
      return sortProductFamilies((data ?? []).map(normalizeProductFamilyFromSupabaseRow));
    },
  });
}
