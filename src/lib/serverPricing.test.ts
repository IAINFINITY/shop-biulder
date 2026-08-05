import { describe, expect, it } from "vitest";
import {
  buildServerPriceMap,
  diffPrices,
  isValidQuantity,
  normalizeProductCode,
} from "@/lib/serverPricing";
import { buildCustomerPriceMap } from "@/lib/pricing";

describe("buildServerPriceMap", () => {
  it("usa o preço do catálogo quando não há override", () => {
    const map = buildServerPriceMap([{ product_code: "7912", price: 89.9 }], []);

    expect(map.get("7912")).toBe(89.9);
  });

  it("deixa o override vencer o preço do catálogo", () => {
    const map = buildServerPriceMap(
      [{ product_code: "7912", price: 89.9 }],
      [{ product_code: "7912", price: 62.5 }],
    );

    expect(map.get("7912")).toBe(62.5);
  });

  it("compara código sem depender de caixa ou espaço", () => {
    const map = buildServerPriceMap([{ product_code: " 7912 ", price: 89.9 }], [
      { product_code: "7912", price: 62.5 },
    ]);

    expect(map.get(normalizeProductCode("7912"))).toBe(62.5);
    expect(map.size).toBe(1);
  });

  it("descarta preço zero, negativo e não numérico", () => {
    const map = buildServerPriceMap(
      [
        { product_code: "A", price: 0 },
        { product_code: "B", price: -5 },
        { product_code: "C", price: "abc" },
        { product_code: "D", price: null },
      ],
      [],
    );

    expect(map.size).toBe(0);
  });

  it("arredonda para centavos", () => {
    const map = buildServerPriceMap([{ product_code: "7912", price: 10.005 }], []);

    expect(map.get("7912")).toBe(10.01);
  });

  it("mantém a mesma regra de descarte do catálogo do site", () => {
    // `buildCustomerPriceMap` é o que o navegador usa. As duas implementações
    // são separadas por causa do alias `@/`, então o acordo entre elas precisa
    // ficar travado por teste.
    const overrides = [
      { product_code: "7912", price: 62.5 },
      { product_code: "7913", price: 0 },
    ];
    const doNavegador = buildCustomerPriceMap(overrides);
    const doServidor = buildServerPriceMap([], overrides);

    expect([...doServidor.entries()]).toEqual([...doNavegador.entries()]);
  });
});

describe("diffPrices", () => {
  it("aponta divergência de valor e preço ausente", () => {
    const divergentes = diffPrices([
      { code: "A", name: "igual", client_price: 10, server_price: 10 },
      { code: "B", name: "diferente", client_price: 1, server_price: 62.5 },
      { code: "C", name: "sem preço", client_price: 10, server_price: null },
    ]);

    expect(divergentes.map((item) => item.code)).toEqual(["B", "C"]);
  });

  it("não acusa diferença por arredondamento de centavo", () => {
    expect(diffPrices([{ code: "A", name: "a", client_price: 10.004, server_price: 10 }])).toHaveLength(0);
  });
});

describe("isValidQuantity", () => {
  it("aceita inteiro positivo dentro do limite", () => {
    expect(isValidQuantity(1)).toBe(true);
    expect(isValidQuantity(9999)).toBe(true);
  });

  it("recusa zero, negativo, fracionário, texto e acima do teto", () => {
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(-1)).toBe(false);
    expect(isValidQuantity(1.5)).toBe(false);
    expect(isValidQuantity("2")).toBe(true);
    expect(isValidQuantity("abc")).toBe(false);
    expect(isValidQuantity(10000)).toBe(false);
    expect(isValidQuantity(null)).toBe(false);
  });
});
