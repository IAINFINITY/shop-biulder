// O que a tela responde quando o mouse passa por cima.
//
// ## O que faltava
//
// "eu passo por cima de um produto aqui (…) não acontece nada com o meu mouse,
// nada, não tem um hover (…) banners não têm nada demais (…) pedidos, a mesma
// coisa."
//
// A tela do Dashboard reage a tudo e foi elogiada; as outras não reagiam a
// nada. Onde havia hover, era `hover:bg-muted/20` — 20% de um cinza que já é
// quase branco, sobre fundo branco. Existe no código e não existe no olho.
//
// ## Por que uma constante, e não uma classe utilitária no CSS
//
// A resposta ao mouse é composição de três coisas (borda, sombra, deslocamento)
// e cada tela precisa somá-la ao próprio raio e fundo. Como classe única no
// `@layer`, brigaria com a especificidade de quem já define `border-border/70`.
// Como string do Tailwind passada pelo `cn`, ela se mistura na ordem certa.
//
// ## ⚠️ Nada disso é decoração
//
// O hover responde uma pergunta: **isto aqui é clicável?** Por isso ele só vai
// no que de fato leva a algum lugar. Aplicar num cartão que não faz nada é pior
// que não ter hover nenhum — promete um clique que não existe.

/**
 * Cartão ou linha que abre alguma coisa.
 *
 * Sobe 1px, ganha sombra e tinge a borda de vermelho da marca. O deslocamento é
 * mínimo de propósito: numa lista de 24 linhas, um `-translate-y-1` faz o
 * conteúdo ao redor parecer que treme.
 *
 * `motion-reduce:` desliga o movimento para quem pediu menos animação no
 * sistema — a borda e a sombra continuam, então o aviso de "isto é clicável"
 * não se perde.
 */
export const CARTAO_CLICAVEL =
  "cursor-pointer transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.03] " +
  "hover:shadow-[0_4px_16px_rgba(16,24,40,0.10)] hover:-translate-y-px " +
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/**
 * Miniatura dentro de um cartão clicável.
 *
 * Cresce de leve **junto** com o hover do cartão (daí o `group-hover`), o que
 * dá ao conjunto a sensação de uma peça só reagindo, em vez de dois elementos
 * animando cada um por si. Exige `group` no cartão e `overflow-hidden` na
 * moldura da imagem.
 */
export const IMAGEM_DO_CARTAO =
  "transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100";

/**
 * Ação que aparece só quando o mouse chega no cartão.
 *
 * ⚠️ **Nunca para a ação principal**, e nunca no celular — onde não há hover e
 * o botão simplesmente não apareceria. Serve para o que é secundário e
 * redundante: um "editar" que a linha inteira já faz ao ser clicada.
 */
export const ACAO_NO_HOVER =
  "opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100";
