import { useEffect, useState, type RefObject } from "react";

/**
 * Quantas colunas a grade tem agora, lidas do proprio elemento.
 *
 * Serve para cortar a lista num multiplo de colunas, de modo que a ultima
 * fileira nunca fique pela metade enquanto ainda ha o que carregar.
 *
 * Le do `getComputedStyle` em vez de repetir os breakpoints em JavaScript: as
 * colunas moram no Tailwind (`grid-cols-2 sm:grid-cols-3 xl:grid-cols-4
 * min-[1680px]:grid-cols-5`), e uma segunda copia aqui sairia do lugar no dia em
 * que alguem mexer numa e esquecer da outra. Foi assim que o problema apareceu:
 * o corte era 24, divisivel por 2, 3 e 4, e a quinta coluna passou a deixar
 * sobra sem que ninguem refizesse a conta.
 */
export function useGridColumns(ref: RefObject<HTMLElement>): number {
  const [colunas, setColunas] = useState(1);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento || typeof ResizeObserver === "undefined") return;

    const ler = () => {
      const template = getComputedStyle(elemento).gridTemplateColumns;
      // `gridTemplateColumns` resolvido vem como "259px 259px ..." — uma medida
      // por coluna. Contar os pedacos e mais confiavel que interpretar a regra.
      const total = template.split(" ").filter((parte) => parte.trim() !== "").length;
      setColunas(Math.max(1, total));
    };

    ler();
    const observador = new ResizeObserver(ler);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [ref]);

  return colunas;
}

/**
 * Arredonda para cima ate fechar a fileira.
 *
 * No fim da lista devolve o total: sobra na ultima fileira so confunde quando
 * ainda ha o que carregar. Quando acabou, e o fim mesmo.
 */
export function completarFileira(pedidos: number, colunas: number, total: number): number {
  if (colunas <= 1) return Math.min(pedidos, total);
  return Math.min(Math.ceil(pedidos / colunas) * colunas, total);
}
