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
