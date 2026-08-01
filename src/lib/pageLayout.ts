/**
 * Largura do conteudo nas paginas publicas.
 *
 * O catalogo e a pagina do produto ja paravam em 1400px, mas ajuda, pedido e
 * pedido concluido iam ate a borda da tela. Num monitor largo a loja parecia
 * duas: parte do conteudo alinhado num limite e parte derramando para fora dele.
 *
 * 1680px vem da grade do catalogo — e a largura em que cabem 6 no carrossel e 5
 * na grade, com o card ficando nos mesmos ~257px de sempre (259px). Mudar aqui
 * move a loja inteira junto, entao as colunas de `Index.tsx` e a base do
 * carrossel em `CatalogThemeSections.tsx` andam junto com este numero.
 *
 * Seis na grade nao da: ela divide a linha com a coluna de filtros de 240px, e
 * manter o card legivel com 6 colunas pediria 1938px de container — mais do que
 * cabe numa tela de 1920.
 *
 * Vale para o **conteudo** das paginas publicas. Cabecalho, rodape e banner
 * ficam de fora de proposito: sao faixas, e faixa se estende de ponta a ponta —
 * limita-las deixaria sobra de fundo nas laterais em tela larga.
 *
 * Tambem nao vale para o admin nem para a area do cliente: sao telas de
 * trabalho, com tabela e formulario longo, que ganham em usar a tela toda.
 */
export const PAGE_MAX_WIDTH = "max-w-[1680px]";

/** Respiro lateral, crescendo com a tela. */
export const PAGE_PADDING_X = "px-3 sm:px-6 lg:px-8";

/** Container completo: use em qualquer faixa de conteudo da area publica. */
export const PAGE_CONTAINER = `mx-auto w-full ${PAGE_MAX_WIDTH} ${PAGE_PADDING_X}`;
