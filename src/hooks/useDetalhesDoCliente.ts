import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * O dossiê do cliente para quem está respondendo a conversa dele.
 *
 * ## Por que não bastava o que a conversa já traz
 *
 * O painel "Detalhes" mostrava três campos — empresa, CNPJ e telefone — porque
 * são os três que ficam **copiados na própria linha da conversa**. Estão sempre
 * preenchidos (conferido: 8 de 8), então o painel nunca aparecia vazio; ele
 * aparecia *raso*. Quem atende chega na conversa perguntando outra coisa:
 *
 *   "isso é cliente ou funcionário?" · "que tabela ele paga?" ·
 *   "ele já comprou?" · "de onde ele é?"
 *
 * Nenhuma dessas estava na tela, e todas mudam a resposta que se dá. Ir buscar
 * no cadastro significa sair da conversa.
 *
 * ## Duas consultas, e não uma view
 *
 * Pedido e perfil se ligam por caminhos diferentes — o perfil pela conta
 * (`user_id`), o pedido pelo CNPJ, porque um pedido pode ter sido feito sem
 * conta e reivindicado depois. Juntar isso numa view esconderia essa diferença
 * atrás de um `join` que dá certo quase sempre.
 */
export type DetalhesDoCliente = {
  tipoDeConta: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  clienteDesde: string | null;
  tabelaDePreco: number | null;
  totalDePedidos: number;
  ultimoPedidoEm: string | null;
  ultimoPedidoStatus: string | null;
};

export function useDetalhesDoCliente(userId: string | null, cnpj: string | null, enabled = true) {
  return useQuery<DetalhesDoCliente | null>({
    queryKey: ["detalhes-do-cliente", userId, cnpj],
    enabled: enabled && Boolean(userId || cnpj),
    staleTime: 60_000,
    queryFn: async () => {
      const [perfil, pedidos] = await Promise.all([
        userId
          ? supabase
              .from("clinic+b2b_customer_profiles")
              .select("customer_type, email, address_city, address_state, created_at, proxis_tpr_id")
              .eq("user_id", userId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        // Só o último pedido volta com dados; o resto é contagem no banco.
        // Trazer a lista inteira para contar no navegador seria baixar todos os
        // itens de todos os pedidos para mostrar um número.
        cnpj
          ? supabase
              .from("clinic+b2b_orders")
              .select("created_at, status", { count: "exact" })
              .eq("customer_cnpj", cnpj)
              .order("created_at", { ascending: false })
              .limit(1)
          : Promise.resolve({ data: null, error: null, count: 0 }),
      ]);

      if (perfil.error) throw perfil.error;
      if (pedidos.error) throw pedidos.error;

      const linha = perfil.data as Record<string, unknown> | null;
      const ultimo = (pedidos.data as Array<Record<string, unknown>> | null)?.[0] ?? null;

      const texto = (valor: unknown) => (typeof valor === "string" && valor.trim() ? valor.trim() : null);

      return {
        tipoDeConta: texto(linha?.customer_type),
        email: texto(linha?.email),
        cidade: texto(linha?.address_city),
        estado: texto(linha?.address_state),
        clienteDesde: texto(linha?.created_at),
        tabelaDePreco: Number.isFinite(Number(linha?.proxis_tpr_id)) ? Number(linha?.proxis_tpr_id) : null,
        totalDePedidos: ("count" in pedidos ? pedidos.count : 0) ?? 0,
        ultimoPedidoEm: texto(ultimo?.created_at),
        ultimoPedidoStatus: texto(ultimo?.status),
      };
    },
  });
}
