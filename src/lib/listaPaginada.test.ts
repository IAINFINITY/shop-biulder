import { describe, expect, it } from "vitest";

import { ITENS_POR_PAGINA_EM_CARTAO, montarListaPaginada } from "./listaPaginada";

const texto = (item: string) => item;
const lista = (quantos: number) => Array.from({ length: quantos }, (_, i) => `item ${i + 1}`);

describe("montarListaPaginada", () => {
  it("lista pequena não ganha busca nem rodapé", () => {
    const resultado = montarListaPaginada(lista(4), { textoDoItem: texto });
    expect(resultado.precisaDeControles).toBe(false);
    expect(resultado.itens).toHaveLength(4);
  });

  // O limite é o tamanho da página: 8 cabem, 9 não.
  it("os controles aparecem exatamente quando a lista não cabe numa página", () => {
    expect(montarListaPaginada(lista(ITENS_POR_PAGINA_EM_CARTAO), { textoDoItem: texto }).precisaDeControles).toBe(
      false,
    );
    expect(montarListaPaginada(lista(ITENS_POR_PAGINA_EM_CARTAO + 1), { textoDoItem: texto }).precisaDeControles).toBe(
      true,
    );
  });

  it("corta na página pedida", () => {
    const resultado = montarListaPaginada(lista(20), { pagina: 1, textoDoItem: texto });
    expect(resultado.itens[0]).toBe("item 9");
    expect(resultado.pagina.paginaAtual).toBe(2);
    expect(resultado.pagina.totalDePaginas).toBe(3);
  });

  it("a busca recorta antes de paginar", () => {
    const resultado = montarListaPaginada(["alfa", "beta", "alface"], { busca: "alf", textoDoItem: texto });
    expect(resultado.itens).toEqual(["alfa", "alface"]);
    expect(resultado.encontrados).toBe(2);
  });

  // ⚠️ Se o critério olhasse o resultado da busca, digitar um termo que sobra
  // três itens esconderia o campo — levando junto o texto recém-digitado.
  it("buscar até sobrar pouco NÃO esconde o campo de busca", () => {
    const resultado = montarListaPaginada(lista(30), { busca: "item 7", textoDoItem: texto });
    expect(resultado.encontrados).toBeLessThan(ITENS_POR_PAGINA_EM_CARTAO);
    expect(resultado.precisaDeControles).toBe(true);
  });

  // Herdado de `paginar`: filtrar encolhe a lista e quem estava na página 4
  // continua pedindo a 4. Sem o corte, a tela apareceria vazia por engano.
  it("página fora do intervalo cai na última que existe", () => {
    const resultado = montarListaPaginada(lista(10), { pagina: 9, textoDoItem: texto });
    expect(resultado.pagina.paginaAtual).toBe(2);
    expect(resultado.itens).toHaveLength(2);
  });

  it("busca sem resultado devolve lista vazia sem quebrar", () => {
    const resultado = montarListaPaginada(lista(20), { busca: "zzz", textoDoItem: texto });
    expect(resultado.itens).toEqual([]);
    expect(resultado.encontrados).toBe(0);
    expect(resultado.pagina.totalDePaginas).toBe(0);
  });

  it("não altera a lista que recebeu", () => {
    const original = ["b", "a"];
    montarListaPaginada(original, { textoDoItem: texto });
    expect(original).toEqual(["b", "a"]);
  });

  it("casa por qualquer parte do texto que o item expõe", () => {
    const tabelas = [
      { nome: "Representante Nacional", id: 8728 },
      { nome: "Distribuidor Nacional", id: 8729 },
    ];
    const porNumero = montarListaPaginada(tabelas, {
      busca: "8729",
      textoDoItem: (t) => `${t.nome} ${t.id}`,
    });
    expect(porNumero.itens).toEqual([{ nome: "Distribuidor Nacional", id: 8729 }]);
  });
});
