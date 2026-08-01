import { describe, expect, it } from "vitest";
import { highlightBadgeClassName, highlightForProduct } from "./productHighlights";

const produto = (over: Partial<{ id: string; is_promotion: boolean; is_featured: boolean }> = {}) => ({
  id: "p1",
  is_promotion: false,
  is_featured: false,
  ...over,
});

describe("selo do produto", () => {
  it("sem nada marcado e sem venda, não mostra selo", () => {
    expect(highlightForProduct(produto(), new Set())).toBeNull();
  });

  it("reconhece cada um dos três sinais", () => {
    expect(highlightForProduct(produto({ is_promotion: true }), new Set())?.label).toBe("Promoção");
    expect(highlightForProduct(produto({ is_featured: true }), new Set())?.label).toBe("Destaque");
    expect(highlightForProduct(produto(), new Set(["p1"]))?.label).toBe("Mais vendido");
  });

  /**
   * Um selo por card. Empilhar dois ou tres roubaria a leitura de relance que o
   * selo existe para dar; a ordem e por utilidade para quem compra.
   */
  it("com mais de um sinal, mostra o que faz agir", () => {
    const tudo = produto({ is_promotion: true, is_featured: true });
    expect(highlightForProduct(tudo, new Set(["p1"]))?.label).toBe("Promoção");

    const destaqueEVenda = produto({ is_featured: true });
    expect(highlightForProduct(destaqueEVenda, new Set(["p1"]))?.label).toBe("Destaque");
  });

  it("só entra em 'mais vendido' quem está na lista de vendas", () => {
    expect(highlightForProduct(produto({ id: "outro" }), new Set(["p1"]))).toBeNull();
  });

  it("as três cores saem da paleta do projeto, sem matiz de fora", () => {
    const classes = [
      highlightBadgeClassName("destructive"),
      highlightBadgeClassName("warm"),
      highlightBadgeClassName("success"),
    ].join(" ");

    // Antes eram vermelho, ambar e verde esmeralda — dois matizes de fora.
    expect(classes).not.toMatch(/emerald|amber|sky|violet|orange/);
    expect(highlightBadgeClassName("destructive")).toContain("bg-primary");
    expect(highlightBadgeClassName("warm")).toContain("bg-primary/10");
    expect(highlightBadgeClassName("success")).toContain("bg-foreground");
  });
});
