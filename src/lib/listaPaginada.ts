import { paginar, type Pagina } from "@/lib/paginacao";

/**
 * Busca e paginação de uma lista pequena — cartão de configuração, seção do
 * painel.
 *
 * ## Por que existe
 *
 * A tela de Preços tinha **quatro** listas sem teto: tipos de conta, tabelas de
 * preço, tabelas por tipo e negociadas. Com quatro tipos e quatro tabelas
 * ninguém nota; com cinquenta, cada cartão vira uma coluna que empurra o resto
 * da tela para fora. É o mesmo defeito que Funcionários tinha com 97 cartões
 * empilhados, e que `paginacao.ts` já resolvia — só não estava aplicado aqui.
 *
 * ## ⚠️ Busca e rodapé só aparecem quando servem
 *
 * Campo de busca sobre quatro itens é ruído: ocupa altura, pede atenção e não
 * responde nada que o olho não responda mais rápido. O critério é objetivo —
 * **só aparece quando a lista não cabe numa página** — e vale para os dois, para
 * a lista não ganhar um campo e não ganhar o rodapé, ou o contrário.
 */

/** Itens por página numa lista de cartão. Cabe sem esticar o cartão. */
export const ITENS_POR_PAGINA_EM_CARTAO = 8;

export type ListaPaginada<T> = {
  /** A fatia visível, já filtrada pela busca. */
  itens: T[];
  pagina: Pagina<T>;
  /** Mostrar o campo de busca e o rodapé de paginação? */
  precisaDeControles: boolean;
  /** Quantos itens a busca encontrou — o total sem o corte de página. */
  encontrados: number;
};

/**
 * Filtra pelo termo, pagina o resultado e diz se vale mostrar os controles.
 *
 * `textoDoItem` devolve tudo o que aquele item deve casar. Fica com quem chama
 * porque só ele sabe o que é buscável — nome do tipo, nome e número da tabela.
 */
export function montarListaPaginada<T>(
  itens: readonly T[],
  {
    busca = "",
    pagina: paginaPedida = 0,
    porPagina = ITENS_POR_PAGINA_EM_CARTAO,
    textoDoItem,
  }: {
    busca?: string;
    pagina?: number;
    porPagina?: number;
    textoDoItem: (item: T) => string;
  },
): ListaPaginada<T> {
  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((item) => textoDoItem(item).toLowerCase().includes(termo)) : [...itens];

  const pagina = paginar(filtrados, paginaPedida, porPagina);

  return {
    itens: pagina.itens,
    pagina,
    // ⚠️ Olha o total **da lista**, e não o do resultado da busca.
    //
    // Usando o resultado, digitar um termo que sobra três itens esconderia o
    // campo de busca — junto com o texto que a pessoa acabou de digitar. O campo
    // fica enquanto a lista original justificar tê-lo.
    precisaDeControles: itens.length > porPagina,
    encontrados: filtrados.length,
  };
}
