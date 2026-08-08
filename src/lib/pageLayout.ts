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

/**
 * A vitrine cresce depois dos 1680; o resto da loja nao.
 *
 * Medido: em 3440px o conteudo parava em 1680 e sobravam 1760px de margem —
 * metade da tela vazia, com a grade travada em 5 colunas e o card em 259px
 * desde os 1680. Nao ficava feio, ficava vazio.
 *
 * A escada abaixo segue a recomendacao do Baymard para tela larga: **somar
 * coluna e aumentar o item ao mesmo tempo**, e parar em 5 a 8 colunas. Passar
 * disso a pessoa deixa de conseguir varrer a linha — o ganho vira perda.
 *
 * Os degraus caem **abaixo** das larguras reais de monitor (1920, 2560, 3440), e
 * nao em cima delas: o degrau de 7 colunas comecava em 2600 e por isso nao pegava
 * um monitor 2560 — o mais comum dessa faixa. Cada degrau tambem foi escolhido
 * para o card **nao encolher** ao ganhar coluna:
 *
 * | tela  | container | colunas | card  |
 * |-------|-----------|---------|-------|
 * | 1680  | 1680      | 5       | 259px |
 * | 1900  | 1840      | 5       | 291px |
 * | 2200  | 2120      | 6       | 287px |
 * | 2500  | 2460      | 7       | 293px |
 * | 3000  | 2880      | 8       | 307px |
 *
 * **So a vitrine usa isto.** Ajuda, pedido e pagina do produto continuam em
 * `PAGE_CONTAINER`, porque sao texto: linha de leitura com 2880px de largura e
 * pior que margem sobrando. A grade nao tem esse limite — cartao nao e paragrafo.
 *
 * Mexer aqui move as colunas de `Index.tsx` e a base dos carrosseis junto.
 */
export const VITRINE_MAX_WIDTH =
  "max-w-[1680px] min-[1900px]:max-w-[1840px] min-[2200px]:max-w-[2120px] min-[2500px]:max-w-[2460px] min-[3000px]:max-w-[2880px]";

export const PAGE_CONTAINER_VITRINE = `mx-auto w-full ${VITRINE_MAX_WIDTH} ${PAGE_PADDING_X}`;
