import { describe, expect, it } from "vitest";
import { nomesOcultos, semCategoriasOcultas } from "@/lib/categoriasOcultas";

/** As sete categorias reais do catálogo. */
const REGISTRO = [
  { name: "Cápsula", visivel: true },
  { name: "Chá", visivel: true },
  { name: "Solúvel", visivel: true },
  { name: "Whey", visivel: true },
  { name: "Colágenos", visivel: true },
  { name: "Shake", visivel: true },
  { name: "Gomas", visivel: false },
];

const opcoes = (...nomes: string[]) => nomes.map((value) => ({ value, count: 1 }));
const nomeDe = (o: { value: string }) => o.value;

describe("nomesOcultos", () => {
  it("só esconde o que foi marcado", () => {
    const ocultos = nomesOcultos(REGISTRO);
    expect(ocultos.has("gomas")).toBe(true);
    expect(ocultos.size).toBe(1);
  });

  it("registro ausente não esconde nada", () => {
    /**
     * O caso que protege a loja.
     *
     * Enquanto a consulta não respondeu — ou se ela falhar — a vitrine tem de
     * se comportar como sempre. Se ausência significasse "esconder", uma falha
     * de rede deixaria o catálogo sem filtro de categoria nenhum.
     */
    expect(nomesOcultos(undefined).size).toBe(0);
    expect(nomesOcultos(null).size).toBe(0);
    expect(nomesOcultos([]).size).toBe(0);
  });

  it("coluna ainda inexistente não esconde tudo", () => {
    // Antes da migration, `visivel` chega `undefined` em todas as linhas.
    // Com `!item.visivel` isso apagaria as sete categorias de uma vez.
    const antesDaMigration = REGISTRO.map(({ name }) => ({ name }));
    expect(nomesOcultos(antesDaMigration).size).toBe(0);
  });

  it("null também não esconde", () => {
    expect(nomesOcultos([{ name: "Chá", visivel: null }]).size).toBe(0);
  });

  it("ignora caixa e espaço", () => {
    const ocultos = nomesOcultos([{ name: "  GOMAS  ", visivel: false }]);
    expect(ocultos.has("gomas")).toBe(true);
  });
});

describe("semCategoriasOcultas", () => {
  it("tira da lista a categoria escondida", () => {
    const lista = opcoes("Cápsula", "Chá", "Gomas");
    const resultado = semCategoriasOcultas(lista, nomesOcultos(REGISTRO), nomeDe);
    expect(resultado.map(nomeDe)).toEqual(["Cápsula", "Chá"]);
  });

  it("categoria que ninguém registrou continua aparecendo", () => {
    /**
     * O outro lado da regra: o registro **esconde**, não decide o que existe.
     *
     * Um produto com tipo novo, digitado sem cadastrar a categoria, precisa
     * seguir encontrável. Se a vitrine mostrasse só o registrado, ele sumiria
     * do filtro e ninguém saberia por quê.
     */
    const lista = opcoes("Cápsula", "Novidades");
    const resultado = semCategoriasOcultas(lista, nomesOcultos(REGISTRO), nomeDe);
    expect(resultado.map(nomeDe)).toContain("Novidades");
  });

  it("sem nada escondido, devolve a mesma lista", () => {
    const lista = opcoes("Cápsula", "Chá");
    expect(semCategoriasOcultas(lista, new Set(), nomeDe)).toBe(lista);
  });

  it("diferença de caixa não deixa a escondida escapar", () => {
    const lista = opcoes("gomas");
    expect(semCategoriasOcultas(lista, nomesOcultos(REGISTRO), nomeDe)).toEqual([]);
  });
});
