import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_FAMILIES_TABLE, normalizeProductFamilyFromSupabaseRow, type ProductFamily } from "@/lib/productFamilies";

export function useProductFamilies() {
  return useQuery({
    queryKey: ["product-families"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PRODUCT_FAMILIES_TABLE)
        .select("id,name,type_id,created_at,updated_at")
        .order("name");

      if (error) return [] as ProductFamily[];
      return (data ?? []).map(normalizeProductFamilyFromSupabaseRow) as ProductFamily[];
    },
  });
}
