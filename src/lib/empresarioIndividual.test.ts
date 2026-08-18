import { describe, expect, it } from "vitest";
import { nomeComecaComCnpj, nomeSemCnpj } from "@/lib/empresarioIndividual";

/** Os três casos reais do cadastro, copiados do banco. */
const REAIS = [
  { company: "26.041.551 PATRICIA GUEDES MAZUI PIASSUM", cnpj: "26041551000197", nome: "PATRICIA GUEDES MAZUI PIASSUM" },
  { company: "54.626.438 MARCIO DIAS", cnpj: "54626438000109", nome: "MARCIO DIAS" },
  { company: "66.121.553 JOSE FRANCISCO DE ARAUJO NETO", cnpj: "66121553000100", nome: "JOSE FRANCISCO DE ARAUJO NETO" },
];

describe("nomeComecaComCnpj", () => {
  it("reconhece os três casos reais do cadastro", () => {
    for (const r of REAIS) expect(nomeComecaComCnpj(r.company, r.cnpj), r.company).toBe(true);
  });

  it("empresa com razão social própria não é confundida", () => {
    for (const nome of ["Alpha Distribuição", "BIO MUNDO FOZ EIRELI", "C & R FARMACIAS LTDA"]) {
      expect(nomeComecaComCnpj(nome, "14351538000155"), nome).toBe(false);
    }
  });

  it("o número precisa ser o CNPJ DESTE cliente", () => {
    /**
     * A conferência contra o CNPJ é o que sustenta a regra.
     *
     * Reconhecer só o formato marcaria qualquer nome que comece com números
     * parecidos — e o cadastro é de terceiros, então não dá para confiar no
     * formato sozinho.
     */
    expect(nomeComecaComCnpj("26.041.551 PATRICIA GUEDES", "99999999000199")).toBe(false);
  });

  it("número sem nome depois não conta", () => {
    // Devolver string vazia deixaria a tela sem nada para mostrar.
    expect(nomeComecaComCnpj("26.041.551", "26041551000197")).toBe(false);
    expect(nomeComecaComCnpj("26.041.551   ", "26041551000197")).toBe(false);
  });

  it("CNPJ incompleto ou ausente não quebra", () => {
    expect(nomeComecaComCnpj("26.041.551 PATRICIA", "260415")).toBe(false);
    expect(nomeComecaComCnpj("26.041.551 PATRICIA", null)).toBe(false);
    expect(nomeComecaComCnpj(null, "26041551000197")).toBe(false);
  });

  it("CNPJ com ou sem máscara dá no mesmo", () => {
    expect(nomeComecaComCnpj("26.041.551 PATRICIA", "26.041.551/0001-97")).toBe(true);
  });
});

describe("nomeSemCnpj", () => {
  it("devolve só o nome da pessoa", () => {
    for (const r of REAIS) expect(nomeSemCnpj(r.company, r.cnpj)).toBe(r.nome);
  });

  it("nome comum passa intacto", () => {
    expect(nomeSemCnpj("Alpha Distribuição", "14351538000155")).toBe("Alpha Distribuição");
  });

  it("nunca devolve vazio quando havia texto", () => {
    // Um nome que some da tela é pior que um nome feio.
    for (const caso of [
      { c: "26.041.551", j: "26041551000197" },
      { c: "  ", j: "26041551000197" },
      { c: "Alpha", j: null },
    ]) {
      const saida = nomeSemCnpj(caso.c, caso.j);
      expect(saida).toBe(String(caso.c).trim());
    }
  });
});
