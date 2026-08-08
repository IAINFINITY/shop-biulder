import { flushSync } from "react-dom";

/**
 * Roda uma mudanca de tela dentro de uma View Transition do navegador.
 *
 * ## Por que existe, se o projeto ja passa `viewTransition` nos `<Link>`
 *
 * Porque aqueles nao funcionam. Medido em 08/08: navegando do catalogo para um
 * produto por um `<Link viewTransition>`, `document.startViewTransition` foi
 * chamado **zero vezes**.
 *
 * No react-router 6 a opcao `viewTransition` so vale com data router
 * (`createBrowserRouter` + `RouterProvider`). O `App.tsx` usa `<BrowserRouter>`
 * com `<Routes>`, e nesse modo a prop e ignorada em silencio — sem aviso, sem
 * erro. O CSS de `::view-transition-old(root)` em `index.css` nunca chegou a
 * pintar nada.
 *
 * Migrar para data router resolveria tudo de uma vez, mas mexe na estrutura de
 * rotas inteira, inclusive nos tres desvios de guarda do `AppRoutes`. Esta
 * funcao e o caminho contido: usa a API do navegador direto, funciona com o
 * roteador atual e aproveita o CSS que ja existe.
 *
 * ## `flushSync`
 *
 * O navegador fotografa a tela, roda o callback e fotografa de novo. Se a
 * atualizacao do React ficar agendada para depois, ele fotografa duas vezes o
 * mesmo quadro e nao ha o que animar. `flushSync` obriga o DOM a mudar dentro
 * da janela.
 *
 * ## Sem suporte, segue reto
 *
 * Safari antigo e Firefox nao tem `startViewTransition`. Nesses, a navegacao
 * acontece igual a antes — sem animacao, sem quebrar.
 */
export function comTransicaoDeTela(mudarDeTela: () => void): void {
  const iniciar = (document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  }).startViewTransition;

  if (typeof iniciar !== "function") {
    mudarDeTela();
    return;
  }

  iniciar.call(document, () => {
    flushSync(mudarDeTela);
  });
}
