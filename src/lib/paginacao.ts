// Paginação de lista longa no painel.
//
// ## Por que existe
//
// Produtos e Pedidos desenhavam a lista inteira: 147 cartões de produto e todos
// os pedidos já feitos, numa rolagem só. Achar qualquer coisa exigia rolar até
// achar, e o navegador montava tudo mesmo com nada visível na tela.
//
// A regra é pequena mas tem três armadilhas que só aparecem em uso, e as três
// já apareceram em `AdminProxisPriceTables`: página que sobra depois de um
// filtro apertar a lista, página negativa, e total zero. Ficam aqui, testadas,
// em vez de repetidas em cada tela.

/** Quantos itens por página, para lista em coluna única. */
export const ITENS_POR_PAGINA = 24;

/**
 * Para grade: 30 é múltiplo de 2, 3, 5 e 6.
 *
 * A biblioteca de imagens tem 2 colunas no celular, 3 no tablet e 5 no
 * desktop. Com 24 por página a última linha ficava com 4 de 5 e sobrava um
 * buraco na grade — que também muda a altura da página e faz a rolagem
 * escorregar ao trocar de página.
 *
 * 30 fecha exatamente em qualquer uma das três larguras.
 */
export const ITENS_POR_PAGINA_EM_GRADE = 30;

export type Pagina<T> = {
  itens: T[];
  /** Base 1, para mostrar. `0` quando não há nada. */
  paginaAtual: number;
  totalDePaginas: number;
  /** Índice do primeiro item desta página, base 1. `0` quando não há nada. */
  primeiroItem: number;
  /** Índice do último item desta página, base 1. */
  ultimoItem: number;
  total: number;
};

/**
 * A fatia visível da lista.
 *
 * `paginaPedida` é base 0 e **não precisa ser válida**: filtrar reduz a lista e
 * quem estava na página 5 continua pedindo a 5. Em vez de exigir que cada tela
 * lembre de corrigir isso, a função prende no intervalo — a última página passa
 * a ser a última que existe, e a lista nunca aparece vazia por engano.
 */
export function paginar<T>(itens: readonly T[], paginaPedida: number, porPagina = ITENS_POR_PAGINA): Pagina<T> {
  const total = itens.length;
  const tamanho = Math.max(1, Math.trunc(porPagina));

  if (total === 0) {
    return { itens: [], paginaAtual: 0, totalDePaginas: 0, primeiroItem: 0, ultimoItem: 0, total: 0 };
  }

  const totalDePaginas = Math.ceil(total / tamanho);
  const indice = Math.min(Math.max(0, Math.trunc(paginaPedida) || 0), totalDePaginas - 1);
  const inicio = indice * tamanho;

  return {
    itens: itens.slice(inicio, inicio + tamanho) as T[],
    paginaAtual: indice + 1,
    totalDePaginas,
    primeiroItem: inicio + 1,
    ultimoItem: Math.min(inicio + tamanho, total),
    total,
  };
}

/** Frase pronta do rodapé: "25–48 de 147". Uma só, para as telas não divergirem. */
export function rotuloDaPagina(pagina: Pick<Pagina<unknown>, "primeiroItem" | "ultimoItem" | "total">): string {
  if (pagina.total === 0) return "nenhum item";
  if (pagina.total === 1) return "1 item";
  return `${pagina.primeiroItem}–${pagina.ultimoItem} de ${pagina.total}`;
}
