import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

/**
 * Observadores que o jsdom nao implementa.
 *
 * O embla — o carrossel usado nas fotos de produto e nos banners — chama os
 * dois ao montar. Sem eles qualquer teste que renderize um carrossel morre com
 * `IntersectionObserver is not defined`, e o erro nao tem nada a ver com o que
 * o teste estava medindo.
 *
 * Sao inertes de proposito: nunca disparam callback. Nenhum teste depende de
 * saber que um elemento entrou na tela ou mudou de tamanho — o que se testa
 * aqui e a logica ao redor, e para isso basta o carrossel montar sem quebrar.
 * Um dublê que inventasse eventos seria pior que nenhum, porque passaria a
 * afirmar coisas que o navegador de verdade nao afirma.
 */
class ObservadorInerte {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

for (const nome of ["IntersectionObserver", "ResizeObserver"] as const) {
  if (!(nome in window)) {
    Object.defineProperty(window, nome, { writable: true, value: ObservadorInerte });
    Object.defineProperty(globalThis, nome, { writable: true, value: ObservadorInerte });
  }
}

/**
 * Rolagem: o jsdom nao implementa nenhuma das tres.
 *
 * A tira de categorias da ajuda chama `scrollTo` ao montar, e o catalogo chama
 * `scrollIntoView` ao trocar de filtro. Sem estes dubles, o teste morre com
 * "scrollTo is not a function" — falha que nao diz nada sobre o codigo, so sobre
 * o que falta no jsdom.
 *
 * Inertes pela mesma razao dos observadores acima: nenhum teste afirma nada
 * sobre posicao de rolagem, e um duble que fingisse rolar afirmaria o que o
 * navegador nao garante. O que se mede aqui e que a tela **monta**.
 */
for (const metodo of ["scrollTo", "scrollBy", "scrollIntoView"] as const) {
  if (!(metodo in Element.prototype)) {
    Object.defineProperty(Element.prototype, metodo, { writable: true, value: () => {} });
  }
}
if (!("scrollTo" in window)) {
  Object.defineProperty(window, "scrollTo", { writable: true, value: () => {} });
}
