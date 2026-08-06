import { describe, expect, it } from "vitest";
import {
  alternarFavorito,
  definirQuantidade,
  itensParaCarrinho,
  MAX_FAVORITOS,
  mesclarFavoritos,
  normalizarQuantidade,
  parseFavoritosArmazenados,
  promoverFavorito,
  type ItemFavorito,
} from "@/lib/favoritos";

const item = (productId: string, quantity = 1): ItemFavorito => ({ productId, quantity });

describe("normalizarQuantidade", () => {
  it("recusa zero, negativo e fracionado", () => {
    expect(normalizarQuantidade(0)).toBe(1);
    expect(normalizarQuantidade(-5)).toBe(1);
    expect(normalizarQuantidade(2.4)).toBe(2);
  });

  it("nao deixa passar do teto que o banco aceita", () => {
    expect(normalizarQuantidade(999999)).toBe(9999);
  });

  it("sobrevive a NaN vindo de campo vazio", () => {
    expect(normalizarQuantidade(Number.NaN)).toBe(1);
  });
});

describe("alternarFavorito", () => {
  it("adiciona no topo e remove quando ja existe", () => {
    const comA = alternarFavorito([], "a");
    expect(comA).toEqual([item("a")]);

    const comB = alternarFavorito(comA, "b");
    expect(comB.map((i) => i.productId)).toEqual(["b", "a"]);

    expect(alternarFavorito(comB, "b").map((i) => i.productId)).toEqual(["a"]);
  });

  it("nao passa do teto da lista", () => {
    const cheia = Array.from({ length: MAX_FAVORITOS }, (_, i) => item(`p${i}`));
    expect(alternarFavorito(cheia, "novo")).toHaveLength(MAX_FAVORITOS);
  });
});

describe("definirQuantidade", () => {
  it("muda so o item alvo e normaliza o valor", () => {
    const lista = [item("a", 3), item("b", 1)];

    expect(definirQuantidade(lista, "a", 0)).toEqual([item("a", 1), item("b", 1)]);
    expect(definirQuantidade(lista, "b", 7)).toEqual([item("a", 3), item("b", 7)]);
  });
});

describe("promoverFavorito", () => {
  it("move para o topo sem duplicar", () => {
    const lista = [item("a"), item("b"), item("c")];

    expect(promoverFavorito(lista, item("c", 4)).map((i) => i.productId)).toEqual(["c", "a", "b"]);
    expect(promoverFavorito(lista, item("c", 4))[0].quantity).toBe(4);
  });
});

describe("mesclarFavoritos", () => {
  it("junta o que estava no aparelho com o que estava na conta", () => {
    const local = [item("a"), item("b")];
    const remoto = [item("c")];

    expect(mesclarFavoritos(local, remoto).map((i) => i.productId)).toEqual(["c", "a", "b"]);
  });

  it("deixa a conta vencer a quantidade nos repetidos", () => {
    // O 5 foi escolhido por alguem logado; o 1 local pode ser so o clique no
    // coracao, sem ninguem pensar em quantidade.
    const mesclado = mesclarFavoritos([item("a", 1)], [item("a", 5)]);

    expect(mesclado).toEqual([item("a", 5)]);
  });

  it("poe o remoto primeiro, porque so ele tem data de verdade", () => {
    const mesclado = mesclarFavoritos([item("local")], [item("r1"), item("r2")]);

    expect(mesclado.map((i) => i.productId)).toEqual(["r1", "r2", "local"]);
  });

  it("respeita o teto mesmo somando as duas listas", () => {
    const local = Array.from({ length: 150 }, (_, i) => item(`l${i}`));
    const remoto = Array.from({ length: 150 }, (_, i) => item(`r${i}`));

    expect(mesclarFavoritos(local, remoto)).toHaveLength(MAX_FAVORITOS);
  });

  it("nao perde a lista do convidado quando a conta esta vazia", () => {
    expect(mesclarFavoritos([item("a"), item("b")], [])).toHaveLength(2);
  });
});

describe("parseFavoritosArmazenados", () => {
  it("le o formato antigo, que era so uma lista de ids", () => {
    expect(parseFavoritosArmazenados('["a","b"]')).toEqual([item("a"), item("b")]);
  });

  it("le o formato novo, com quantidade", () => {
    expect(parseFavoritosArmazenados('[{"productId":"a","quantity":3}]')).toEqual([item("a", 3)]);
  });

  it("aceita os dois misturados, que e o que acontece na migracao", () => {
    expect(parseFavoritosArmazenados('["a",{"productId":"b","quantity":2}]')).toEqual([
      item("a"),
      item("b", 2),
    ]);
  });

  it("devolve lista vazia para nulo, JSON quebrado e formato inesperado", () => {
    expect(parseFavoritosArmazenados(null)).toEqual([]);
    expect(parseFavoritosArmazenados("{ nao e json")).toEqual([]);
    expect(parseFavoritosArmazenados('{"a":1}')).toEqual([]);
  });

  it("descarta entrada sem id utilizavel e remove repetidos", () => {
    expect(parseFavoritosArmazenados('["a","","a",{"productId":""},{"quantity":2}]')).toEqual([
      item("a"),
    ]);
  });
});

describe("itensParaCarrinho", () => {
  const produtos = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("leva so o que esta selecionado, na ordem da lista", () => {
    const itens = [item("a", 2), item("b", 1), item("c", 4)];

    expect(itensParaCarrinho(itens, new Set(["c", "a"]), produtos)).toEqual([
      { produto: { id: "a" }, quantidade: 2 },
      { produto: { id: "c" }, quantidade: 4 },
    ]);
  });

  it("ignora em silencio o id que nao resolve em produto", () => {
    // Produto sai de linha e volta. A lista guarda id, entao ela sobrevive ao
    // sumico — mas a acao em lote nao pode quebrar por causa dele.
    const itens = [item("a", 1), item("saiu-de-linha", 3)];

    expect(itensParaCarrinho(itens, new Set(["a", "saiu-de-linha"]), produtos)).toEqual([
      { produto: { id: "a" }, quantidade: 1 },
    ]);
  });

  it("devolve vazio quando nada esta selecionado", () => {
    expect(itensParaCarrinho([item("a")], new Set(), produtos)).toEqual([]);
  });
});
