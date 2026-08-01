import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Rola ate a ancora indicada no hash da URL.
 *
 * O React Router nao faz isso sozinho: `<Link to="/ajuda#pedidos">` troca a rota
 * e para por ai. Era por isso que os atalhos da "Ajuda rápida" no rodape pareciam
 * mortos — e, quando o usuario ja estava em /ajuda, o clique nao produzia efeito
 * nenhum, porque so o hash mudava.
 *
 * Depende de `location.hash` (e nao apenas de um efeito de montagem) justamente
 * para cobrir esse segundo caso.
 */
export function useHashScroll() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    const targetId = hash.replace(/^#/, "");

    if (!targetId) {
      // Sem ancora, navegacao normal comeca no topo.
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }

    let cancelled = false;

    // A secao pode ainda nao estar montada (rota lazy, conteudo filtrado):
    // tenta de novo por alguns frames antes de desistir.
    const scrollToTarget = (attempt: number) => {
      if (cancelled) return;

      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (attempt < 10) {
        requestAnimationFrame(() => scrollToTarget(attempt + 1));
      }
    };

    requestAnimationFrame(() => scrollToTarget(0));

    return () => {
      cancelled = true;
    };
  }, [hash, pathname]);
}
