import { describe, expect, it } from "vitest";

import { dedupeIds, promoteId, resolveProductsByIdOrder, toggleId } from "@/lib/productIdList";

const PRODUCTS = [
  { id: "a", name: "Alfa" },
  { id: "b", name: "Beta" },
  { id: "c", name: "Gama" },
];

describe("ordem da lista", () => {
  it("promove o id para o topo sem duplicar", () => {
    expect(promoteId(["a", "b", "c"], "c", 10)).toEqual(["c", "a", "b"]);
  });

  it("respeita o teto ao promover", () => {
    expect(promoteId(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
  });

  it("alterna adicionando no topo e removendo", () => {
    expect(toggleId(["a", "b"], "c", 10)).toEqual(["c", "a", "b"]);
    expect(toggleId(["a", "b"], "a", 10)).toEqual(["b"]);
  });

  it("remove repetidos mantendo o mais recente", () => {
    expect(dedupeIds(["a", "b", "a", "c", "b"])).toEqual(["a", "b", "c"]);
  });
});

describe("resolução dos produtos", () => {
  it("segue a ordem dos ids, não a do catálogo", () => {
    // O catalogo vem ordenado por nome; a lista precisa sair na ordem salva.
    expect(resolveProductsByIdOrder(["c", "a"], PRODUCTS).map((p) => p.id)).toEqual(["c", "a"]);
  });

  it("ignora id que não existe mais sem quebrar a ordem", () => {
    expect(resolveProductsByIdOrder(["c", "zzz", "a"], PRODUCTS).map((p) => p.id)).toEqual(["c", "a"]);
  });

  it("aplica o limite depois de resolver", () => {
    expect(resolveProductsByIdOrder(["c", "b", "a"], PRODUCTS, 2).map((p) => p.id)).toEqual(["c", "b"]);
  });

  it("devolve vazio quando não há ids ou produtos", () => {
    expect(resolveProductsByIdOrder([], PRODUCTS)).toEqual([]);
    expect(resolveProductsByIdOrder(["a"], [])).toEqual([]);
  });
});
