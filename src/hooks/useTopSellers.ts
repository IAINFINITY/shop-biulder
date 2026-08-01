import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";

/** Quantos produtos entram na lista de mais vendidos. */
const LIMITE = 24;

export type TopSeller = { productId: string; quantidade: number; pedidos: number };

/**
 * Os mais vendidos da loja inteira.
 *
 * Vem de `top_selling_products()`, que agrega `orders.items` no banco. Calcular
 * isso no navegador nao funcionava: o RLS de `orders` entrega ao cliente **so os
 * pedidos dele**, entao a prateleira mostrava "o que eu mesmo mais peco" — e,
 * para quem nunca comprou, nada. A funcao roda como `SECURITY DEFINER` e devolve
 * so o agregado, sem nenhum dado de cliente.
 */
export function useTopSellers() {
  const query = useQuery({
    queryKey: ["top-selling-products", LIMITE],
    // Venda acumulada nao muda de minuto a minuto, e esta lista aparece em toda
    // pagina de catalogo: meia hora de cache evita repetir a agregacao a cada
    // navegacao.
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<TopSeller[]> => {
      const supabase = await loadSupabaseClient();
      const { data, error } = await supabase.rpc("top_selling_products", { p_limit: LIMITE });
      if (error) throw error;
      return (data ?? []).map((linha) => ({
        productId: String(linha.product_id),
        quantidade: Number(linha.total_quantity ?? 0),
        pedidos: Number(linha.order_count ?? 0),
      }));
    },
  });

  // Sem `initialData`.
  //
  // O react-query trata `initialData` como se tivesse acabado de chegar do
  // servidor. Com `staleTime` de 30 minutos, um array vazio ficava "fresco" por
  // 30 minutos e a consulta nunca disparava: a prateleira sumia e o selo de mais
  // vendido nunca aparecia. O valor de partida vem do `?? []` abaixo, que nao
  // mente para o cache.
  const porQuantidade = query.data ?? [];

  /** Ordem de venda: quanto menor o indice, mais vendido. */
  const posicao = useMemo(() => {
    const mapa = new Map<string, number>();
    porQuantidade.forEach((item, indice) => mapa.set(item.productId, indice));
    return mapa;
  }, [porQuantidade]);

  const ids = useMemo(() => new Set(posicao.keys()), [posicao]);

  return { topSellers: porQuantidade, posicaoDeVenda: posicao, idsMaisVendidos: ids };
}
