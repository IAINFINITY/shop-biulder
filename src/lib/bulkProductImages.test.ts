import { describe, expect, it } from "vitest";

import {
  groupBulkMatchesByProduct,
  matchBulkImages,
  parseBulkImageFileName,
  summarizeBulkMatches,
} from "@/lib/bulkProductImages";

function makeFile(name: string): File {
  return new File(["x"], name, { type: "image/webp" });
}

const PRODUCTS = [
  { id: "p1", name: "Chá Mais Camomila", product_code: "12336" },
  { id: "p2", name: "Creatina Monohidratada", product_code: "51" },
  { id: "p3", name: "Sem código", product_code: null },
];

describe("nome do arquivo", () => {
  it("lê código sem posição como capa", () => {
    expect(parseBulkImageFileName("12336.webp")).toEqual({ code: "12336", position: 1 });
  });

  it("lê posição com underscore e com hífen", () => {
    expect(parseBulkImageFileName("12336_2.jpg")).toEqual({ code: "12336", position: 2 });
    expect(parseBulkImageFileName("12336-3.png")).toEqual({ code: "12336", position: 3 });
  });

  it("tolera sufixo de editor", () => {
    // Baixar a mesma foto duas vezes nao pode quebrar o casamento.
    expect(parseBulkImageFileName("12336_1 (1).webp")).toEqual({ code: "12336", position: 1 });
    expect(parseBulkImageFileName("12336 copy.webp")).toEqual({ code: "12336", position: 1 });
  });

  it("normaliza a caixa e preserva hífen do código", () => {
    // Codigos reais usam hifen (o proprio admin sugere "CHA-001"), entao so o
    // ultimo separador seguido de digito conta como posicao.
    expect(parseBulkImageFileName("cha-001_2.webp")).toEqual({ code: "CHA-001", position: 2 });
    expect(parseBulkImageFileName("cha-001.webp")).toEqual({ code: "CHA-001", position: 1 });
  });

  it("recusa nome vazio", () => {
    expect(parseBulkImageFileName(".webp")).toBeNull();
  });
});

describe("casamento com o catálogo", () => {
  it("marca capa e galeria pelo sufixo", () => {
    const matches = matchBulkImages([makeFile("12336_1.webp"), makeFile("12336_2.webp")], PRODUCTS);
    expect(matches.map((match) => match.status)).toEqual(["capa", "galeria"]);
    expect(matches[0].productId).toBe("p1");
  });

  it("sinaliza arquivo sem produto correspondente", () => {
    const [match] = matchBulkImages([makeFile("99999.webp")], PRODUCTS);
    expect(match.status).toBe("sem-produto");
    expect(match.productId).toBeNull();
  });

  it("sinaliza arquivo que não é imagem", () => {
    const [match] = matchBulkImages([new File(["x"], "12336.pdf")], PRODUCTS);
    expect(match.status).toBe("invalido");
  });

  it("ignora produto sem código cadastrado", () => {
    // Sem codigo nao ha como casar: precisa aparecer como pendencia, nunca
    // receber a foto de outro produto por engano.
    const [match] = matchBulkImages([makeFile("sem-codigo.webp")], PRODUCTS);
    expect(match.status).toBe("sem-produto");
  });

  it("agrupa por produto em ordem de posição", () => {
    const matches = matchBulkImages(
      [makeFile("12336_2.webp"), makeFile("51.webp"), makeFile("12336_1.webp")],
      PRODUCTS,
    );
    const groups = groupBulkMatchesByProduct(matches);

    expect(groups).toHaveLength(2);
    const camomila = groups.find((group) => group.productId === "p1");
    expect(camomila?.matches.map((match) => match.position)).toEqual([1, 2]);
  });

  it("resume o lote", () => {
    const matches = matchBulkImages(
      [makeFile("12336_1.webp"), makeFile("12336_2.webp"), makeFile("99999.webp"), new File(["x"], "nota.txt")],
      PRODUCTS,
    );
    expect(summarizeBulkMatches(matches)).toEqual({
      total: 4,
      capas: 1,
      galeria: 1,
      semProduto: 1,
      invalidos: 1,
    });
  });
});
