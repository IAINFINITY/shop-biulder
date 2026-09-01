import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type TabelaDePreco = {
  tprId: number;
  description: string;
  ativa: boolean;
  /** Tem preço próprio gravado. Sem isto, escolhê-la não muda nada. */
  temPreco: boolean;
};

/**
 * As tabelas de preço cadastradas.
 *
 * ## Por que virou hook
 *
 * A consulta vivia dentro de `AdminPricingSection`. Clientes precisa dela agora
 * por dois motivos — escolher a tabela de uma conta e filtrar a lista por tabela
 * — e copiar o `select` para lá daria duas listas que podem discordar sobre o
 * nome de uma tabela renomeada. Mesma chave, uma consulta só.
 *
 * ⚠️ Os nomes vivem em `clinic+b2b_price_tables`, e não no ERP. Vinham de
 * `/api/proxis-price-tables`; com o Proxis fora, a migration de 31/08 gravou
 * cada nome no banco — senão os nomes de verdade teriam ido embora junto com o
 * ERP e sobrariam números soltos.
 */
export function useTabelasDePreco(enabled = true) {
  return useQuery<TabelaDePreco[]>({
    queryKey: ["price-tables"],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const [tabelas, precos] = await Promise.all([
        supabase.from("clinic+b2b_price_tables").select("tpr_id, name, active").order("tpr_id"),
        // Só os `tpr_id` distintos que têm preço. Puxar as ~570 linhas de preço
        // para descobrir 4 números seria caro; puxar só a coluna é barato e o
        // navegador reduz a um `Set`.
        supabase.from("clinic+b2b_customer_price_overrides").select("proxis_tpr_id").not("proxis_tpr_id", "is", null),
      ]);

      if (tabelas.error) throw tabelas.error;
      if (precos.error) throw precos.error;

      const comPreco = new Set(
        (precos.data ?? []).map((linha) => Number((linha as { proxis_tpr_id: number | null }).proxis_tpr_id)),
      );

      return (tabelas.data ?? []).map((linha) => ({
        tprId: Number(linha.tpr_id),
        description: String(linha.name ?? ""),
        ativa: Boolean(linha.active),
        temPreco: comPreco.has(Number(linha.tpr_id)),
      }));
    },
  });
}

/**
 * As tabelas que faz sentido **oferecer** para uma conta.
 *
 * ## ⚠️ Uma tabela sem preço não faz nada
 *
 * O seletor listava as nove cadastradas. Medido em 01/09/2026:
 *
 * | tabela | contas | preços |
 * |---|---|---|
 * | 40, 41, 52 | 0 | **0** |
 * | 80, 82 (“antiga”) | 3 | **0** |
 * | 8728, 8729 | 35 | 268 |
 * | 8744, 8745 | 0 | 297 |
 *
 * Cinco das nove não têm preço nenhum. Atribuir uma conta a uma delas não muda
 * preço algum — o cliente continua pagando a tabela do tipo. É um controle que
 * mente: parece decidir e não decide. E três contas **já estão** nessa
 * situação, apontando para 80 e 82.
 *
 * A regra é derivada, e não uma lista cravada no código: some quem não tem
 * preço. No dia em que alguém carregar preços na 52, ela aparece sozinha.
 *
 * `atual` existe para o campo não mentir sobre o que está gravado: a tabela
 * escolhida hoje continua na lista mesmo sem preço, para quem abrir o cadastro
 * ver o valor de verdade em vez de um campo vazio.
 */
export function tabelasOferecidas(tabelas: readonly TabelaDePreco[], atual: number | null): TabelaDePreco[] {
  return tabelas.filter((tabela) => tabela.ativa && (tabela.temPreco || tabela.tprId === atual));
}

/** "Representante Nacional 2026 (8728)" — o número junto porque é o que o ERP fala. */
export function rotuloDaTabela(tabela: TabelaDePreco): string {
  const nome = tabela.description ? `${tabela.description} (${tabela.tprId})` : `Tabela ${tabela.tprId}`;
  // Só aparece na tabela que continua listada por estar gravada na conta — ver
  // `tabelasOferecidas`. Sem o aviso, ela pareceria uma opção legítima.
  return tabela.temPreco ? nome : `${nome} — sem preços`;
}
