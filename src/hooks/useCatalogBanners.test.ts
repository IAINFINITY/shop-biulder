import { describe, expect, it } from "vitest";
import { BANNER_COLUMN_SETS } from "./useCatalogBanners";

const colunas = (conjunto: string) => conjunto.split(",");

/**
 * A lista pedia `placement`, coluna que nao existe no banco. A primeira tentativa
 * falhava sempre, e o degrau de baixo derrubava `slot` junto com a arte de
 * celular e o AVIF. Toda linha voltava sem area, o normalizador assumia "topo", e
 * os banners de par, destaque e ajuda apareciam no carrossel do topo enquanto as
 * areas deles ficavam vazias — sem erro nenhum no console.
 */
describe("degraus de leitura dos banners", () => {
  it("cada degrau abre mão exatamente do que o nome dele diz", () => {
    // Escrito degrau a degrau em vez de "perde N colunas": o defeito anterior era
    // justamente perder colunas que ninguem tinha pedido para perder.
    const esperado = [
      ["slot"],
      ["image_url_avif", "image_url_mobile", "image_url_mobile_avif", "visible_to"],
    ];

    for (let i = 1; i < BANNER_COLUMN_SETS.length; i += 1) {
      const antes = colunas(BANNER_COLUMN_SETS[i - 1]);
      const depois = colunas(BANNER_COLUMN_SETS[i]);
      const perdidas = antes.filter((coluna) => !depois.includes(coluna));
      expect(perdidas.sort()).toEqual([...esperado[i - 1]].sort());
    }
  });

  it("a primeira tentativa não pede coluna que não existe", () => {
    // `placement` nunca chegou ao banco. Enquanto era pedida aqui, a primeira
    // tentativa falhava sempre e a leitura vivia num degrau degradado.
    for (const conjunto of BANNER_COLUMN_SETS) {
      expect(colunas(conjunto)).not.toContain("placement");
    }
    expect(colunas(BANNER_COLUMN_SETS[0])).toContain("slot");
  });

  it("só o último degrau abre mão da arte de celular e do AVIF", () => {
    for (const conjunto of BANNER_COLUMN_SETS.slice(0, -1)) {
      expect(colunas(conjunto)).toContain("image_url_mobile");
      expect(colunas(conjunto)).toContain("image_url_avif");
    }
  });

  it("nenhum degrau abre mão do essencial", () => {
    for (const conjunto of BANNER_COLUMN_SETS) {
      for (const obrigatoria of ["id", "label", "image_url", "active", "sort_order"]) {
        expect(colunas(conjunto)).toContain(obrigatoria);
      }
    }
  });
});
