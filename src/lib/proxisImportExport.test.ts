import { describe, it, expect } from "vitest";
import {
  PROXIS_IMPORT_COLUMN_COUNT,
  buildProxisImportFileContent,
  buildProxisImportLines,
  formatProxisImportLine,
} from "@/lib/proxisImportExport";

describe("proxisImportExport", () => {
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
      "",
      "",
      "1",
    ]);
    expect(line).toBe("7;4163851000106;5;10;;25/05/2026;25/05/2026;;14;1;;;1");
    expect(line.split(";")).toHaveLength(PROXIS_IMPORT_COLUMN_COUNT);
  });

  it("repete o mesmo ID em todas as linhas do pedido", () => {
    const lines = buildProxisImportLines(
      {
        proxisImportId: 7,
        customerCnpj: "41.638.510/0010-6",
        createdAt: "2026-05-25T12:00:00.000Z",
        items: [
          { product_code: "5", name: "A", quantity: 10, unit_price: 0, line_total: 0 },
          { product_code: "35", name: "B", quantity: 3, unit_price: 0, line_total: 0 },
        ],
      },
      "14",
    );

    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith("7;4163851000106;5;10;")).toBe(true);
    expect(lines[1].startsWith("7;4163851000106;35;3;")).toBe(true);
  });

  it("monta arquivo com quebra de linha final", () => {
    const content = buildProxisImportFileContent([
      {
        proxisImportId: 8,
        customerCnpj: "12141138930",
        createdAt: "2026-05-25T12:00:00.000Z",
        items: [{ product_code: "12", name: "C", quantity: 2, unit_price: 0, line_total: 0 }],
      },
    ]);
    expect(content.endsWith("\n")).toBe(true);
    expect(content.trim().split("\n")).toHaveLength(1);
  });
});
