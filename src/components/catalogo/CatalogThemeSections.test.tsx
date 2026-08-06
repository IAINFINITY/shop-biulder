import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CatalogThemeSections } from "@/components/catalogo/CatalogThemeSections";

/**
 * O esqueleto so pode aparecer enquanto ha o que esperar.
 *
 * Ja quebrou duas vezes. Na segunda, `carregando` estava declarado como segundo
 * parametro da funcao em vez de dentro das props: o React passa o contexto
 * legado ali, um `{}`, que e verdadeiro — entao o componente se achava eternamente
 * carregando e o topo do catalogo ficava com cartoes cinza pulsando. `tsc` nao
 * pega, porque a assinatura e valida; so renderizando de verdade da para ver.
 */
function renderizar(props: Partial<Parameters<typeof CatalogThemeSections>[0]> = {}) {
  return render(
    <MemoryRouter>
      <CatalogThemeSections
        sections={[]}
        resolvePrice={() => 10}
        resolvePrecoBase={() => 10}
        onAdd={vi.fn()}
        inCartIds={new Set<string>()}
        wishlistIds={[]}
        onToggleWishlist={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("CatalogThemeSections", () => {
  it("sem prateleira e sem carregar, nao desenha nada", () => {
    const { container } = renderizar({ carregando: false });
    expect(container.querySelectorAll(".animate-shimmer")).toHaveLength(0);
    expect(container.textContent).toBe("");
  });

  it("`carregando` omitido vale o mesmo que falso — nao existe esqueleto por acidente", () => {
    const { container } = renderizar();
    expect(container.querySelectorAll(".animate-shimmer")).toHaveLength(0);
  });

  it("carregando, mostra o esqueleto", () => {
    const { container } = renderizar({ carregando: true });
    expect(container.querySelectorAll(".animate-shimmer").length).toBeGreaterThan(0);
  });
});
