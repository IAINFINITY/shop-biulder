/**
 * Escala tipografica do projeto.
 *
 * O levantamento de 31/07/2026 achou 34 tamanhos de fonte distintos, 26 deles
 * fora da escala do Tailwind, e 24 combinacoes diferentes para um unico
 * elemento — o rotulo em caixa alta. Boa parte era duplicata por unidade:
 * `[13px]` e `[0.8rem]` sao o mesmo tamanho escrito de dois jeitos, assim como
 * `[15px]` e `[0.95rem]`, ou `[1rem]` e `text-base`.
 *
 * O efeito nao era so estetico: o mesmo papel tinha tamanho diferente conforme
 * a area. Texto secundario era 11px no admin e 12px no catalogo; o corpo do
 * admin disputava entre `text-sm` e `[13px]`. Quem abre as tres areas seguidas
 * percebe que nao foram desenhadas juntas.
 *
 * A saida e nomear por papel, nao por medida. `TEXT.label` diz onde se usa;
 * `text-[11px] font-semibold tracking-[0.18em] uppercase` nao diz nada, e por
 * isso cada tela reinventou o seu.
 *
 * Uso:
 *
 *   <p className={cn(TEXT.label, "text-muted-foreground")}>Resumo</p>
 *   <h2 className={TEXT.sectionTitle}>Mais vendidos</h2>
 *
 * Cor fica fora de proposito: o mesmo papel aparece em contextos de cor
 * diferentes, e embutir cor aqui obrigaria a sobrescrever na maioria dos usos.
 */

/** Degraus de tamanho. Referencia unica — nao acrescente valor solto na tela. */
export const FONT_SIZE = {
  /** 10px — selo, contador, canto de card. Menor tamanho aceitavel. */
  micro: "text-[0.625rem]",
  /** 11px — rotulo, metadado, legenda. */
  caption: "text-[0.6875rem]",
  /** 12px — apoio dentro de componente denso (tabela, filtro). */
  small: "text-xs",
  /** 13px — corpo de interface densa: formulario, tabela, painel do admin. */
  compact: "text-[0.8125rem]",
  /** 14px — corpo padrao da interface. */
  body: "text-sm",
  /** 16px — corpo de leitura corrida: descricao, artigo da ajuda. */
  reading: "text-base",
  /** 18px — titulo de bloco. */
  title: "text-lg",
  /** 20px — titulo de secao. */
  sectionTitle: "text-xl",
  /** 24px — titulo de pagina. */
  pageTitle: "text-2xl",
  /** 30px — destaque de abertura. */
  display: "text-3xl",
} as const;

/** Pesos. `bold` e `black` ficam de fora: a hierarquia se resolve em semibold. */
export const FONT_WEIGHT = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
} as const;

/**
 * Espacamento entre letras do rotulo caixa-alta.
 *
 * Um valor so. O projeto tinha de 0.08em a 0.32em fazendo o mesmo trabalho;
 * 0.18em era o dominante (65 usos) e virou o padrao.
 */
export const LABEL_TRACKING = "tracking-[0.18em]";

/**
 * Papeis de texto. E por aqui que as telas devem consumir a escala.
 */
export const TEXT = {
  /** Rotulo caixa-alta acima de secao ou campo. */
  label: `${FONT_SIZE.caption} ${FONT_WEIGHT.semibold} uppercase ${LABEL_TRACKING}`,
  /** Selo, contador, indicador curto. */
  badge: `${FONT_SIZE.micro} ${FONT_WEIGHT.semibold}`,
  /** Legenda e metadado sob um titulo ou campo. */
  caption: `${FONT_SIZE.caption} ${FONT_WEIGHT.normal}`,
  /** Corpo de interface densa: tabela, formulario, painel. */
  compact: `${FONT_SIZE.compact} ${FONT_WEIGHT.normal}`,
  /** Corpo padrao. */
  body: `${FONT_SIZE.body} ${FONT_WEIGHT.normal}`,
  /** Corpo com enfase — valor, total, nome em lista. */
  bodyStrong: `${FONT_SIZE.body} ${FONT_WEIGHT.semibold}`,
  /** Leitura corrida. */
  reading: `${FONT_SIZE.reading} leading-8`,
  /** Titulo de bloco dentro de uma secao. */
  title: `${FONT_SIZE.title} ${FONT_WEIGHT.semibold} leading-snug`,
  /** Titulo de secao. */
  sectionTitle: `${FONT_SIZE.sectionTitle} ${FONT_WEIGHT.semibold} leading-snug tracking-tight`,
  /** Titulo de pagina. */
  pageTitle: `${FONT_SIZE.pageTitle} ${FONT_WEIGHT.semibold} leading-tight tracking-tight`,
  /** Abertura de pagina. */
  display: `${FONT_SIZE.display} ${FONT_WEIGHT.semibold} leading-tight tracking-tight`,
} as const;
