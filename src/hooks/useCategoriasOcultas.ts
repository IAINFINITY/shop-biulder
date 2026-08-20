import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_TYPES_TABLE } from "@/lib/products";
import { nomesOcultos, type CategoriaRegistrada } from "@/lib/categoriasOcultas";

/**
 * As categorias que a loja deve esconder.
 *
 * Leitura publica: a policy `Clinic B2B public read product types` libera
 * `SELECT` para `anon`, entao visitante deslogado tambem enxerga a decisao —
 * verificado contra a API antes de desenhar isto.
 *
 * Erro nao vira lista vazia por acaso: `nomesOcultos` trata ausencia como
 * "nada escondido", que e o comportamento de sempre. Uma falha aqui nao pode
 * apagar os filtros do catalogo.
 */
export function useCategoriasOcultas() {
  const { data } = useQuery({
    queryKey: ["categorias-ocultas"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from(PRODUCT_TYPES_TABLE).select("name, visivel");
      if (error) return [] as CategoriaRegistrada[];
      return (data ?? []) as CategoriaRegistrada[];
    },
  });

  return nomesOcultos(data);
}
