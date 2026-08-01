import { describe, expect, it } from "vitest";
import { buildCustomerPriceMap, calculateCartSubtotal, mergePriceLayers, resolveProductPrice } from "./pricing";
import type { Product } from "./products";

const produto = (overrides: Partial<Product> = {}): Product =>
  ({
    id: "p1",
    name: "Chá Mais - Anis-estrelado",
    description: "",
    brand: null,
    type: "Chá",
    family: "Chá",
    image_url: null,
    image_urls: null,
    image_alts: null,
    image_fit: "cover",
    image_width: null,
    image_height: null,
    active: true,
    is_promotion: false,
    is_featured: false,
    price: 4.84,
    compare_at_price: null,
    stock: null,
    product_code: "2188",
    visible_to: null,
    created_at: "",
    updated_at: "",
    average_rating: 0,
    review_count: 0,
    ...overrides,
  }) as Product;

describe("preço do produto", () => {
  it("usa o preço de cadastro quando o cliente não tem tabela", () => {
    expect(resolveProductPrice(produto(), new Map())).toBe(4.84);
  });

  it("usa a tabela do cliente quando existe", () => {
    const mapa = buildCustomerPriceMap([{ product_code: "2188", price: 4.89 }]);
    expect(resolveProductPrice(produto(), mapa)).toBe(4.89);
  });

  it("acha a tabela mesmo com o código em caixa diferente", () => {
    const mapa = buildCustomerPriceMap([{ product_code: "cha-001", price: 3.5 }]);
    expect(resolveProductPrice(produto({ product_code: "CHA-001" }), mapa)).toBe(3.5);
  });

  /**
   * A pagina do produto aplicava 10% sobre o preco e chamava aquilo de "preco a
   * vista". O desconto nao existia em lugar nenhum: um produto de R$ 4,84
   * aparecia por R$ 4,36 na pagina e voltava a R$ 4,84 no carrinho.
   *
   * O teto contra isso e a invariante abaixo: o que uma unidade custa no
   * carrinho tem de ser exatamente o preco resolvido, sem transformacao no
   * caminho.
   */
  it("uma unidade no carrinho custa exatamente o preço resolvido", () => {
    const p = produto();
    const mapa = buildCustomerPriceMap([{ product_code: "2188", price: 4.89 }]);
    const cart = [{ product: p, quantity: 1 }];

    expect(calculateCartSubtotal(cart, mapa)).toBe(resolveProductPrice(p, mapa));
    expect(calculateCartSubtotal(cart, new Map())).toBe(resolveProductPrice(p, new Map()));
  });

  /**
   * A tabela 8728 chegou do Proxis com 143 dos 156 itens em zero. Zero numa
   * tabela de preco significa "nao precificado aqui", nunca "de graca": aceito
   * como preco, o produto ia para a vitrine e para o pedido por R$ 0,00.
   */
  it("preço zero na tabela não vale como preço", () => {
    const mapa = buildCustomerPriceMap([{ product_code: "2188", price: 0 }]);
    expect(mapa.has("2188")).toBe(false);
    expect(resolveProductPrice(produto(), mapa)).toBe(4.84);
  });

  it("preço negativo também é descartado", () => {
    const mapa = buildCustomerPriceMap([{ product_code: "2188", price: -1 }]);
    expect(resolveProductPrice(produto(), mapa)).toBe(4.84);
  });

  it("o total é múltiplo exato do preço unitário", () => {
    const p = produto();
    const mapa = new Map<string, number>();
    for (const quantidade of [1, 3, 7]) {
      const esperado = Math.round(resolveProductPrice(p, mapa) * quantidade * 100) / 100;
      expect(calculateCartSubtotal([{ product: p, quantity: quantidade }], mapa)).toBe(esperado);
    }
  });
});

describe("camadas de preço", () => {
  const geral = buildCustomerPriceMap([
    { product_code: "2188", price: 4.85 },
    { product_code: "5037", price: 60.0 },
  ]);

  it("a tabela do cliente vence a geral", () => {
    const doCliente = buildCustomerPriceMap([{ product_code: "2188", price: 3.55 }]);
    expect(mergePriceLayers(geral, doCliente).get("2188")).toBe(3.55);
  });

  /**
   * As tabelas do Proxis sao parciais: a 8728 lista 138 dos 143 produtos do
   * catalogo. O que ela nao lista tem de cair no preco cheio da tabela geral,
   * nao no preco de cadastro.
   */
  it("o que a tabela do cliente não lista cai na geral", () => {
    const doCliente = buildCustomerPriceMap([{ product_code: "2188", price: 3.55 }]);
    expect(mergePriceLayers(geral, doCliente).get("5037")).toBe(60.0);
  });

  it("sem tabela do cliente, vale a geral inteira", () => {
    expect(mergePriceLayers(geral, new Map())).toEqual(geral);
  });

  it("zero na tabela do cliente não derruba o preço da geral", () => {
    // Zero nao entra no mapa, entao a camada de baixo continua valendo.
    const doCliente = buildCustomerPriceMap([{ product_code: "2188", price: 0 }]);
    expect(mergePriceLayers(geral, doCliente).get("2188")).toBe(4.85);
  });
});
