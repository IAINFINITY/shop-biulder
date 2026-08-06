import { describe, expect, it } from "vitest";
import {
  normalizarSubcategorias,
  produtoTemSubcategoria,
  subcategoriaPrincipal,
  subcategoriasDoProduto,
} from "@/lib/subcategorias";

describe("subcategoriasDoProduto", () => {
  it("usa a lista quando ela existe", () => {
    expect(subcategoriasDoProduto({ family: "Chás", families: ["Chás", "Fibras"] })).toEqual([
      "Chás",
      "Fibras",
    ]);
  });

  it("cai para a principal enquanto a lista nao existir", () => {
    // Estado de qualquer produto antes da migration rodar. Sem essa queda o
    // produto sumiria da arvore de filtros no intervalo entre o deploy e a
    // migration.
    expect(subcategoriasDoProduto({ family: "Chás" })).toEqual(["Chás"]);
    expect(subcategoriasDoProduto({ family: "Chás", families: null })).toEqual(["Chás"]);
    expect(subcategoriasDoProduto({ family: "Chás", families: [] })).toEqual(["Chás"]);
  });

  it("descarta vazio, espaco e repetido", () => {
    expect(
      subcategoriasDoProduto({ family: "Chás", families: ["Chás", "  ", "Chás", " Fibras "] }),
    ).toEqual(["Chás", "Fibras"]);
  });

  it("produto sem subcategoria nenhuma devolve lista vazia", () => {
    expect(subcategoriasDoProduto({ family: null })).toEqual([]);
    expect(subcategoriasDoProduto({ family: "   " })).toEqual([]);
  });
});

describe("subcategoriaPrincipal", () => {
  it("e a primeira da lista, e nao a alfabetica", () => {
    // A ordem em que se marca decide qual e a principal.
    expect(subcategoriaPrincipal({ family: "Fibras", families: ["Fibras", "Chás"] })).toBe("Fibras");
  });

  it("sem subcategoria, devolve string vazia em vez de quebrar", () => {
    expect(subcategoriaPrincipal({ family: null })).toBe("");
  });
});

describe("produtoTemSubcategoria", () => {
  const produto = { family: "Chás", families: ["Chás", "Fibras"] };

  it("reconhece qualquer uma da lista, e nao so a principal", () => {
    // E o ponto do recurso: filtrar por "Fibras" tem de trazer este produto,
    // mesmo com "Chás" sendo a principal.
    expect(produtoTemSubcategoria(produto, "Chás")).toBe(true);
    expect(produtoTemSubcategoria(produto, "Fibras")).toBe(true);
  });

  it("ignora espaco em volta", () => {
    expect(produtoTemSubcategoria(produto, "  Fibras ")).toBe(true);
  });

  it("recusa o que nao esta na lista e a busca vazia", () => {
    expect(produtoTemSubcategoria(produto, "Vitaminas")).toBe(false);
    expect(produtoTemSubcategoria(produto, "  ")).toBe(false);
  });
});

describe("normalizarSubcategorias", () => {
  it("preserva a ordem escolhida — a primeira vira a principal", () => {
    expect(normalizarSubcategorias(["Fibras", "Chás"])).toEqual(["Fibras", "Chás"]);
  });

  it("limpa repetido e vazio", () => {
    expect(normalizarSubcategorias([" Chás ", "Chás", "", "Fibras"])).toEqual(["Chás", "Fibras"]);
  });
});
