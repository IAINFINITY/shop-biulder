import { describe, expect, it } from "vitest";
import { completarFileira } from "./useGridColumns";

/**
 * O corte era 24 — divisivel por 2, 3 e 4, mas nao por 5. Quando a quinta coluna
 * entrou em 1680px, toda "carregar mais" passou a deixar a ultima fileira pela
 * metade, mesmo com produto de sobra para carregar.
 */
describe("completar a fileira da grade", () => {
  it("arredonda para cima até fechar a fileira", () => {
    expect(completarFileira(24, 5, 143)).toBe(25);
    expect(completarFileira(48, 5, 143)).toBe(50);
    expect(completarFileira(72, 5, 143)).toBe(75);
  });

  it("não mexe no que já fecha", () => {
    expect(completarFileira(24, 4, 143)).toBe(24);
    expect(completarFileira(24, 3, 143)).toBe(24);
    expect(completarFileira(24, 2, 143)).toBe(24);
  });

  it("nunca passa do total", () => {
    expect(completarFileira(140, 5, 143)).toBe(140);
    expect(completarFileira(143, 5, 143)).toBe(143);
    expect(completarFileira(200, 5, 143)).toBe(143);
  });

  it("no fim da lista entrega o total, sobra e tudo", () => {
    // 143 nao fecha fileira em coluna nenhuma, e tudo bem: acabou.
    expect(completarFileira(999, 5, 143)).toBe(143);
    expect(143 % 5).not.toBe(0);
  });

  it("com uma coluna só, não há fileira a fechar", () => {
    expect(completarFileira(24, 1, 143)).toBe(24);
    expect(completarFileira(24, 0, 143)).toBe(24);
  });
});
