import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_TYPES_TABLE } from "@/lib/products";

export interface ProductType {
  id: string;
  name: string;
  created_at: string;
}

export function useAdminProductTypes() {
  return useQuery({
    queryKey: ["product-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PRODUCT_TYPES_TABLE)
        .select("*")
        .order("name");
      if (error) return [] as ProductType[];
      return (data || []) as ProductType[];
    },
  });
}
