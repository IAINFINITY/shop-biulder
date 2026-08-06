import { describe, expect, it } from "vitest";
import { highlightBadgeClassName, highlightForProduct } from "./productHighlights";

const produto = (
  over: Partial<{
    id: string;
    is_promotion: boolean;
    is_featured: boolean;
    promo_percent: number | null;
    promo_starts_at: string | null;
    promo_ends_at: string | null;
  }> = {},
) => ({
  id: "p1",
  is_promotion: false,
  is_featured: false,
  promo_percent: null,
  promo_starts_at: null,
  promo_ends_at: null,
  ...over,
});

describe("selo do produto", () => {
  it("sem nada marcado e sem venda, não mostra selo", () => {
    expect(highlightForProduct(produto(), new Set())).toBeNull();
  });

  /**
   * O booleano `is_promotion` nao acende mais o selo.
   *
   * Ele nao tocava em preco: os 4 produtos marcados na loja apareciam com
   * "PROMOCAO" e o valor cheio, prometendo um desconto inexistente. Agora o selo
   * exige percentual valendo.
   */
  it("marcado como promoção mas sem desconto não acende o selo", () => {
    expect(highlightForProduct(produto({ is_promotion: true }), new Set())).toBeNull();
  });

  it("promoção fora da janela também não acende", () => {
    const expirada = produto({ promo_percent: 20, promo_ends_at: "2020-01-01T00:00:00Z" });
    expect(highlightForProduct(expirada, new Set())).toBeNull();
  });

  it("reconhece cada um dos três sinais", () => {
    expect(highlightForProduct(produto({ promo_percent: 15 }), new Set())?.label).toBe("Promoção");
    expect(highlightForProduct(produto({ is_featured: true }), new Set())?.label).toBe("Destaque");
    expect(highlightForProduct(produto(), new Set(["p1"]))?.label).toBe("Mais vendido");
  });

  /**
   * Um selo por card. Empilhar dois ou tres roubaria a leitura de relance que o
   * selo existe para dar; a ordem e por utilidade para quem compra.
   */
  it("com mais de um sinal, mostra o que faz agir", () => {
    const tudo = produto({ promo_percent: 15, is_featured: true });
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
