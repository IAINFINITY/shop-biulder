import { describe, expect, it } from "vitest";
import { mascararCnpj } from "@/lib/pii";

describe("mascararCnpj", () => {
  it("mostra só os quatro últimos dígitos", () => {
    expect(mascararCnpj("04163851000106")).toBe("**********0106");
  });

  it("aceita CNPJ com máscara e chega ao mesmo resultado", () => {
    expect(mascararCnpj("04.163.851/0001-06")).toBe(mascararCnpj("04163851000106"));
  });

  it("nunca deixa passar o documento inteiro", () => {
    const cnpj = "04163851000106";
    const mascarado = mascararCnpj(cnpj);

    expect(mascarado).not.toContain(cnpj);
    expect(mascarado).not.toContain(cnpj.slice(0, 8));
  });

  it("recusa valor fora do formato em vez de devolver a entrada crua", () => {
    // Devolver o valor original seria vazar justamente o que a função esconde.
    expect(mascararCnpj("0416385100010")).toBe("<cnpj invalido>");
    expect(mascararCnpj("")).toBe("<cnpj invalido>");
    expect(mascararCnpj(null)).toBe("<cnpj invalido>");
    expect(mascararCnpj(undefined)).toBe("<cnpj invalido>");
    expect(mascararCnpj("texto qualquer")).toBe("<cnpj invalido>");
  });

  it("mantém dois CNPJs distintos distinguíveis no log", () => {
    // É o uso real: casar duas linhas do mesmo log entre si.
    expect(mascararCnpj("04163851000106")).not.toBe(mascararCnpj("11222333000181"));
  });
});
