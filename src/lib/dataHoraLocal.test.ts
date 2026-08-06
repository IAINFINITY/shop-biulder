// Fuso fixo antes de qualquer `Date`: o defeito **e** de fuso, e um teste que
// roda em UTC passaria com o codigo errado. Sao Paulo e o fuso de quem usa o
// painel, e tem meia hora de diferenca para nenhum lugar — serve de referencia
// justamente por ser -03:00 cravado.
process.env.TZ = "America/Sao_Paulo";

import { describe, expect, it } from "vitest";
import { campoLocalParaIso, isoParaCampoLocal } from "@/lib/dataHoraLocal";

const OFFSET_ESPERADO = 3 * 60;

describe("dataHoraLocal", () => {
  it("o ambiente do teste esta mesmo em -03:00", () => {
    // Sem isto, os casos abaixo virariam tautologia num runner em UTC.
    expect(new Date("2026-08-06T12:00:00Z").getTimezoneOffset()).toBe(OFFSET_ESPERADO);
  });

  it("o caso relatado: 18:55 salvo reabre 18:55", () => {
    const iso = campoLocalParaIso("2026-08-06T18:55");
    expect(iso).toBe("2026-08-06T21:55:00.000Z");
    expect(isoParaCampoLocal(iso)).toBe("2026-08-06T18:55");
  });

  it("o recorte antigo era o defeito", () => {
    const iso = "2026-08-06T21:55:00.000Z";
    expect(iso.slice(0, 16)).toBe("2026-08-06T21:55");
    expect(isoParaCampoLocal(iso)).toBe("2026-08-06T18:55");
  });

  it("editar e salvar de novo nao empurra a hora", () => {
    // Era o efeito acumulado: cada volta somava o fuso outra vez.
    let iso = campoLocalParaIso("2026-08-06T18:55")!;
    for (let i = 0; i < 5; i++) iso = campoLocalParaIso(isoParaCampoLocal(iso))!;
    expect(iso).toBe("2026-08-06T21:55:00.000Z");
  });

  it("vira o dia quando o fuso empurra para depois da meia-noite", () => {
    expect(campoLocalParaIso("2026-08-06T22:30")).toBe("2026-08-07T01:30:00.000Z");
    expect(isoParaCampoLocal("2026-08-07T01:30:00.000Z")).toBe("2026-08-06T22:30");
  });

  it("vazio e invalido nao viram data", () => {
    expect(campoLocalParaIso("")).toBeNull();
    expect(campoLocalParaIso("   ")).toBeNull();
    expect(campoLocalParaIso(null)).toBeNull();
    expect(campoLocalParaIso("nao e data")).toBeNull();
    expect(isoParaCampoLocal("")).toBe("");
    expect(isoParaCampoLocal(null)).toBe("");
    expect(isoParaCampoLocal("nao e data")).toBe("");
  });

  it("preenche com dois digitos, que e o que o campo aceita", () => {
    expect(isoParaCampoLocal("2026-01-05T12:07:00.000Z")).toBe("2026-01-05T09:07");
  });
});
