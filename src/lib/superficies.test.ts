import { describe, expect, it } from "vitest";
import { ANEL, CAIXA_SUAVE, CARTAO, ELEVACAO, PAINEL, RAIO } from "./superficies";

/**
 * O levantamento de 04/08/2026 encontrou 10 sombras distintas, 3 vocabularios de
 * raio e zero aneis fora da vitrine. Estes testes travam a consolidacao para que
 * a divergencia nao volte por acrescimo.
 */
describe("vocabulario de superficie", () => {
  it("tem três degraus de elevação, e não dez", () => {
    expect(Object.keys(ELEVACAO)).toEqual(["rente", "media", "flutuante"]);
  });

  it("os três degraus são visivelmente distintos", () => {
    // Se dois degraus tiverem o mesmo desfoque, nao comunicam hierarquia.
    const desfoques = Object.values(ELEVACAO).map((v) => {
      const m = v.match(/_(\d+)px_rgba/);
      return m ? Number(m[1]) : 0;
    });
    expect(new Set(desfoques).size).toBe(desfoques.length);
    // E precisam estar em ordem crescente: rente < media < flutuante.
    expect([...desfoques].sort((a, b) => a - b)).toEqual(desfoques);
  });

  it("separa por anel, como a vitrine — não por sombra", () => {
    expect(CARTAO).toContain(ANEL.padrao);
    expect(CARTAO).not.toContain("shadow-");
  });

  it("usa um raio só para caixa de conteúdo", () => {
    for (const superficie of [CARTAO, PAINEL, CAIXA_SUAVE]) {
      expect(superficie).toContain(RAIO);
      // Os raios soltos que o admin acumulou nao entram aqui.
      expect(superficie).not.toMatch(/rounded-(2xl|3xl|\[)/);
    }
  });

  it("o painel se distingue do cartão pela elevação, não pelo raio", () => {
    expect(PAINEL).toContain(ELEVACAO.media);
    expect(CARTAO).not.toContain(ELEVACAO.media);
    expect(PAINEL.includes(RAIO) && CARTAO.includes(RAIO)).toBe(true);
  });
});
