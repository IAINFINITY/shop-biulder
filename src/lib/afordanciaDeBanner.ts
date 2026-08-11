/**
 * O comportamento visual de um banner clicavel — num lugar so.
 *
 * ## Por que existe
 *
 * Havia duas copias disso: `AFFORDANCE` dentro de `StoreHeroBanner.tsx` e
 * `afordancia` dentro de `PromoBanners.tsx`. Nasceram iguais e ja tinham
 * divergido — o topo levantava a arte 2% e nao movia a peca; as outras areas
 * levantavam 4% e subiam a peca 4px. Ninguem decidiu isso; foi o resultado de
 * corrigir uma e esquecer a outra.
 *
 * Com um modulo so, mudar o efeito muda em todo banner do site.
 *
 * ## O clique
 *
 * O efeito de pressionar usa `active:`, que o navegador aplica **enquanto** o
 * botao esta apertado, e nao um `setTimeout` antes de navegar. A diferenca
 * importa: segurar a navegacao para exibir uma animacao deixa o site mais lento
 * de verdade em troca de parecer mais elaborado. Aqui o retorno e imediato e a
 * pagina comeca a carregar no mesmo instante.
 *
 * Links internos ainda passam pelo `viewTransition` do React Router, que faz a
 * transicao entre as duas paginas. As duas coisas se somam: a peca afunda sob o
 * dedo, a pagina transiciona.
 *
 * ## `motion-safe`
 *
 * Todo movimento fica atras de `motion-safe:`. Quem pediu menos animacao no
 * sistema operacional continua tendo sombra e anel de foco — o aviso de que a
 * peca e clicavel nao depende de movimento.
 */
export const AFORDANCIA_DE_BANNER = [
  /**
   * **Nao ponha classe de raio aqui.**
   *
   * Isto e combinado com a moldura de cada area via `cn`, que usa
   * `tailwind-merge`: classes do mesmo grupo se anulam e vence a ultima. Um
   * `rounded-*` neste ponto apaga o `rounded-xl` que a moldura definiu, e a
   * peca fica de canto vivo.
   *
   * Ja aconteceu: a versao unificada nasceu com `rounded-[inherit]`, herdado do
   * banner do topo — onde ele e inofensivo porque o quadro do topo nao tem raio
   * nenhum. Trazido para ca, deixou quadradas exatamente as pecas **com link**,
   * que sao as unicas que recebem estas classes. Quem precisa de raio proprio
   * declara no ponto de uso, depois desta constante.
   */
  "group block overflow-hidden",

  // `transform` na lista de propriedades em transicao: sem ele o afundar do
  // clique aconteceria de um quadro para o outro, sem suavizacao.
  "transition-[box-shadow,transform] duration-300 ease-out",

  // Repousando: nada. Sob o cursor: sobe e ganha sombra funda.
  "hover:shadow-[0_18px_44px_rgba(16,24,40,0.20)] focus-visible:shadow-[0_18px_44px_rgba(16,24,40,0.20)]",
  "motion-safe:hover:-translate-y-1 motion-safe:focus-visible:-translate-y-1",

  // Pressionado: a peca afunda abaixo do repouso e a sombra encolhe, como algo
  // empurrado contra a pagina. `duration-75` porque resposta a toque precisa
  // ser praticamente instantanea — 300ms aqui pareceria travamento.
  "motion-safe:active:translate-y-[1px] motion-safe:active:scale-[0.995]",
  "active:shadow-[0_4px_12px_rgba(16,24,40,0.16)]",
  "active:duration-75",

  // O anel de foco nao e opcional: e o unico aviso para quem navega por teclado.
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",

  // A arte cresce dentro da moldura. `[&_img]` e nao `group-hover:` no proprio
  // elemento: `group-hover:` gera `.group:hover .classe`, que exige um
  // **descendente** — ja houve um caso aqui em que a classe estava no proprio
  // elemento marcado como `group` e o seletor nunca casava com nada.
  "[&_img]:transition-transform [&_img]:duration-500 [&_img]:ease-out",
  "motion-reduce:[&_img]:transition-none",
  "motion-safe:hover:[&_img]:scale-[1.04] motion-safe:focus-visible:[&_img]:scale-[1.04]",
].join(" ");
