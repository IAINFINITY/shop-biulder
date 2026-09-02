import { describe, it, expect } from "vitest";
import {
  PROXIS_IMPORT_COLUMN_COUNT,
  buildProxisImportFileContent,
  buildProxisImportLines,
  foccoImportFileName,
  formatProxisImportLine,
} from "@/lib/foccoImportExport";

describe("foccoImportExport", () => {
  it("formata linha com 13 colunas e campos vazios sem NULL", () => {
    const line = formatProxisImportLine([
      "7",
      "4163851000106",
      "5",
      "10",
      "",
      "25/05/2026",
      "25/05/2026",
      "",
      "14",
      "1",
      "8728",
      "356",
      "",
    ]);
    expect(line).toBe("7;4163851000106;5;10;;25/05/2026;25/05/2026;;14;1;8728;356;");
    expect(line.split(";")).toHaveLength(PROXIS_IMPORT_COLUMN_COUNT);
  });

  it("repete o mesmo ID em todas as linhas do pedido", () => {
    const lines = buildProxisImportLines(
      {
        proxisImportId: 7,
        customerCnpj: "41.638.510/0010-6",
        customerTprId: 8278,
        createdAt: "2026-05-25T12:00:00.000Z",
        items: [
          { product_code: "5", name: "A", quantity: 10, unit_price: 0, line_total: 0 },
          { product_code: "35", name: "B", quantity: 3, unit_price: 0, line_total: 0 },
        ],
      },
    );

    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith("7;4163851000106;5;10;")).toBe(true);
    expect(lines[0]).toContain(";1;8728;356;");
    expect(lines[1].startsWith("7;4163851000106;35;3;")).toBe(true);
    expect(lines[1]).toContain(";1;8728;356;");
  });

  it("monta arquivo com quebra de linha final", () => {
    const content = buildProxisImportFileContent([
      {
        proxisImportId: 8,
        customerCnpj: "12141138930",
        customerTprId: null,
        createdAt: "2026-05-25T12:00:00.000Z",
        items: [{ product_code: "12", name: "C", quantity: 2, unit_price: 0, line_total: 0 }],
      },
    ]);
    expect(content.endsWith("\n")).toBe(true);
    expect(content.trim().split("\n")).toHaveLength(1);
  });
});

/**
 * Os dois arquivos: Hilê e Net Nature.
 *
 * ## O pedido, em 02/09/2026
 *
 * "o mesmo item não pode ficar na divisão de venda 1 na ILE e na NET, então
 * precisei criar a divisão de venda 2 dentro da Net Nature (…) a única
 * alteração diferente entre esses dois arquivos é esse número 1 da divisão de
 * venda, onde na NET é 2 e não 1."
 *
 * ⚠️ Estes testes existem para garantir a segunda metade dessa frase: que a
 * divisão de venda é a **única** diferença. Um campo que mudasse junto por
 * descuido — data, tabela, condição de pagamento — só apareceria dentro do
 * FOCCO, depois de importado.
 */
describe("divisão de venda por empresa", () => {
  const pedido = {
    proxisImportId: 9,
    customerCnpj: "41.638.510/0010-6",
    customerTprId: 8728,
    createdAt: "2026-05-25T12:00:00.000Z",
    items: [
      { product_code: "5", name: "A", quantity: 10, unit_price: 0, line_total: 0 },
      { product_code: "35", name: "B", quantity: 3, unit_price: 0, line_total: 0 },
    ],
  };

  it("a Hilê é a divisão 1, como sempre foi", () => {
    const [linha] = buildProxisImportLines(pedido, "hile");
    expect(linha.split(";")[9]).toBe("1");
  });

  it("a Net Nature é a divisão 2", () => {
    const [linha] = buildProxisImportLines(pedido, "net");
    expect(linha.split(";")[9]).toBe("2");
  });

  it("⚠️ nada mais muda entre os dois arquivos", () => {
    const hile = buildProxisImportLines(pedido, "hile");
    const net = buildProxisImportLines(pedido, "net");

    expect(net).toHaveLength(hile.length);
    hile.forEach((linha, indice) => {
      const a = linha.split(";");
      const b = net[indice].split(";");
      // Todas as colunas, menos a 9 — que é justamente a divisão de venda.
      a.forEach((valor, coluna) => {
        if (coluna === 9) return;
        expect(b[coluna], `coluna ${coluna} da linha ${indice}`).toBe(valor);
      });
    });
  });

  it("sem dizer a empresa, sai o arquivo da Hilê — o que já existia", () => {
    expect(buildProxisImportLines(pedido)).toEqual(buildProxisImportLines(pedido, "hile"));
    expect(buildProxisImportFileContent([pedido])).toBe(buildProxisImportFileContent([pedido], "hile"));
  });

  // Os dois arquivos do mesmo pedido não podem colidir na pasta de downloads:
  // o segundo viraria "… (1).txt" e ninguém saberia qual é de qual empresa.
  it("o nome do arquivo diz a empresa", () => {
    expect(foccoImportFileName(9, "2026-05-25T12:00:00.000Z", "hile")).toContain("focco-hile-9");
    expect(foccoImportFileName(9, "2026-05-25T12:00:00.000Z", "net")).toContain("focco-net-9");
    expect(foccoImportFileName(9, "2026-05-25T12:00:00.000Z", "hile")).not.toBe(
      foccoImportFileName(9, "2026-05-25T12:00:00.000Z", "net"),
    );
  });
});
