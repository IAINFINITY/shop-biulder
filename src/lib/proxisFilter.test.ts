import { describe, expect, it } from "vitest";
import { safeItemNumber, safeNumericFilter, safeQuotedLiteral } from "@/lib/proxisFilter";

describe("safeItemNumber", () => {
  it("aceita os formatos de código usados no catálogo", () => {
    expect(safeItemNumber("7912")).toBe("7912");
    expect(safeItemNumber("AB-12.3")).toBe("AB-12.3");
    expect(safeItemNumber(" 7912 ")).toBe("7912");
    expect(safeItemNumber("ab12")).toBe("AB12");
  });

  it("recusa o que quebraria o filtro do ProManager", () => {
    expect(safeItemNumber("7912' or '1'='1")).toBeNull();
    expect(safeItemNumber('7912"')).toBeNull();
    expect(safeItemNumber("7912\nite_numero")).toBeNull();
    expect(safeItemNumber("7912 or 1=1")).toBeNull();
  });

  it("recusa vazio e comprimento fora do limite", () => {
    expect(safeItemNumber("")).toBeNull();
    expect(safeItemNumber("   ")).toBeNull();
    expect(safeItemNumber(null)).toBeNull();
    expect(safeItemNumber("A".repeat(41))).toBeNull();
    expect(safeItemNumber("A".repeat(40))).toBe("A".repeat(40));
  });
});

describe("safeNumericFilter", () => {
  it("aceita inteiro positivo e trunca", () => {
    expect(safeNumericFilter(2871)).toBe(2871);
    expect(safeNumericFilter("2871")).toBe(2871);
    expect(safeNumericFilter(2871.9)).toBe(2871);
  });

  it("recusa zero, negativo e não numérico", () => {
    expect(safeNumericFilter(0)).toBeNull();
    expect(safeNumericFilter(-5)).toBeNull();
    expect(safeNumericFilter("2871 or 1=1")).toBeNull();
    expect(safeNumericFilter(null)).toBeNull();
  });
});

describe("safeQuotedLiteral", () => {
  it("aceita CNPJ nos dois formatos", () => {
    expect(safeQuotedLiteral("04163851000106")).toBe("04163851000106");
    expect(safeQuotedLiteral("04.163.851/0001-06")).toBe("04.163.851/0001-06");
  });

  it("recusa aspas e quebra de linha em vez de tentar escapar", () => {
    expect(safeQuotedLiteral("04163851000106' or '1'='1")).toBeNull();
    expect(safeQuotedLiteral('valor"')).toBeNull();
    expect(safeQuotedLiteral("linha1\nlinha2")).toBeNull();
    expect(safeQuotedLiteral("")).toBeNull();
  });
});
