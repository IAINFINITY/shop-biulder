import { describe, expect, it } from "vitest";
import { primeiroNome, saudacao, saudacaoDaHora, TRATAMENTO_GENERICO } from "./saudacao";

const as = (hora: number) => new Date(2026, 7, 31, hora, 30);

describe("saudacaoDaHora", () => {
  it("cobre as três faixas do dia", () => {
    expect(saudacaoDaHora(as(8))).toBe("Bom dia");
    expect(saudacaoDaHora(as(14))).toBe("Boa tarde");
    expect(saudacaoDaHora(as(21))).toBe("Boa noite");
  });

  it("acerta as viradas exatas", () => {
    expect(saudacaoDaHora(new Date(2026, 7, 31, 4, 59))).toBe("Boa noite");
    expect(saudacaoDaHora(new Date(2026, 7, 31, 5, 0))).toBe("Bom dia");
    expect(saudacaoDaHora(new Date(2026, 7, 31, 11, 59))).toBe("Bom dia");
    expect(saudacaoDaHora(new Date(2026, 7, 31, 12, 0))).toBe("Boa tarde");
    expect(saudacaoDaHora(new Date(2026, 7, 31, 17, 59))).toBe("Boa tarde");
    expect(saudacaoDaHora(new Date(2026, 7, 31, 18, 0))).toBe("Boa noite");
  });

  it("madrugada é noite, e não uma quarta faixa", () => {
    expect(saudacaoDaHora(as(3))).toBe("Boa noite");
  });
});

describe("primeiroNome", () => {
  it("usa só o primeiro nome", () => {
    expect(primeiroNome("Rafaela de Villa")).toBe("Rafaela");
  });

  it("recusa e-mail no lugar do nome", () => {
    // Acontece de verdade: há cadastros com o e-mail no campo de nome.
    expect(primeiroNome("comercial4@botta.com.br")).toBeNull();
  });

  it("recusa vazio e ausência", () => {
    expect(primeiroNome("")).toBeNull();
    expect(primeiroNome("   ")).toBeNull();
    expect(primeiroNome(null)).toBeNull();
    expect(primeiroNome(undefined)).toBeNull();
  });

  it("aguenta espaço sobrando", () => {
    expect(primeiroNome("  Leonardo   Silva ")).toBe("Leonardo");
  });
});

describe("saudacao", () => {
  it("junta hora e nome", () => {
    expect(saudacao("Rafaela de Villa", as(14))).toBe("Boa tarde, Rafaela");
  });

  it("nunca sauda pela metade", () => {
    // A regra que originou o módulo: sem nome utilizável, cai no genérico —
    // "Boa tarde," sozinho é pior que "Boa tarde, equipe".
    for (const entrada of [null, undefined, "", "x@y.com"]) {
      const frase = saudacao(entrada, as(14));
      expect(frase).toBe(`Boa tarde, ${TRATAMENTO_GENERICO}`);
      expect(frase.endsWith(",")).toBe(false);
    }
  });
});
