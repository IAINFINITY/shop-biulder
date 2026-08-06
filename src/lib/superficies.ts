/**
 * Superficies e elevacao — o vocabulario de "caixa" do projeto.
 *
 * A vitrine ja tinha uma linguagem que funciona: cartao com raio medio e **anel
 * fino** em vez de sombra. O admin e a area de cliente cresceram por fora dela e
 * inventaram a propria — 48 sombras customizadas no admin, nenhum anel, e raio
 * variando entre `rounded-2xl` e `rounded-[1.25rem]`.
 *
 * Este arquivo nao cria um terceiro vocabulario: ele nomeia o da vitrine para
 * que as outras areas possam usar o mesmo.
 *
 * Ver `documentation/planejamento/PLANO_UNIFICACAO_ADMIN_CLIENTE.MD`.
 */

/**
 * Tres degraus de elevacao, e nao dez.
 *
 * O levantamento encontrou 10 valores distintos de `shadow-[...]` no projeto,
 * mas dois respondiam por 46 dos usos e os outros oito eram caso unico. Sombra
 * quase igual nao comunica hierarquia — so faz a tela parecer montada por
 * pessoas diferentes, que e exatamente o problema.
 */
export const ELEVACAO = {
  /** Rente ao fundo: cartao em repouso, linha de lista, campo. */
  rente: "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
  /** Acima do fundo: painel, bloco de secao, cartao em foco. */
  media: "shadow-[0_12px_32px_rgba(16,24,40,0.08)]",
  /** Sobre o conteudo: dialogo, gaveta, menu suspenso. */
  flutuante: "shadow-[0_24px_60px_rgba(16,24,40,0.14)]",
} as const;

/**
 * Separacao por **anel**, e nao por sombra.
 *
 * E o que a vitrine faz. Anel de 1px nao desloca o elemento na pagina e nao
 * acumula peso visual quando ha muitos cartoes lado a lado — que e o caso de
 * toda grade do projeto.
 */
export const ANEL = {
  padrao: "ring-1 ring-black/5",
  foco: "ring-black/10",
} as const;

/** Raio unico para caixa de conteudo. O `rounded-full` de pilula continua livre. */
export const RAIO = "rounded-xl";

/**
 * Cartao de conteudo — a caixa padrao de qualquer area.
 *
 * Mesmo desenho do card de produto do catalogo, sem o comportamento de hover
 * (que e especifico de item clicavel).
 */
export const CARTAO = `${RAIO} bg-background ${ANEL.padrao}`;

/** Painel de secao: o bloco maior que agrupa cartoes e formularios. */
export const PAINEL = `${RAIO} bg-background ${ANEL.padrao} ${ELEVACAO.media}`;

/** Caixa discreta, para agrupar informacao dentro de um painel. */
export const CAIXA_SUAVE = `${RAIO} bg-muted/20 ${ANEL.padrao}`;
