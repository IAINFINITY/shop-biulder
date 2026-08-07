import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductSummaryCard } from "@/components/catalogo/ProductSummaryCard";

/**
 * O selo "Texto gerado por IA" e uma afirmacao sobre a origem do texto.
 *
 * Errar para mais — marcar como gerado o recorte da descricao, que uma pessoa
 * escreveu — e o erro que estraga o selo: se ele aparece em texto humano,
 * ninguem tem motivo para acreditar nele quando aparece em texto de maquina.
 * Por isso o teste cobre os dois sentidos, e nao so o caso feliz.
 */
const DESCRICAO = "<p>Suplemento em cápsulas. Contém óleo de peixe. Sem glúten.</p>";

describe("ProductSummaryCard", () => {
  it("mostra o selo quando o texto veio do resumo do painel", () => {
    render(
      <ProductSummaryCard
        description={DESCRICAO}
        aiSummary={"Contém óleo de peixe.\nNão é vegano.\nSem glúten."}
      />,
    );
    expect(screen.getByText("Texto gerado por IA")).toBeInTheDocument();
    expect(screen.getByText("Não é vegano.")).toBeInTheDocument();
  });

  it("não mostra o selo quando cai no recorte da descrição", () => {
    render(<ProductSummaryCard description={DESCRICAO} />);
    expect(screen.queryByText("Texto gerado por IA")).toBeNull();
  });

  it("resumo vazio ou só espaço conta como ausente", () => {
    for (const vazio of [null, "", "   \n  "]) {
      const { unmount } = render(<ProductSummaryCard description={DESCRICAO} aiSummary={vazio} />);
      expect(screen.queryByText("Texto gerado por IA"), String(vazio)).toBeNull();
      unmount();
    }
  });
});
