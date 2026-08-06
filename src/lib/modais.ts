/**
 * Modais no celular — as duas formas que valem a pena, e nenhuma no meio.
 *
 * O que existia era uma so: a caixa centralizada do desktop, encolhida. Como a
 * base do shadcn e `w-full` num elemento `fixed`, `w-full` vale 100% da tela — e
 * todo `max-w-*` maior que o telefone virava letra morta. Medido em 390x844, 13
 * dos 15 modais chegavam na tela com 0 a 8px de folga lateral.
 *
 * O resultado nao era "grande demais" por acaso: cobria quase tudo mas continuava
 * com canto arredondado flutuando, sem cabecalho proprio. Nao lia como tela cheia
 * nem como caixa. E essa ambiguidade que incomoda.
 *
 * A divisao segue o Material: **tela cheia quando ha campo de formulario**
 * (teclado abrindo, mudanca que so salva no fim, dialogo que abre outro dialogo)
 * e **caixa com folga** para confirmacao curta. A vitrine — QuickView e galeria —
 * fica de fora de proposito: ja tem folga de 16px e ninguem reclamou dela.
 *
 * Ver `documentation/planejamento/PLANO_UNIFICACAO_ADMIN_CLIENTE.MD`.
 */

/**
 * Formulario longo: ocupa a tela inteira abaixo de `sm` (640px).
 *
 * Todas as classes sao `max-sm:` porque precisam vencer as sem prefixo que ja
 * estao no `DialogContent` — `left-[50%]`, `translate-x-[-50%]`, `max-w-[…]`,
 * `rounded-[…]`. Empate de especificidade se resolve pela ordem na folha, e o
 * Tailwind emite as variantes depois das utilidades cruas.
 *
 * `dvh` e nao `vh`: `vh` e o viewport *grande*, com a barra de URL escondida.
 * Uma altura em `vh` passa da area visivel enquanto a barra esta na tela.
 */
export const MODAL_TELA_CHEIA =
  "max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0";

/**
 * O invólucro interno do modal de tela cheia.
 *
 * Esses modais usam `p-0` e montam por dentro um `flex flex-col` com cabecalho
 * fixo e corpo `min-h-0 flex-1 overflow-y-auto`. O `DialogContent` e um `grid`,
 * entao `h-full` no filho resolveria contra uma trilha de altura automatica —
 * circular. Repetir a altura em `dvh` e o que faz o `flex-1` ter contra o que
 * crescer.
 */
export const MODAL_TELA_CHEIA_CORPO = "max-sm:h-[100dvh] max-sm:max-h-[100dvh]";
