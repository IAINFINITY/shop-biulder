import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_TYPES_TABLE } from "@/lib/products";

export interface ProductType {
  id: string;
  name: string;
  created_at: string;
  /**
   * `false` esconde a categoria dos filtros da loja.
   *
   * Opcional porque a coluna pode nao existir ainda no banco — e nesse caso
   * `undefined` significa "visivel", nunca "oculta". Ver `categoriasOcultas.ts`.
   */
  visivel?: boolean | null;
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
