import { describe, expect, it } from "vitest";
import { ITENS_POR_PAGINA, ITENS_POR_PAGINA_EM_GRADE, paginar, rotuloDaPagina } from "./paginacao";

const lista = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("paginar", () => {
  it("devolve a primeira fatia e conta o resto", () => {
    const p = paginar(lista(147), 0, 24);
    expect(p.itens).toHaveLength(24);
    expect(p.itens[0]).toBe(1);
    expect(p).toMatchObject({ paginaAtual: 1, totalDePaginas: 7, primeiroItem: 1, ultimoItem: 24, total: 147 });
  });

  it("a última página traz só o que sobrou", () => {
    const p = paginar(lista(147), 6, 24);
    expect(p.itens).toHaveLength(3);
    expect(p).toMatchObject({ paginaAtual: 7, primeiroItem: 145, ultimoItem: 147 });
  });

  it("página além do fim cai na última, e não numa lista vazia", () => {
    // O caso real: a pessoa está na página 5 e digita na busca. A lista encolhe
    // para 10 itens e a página 5 deixa de existir — sem a trava, a tela fica em
    // branco e parece que o filtro não achou nada.
    const p = paginar(lista(10), 4, 24);
    expect(p.itens).toHaveLength(10);
    expect(p.paginaAtual).toBe(1);
  });

  it("página negativa ou inválida cai na primeira", () => {
    expect(paginar(lista(50), -3, 24).paginaAtual).toBe(1);
    expect(paginar(lista(50), Number.NaN, 24).paginaAtual).toBe(1);
  });

  it("lista vazia não inventa página 1 de 1", () => {
    const p = paginar([], 0, 24);
    expect(p).toMatchObject({ itens: [], paginaAtual: 0, totalDePaginas: 0, total: 0 });
  });

  it("tamanho de página inválido não divide por zero", () => {
    const p = paginar(lista(5), 0, 0);
    expect(p.itens).toHaveLength(1);
    expect(p.totalDePaginas).toBe(5);
  });

  it("as páginas cobrem a lista inteira, sem buraco nem repetição", () => {
    const total = 147;
    const vistos: number[] = [];
    const { totalDePaginas } = paginar(lista(total), 0, 24);
    for (let i = 0; i < totalDePaginas; i++) vistos.push(...paginar(lista(total), i, 24).itens);
    expect(vistos).toEqual(lista(total));
  });

  it("o padrão do projeto é 24 por página", () => {
    expect(ITENS_POR_PAGINA).toBe(24);
  });
});

describe("rotuloDaPagina", () => {
  it("mostra a faixa e o total", () => {
    expect(rotuloDaPagina(paginar(lista(147), 1, 24))).toBe("25–48 de 147");
  });

  it("não diz '1–1 de 1' para um item só", () => {
    expect(rotuloDaPagina(paginar(lista(1), 0, 24))).toBe("1 item");
  });

  it("lista vazia diz que está vazia", () => {
    expect(rotuloDaPagina(paginar([], 0, 24))).toBe("nenhum item");
  });
});

describe("tamanho de página em grade", () => {
  it("fecha a linha em 2, 3 e 5 colunas", () => {
    // A biblioteca de imagens muda de 2 para 3 e para 5 colunas conforme a
    // largura. Sobrando resto em qualquer uma delas, a última linha fica com
    // buraco — e a altura da página muda, fazendo a rolagem escorregar.
    for (const colunas of [2, 3, 5, 6]) {
      expect(ITENS_POR_PAGINA_EM_GRADE % colunas).toBe(0);
    }
  });

  it("todas as páginas cheias têm o mesmo tamanho", () => {
    const total = ITENS_POR_PAGINA_EM_GRADE * 3;
    for (let i = 0; i < 3; i++) {
      expect(paginar(lista(total), i, ITENS_POR_PAGINA_EM_GRADE).itens).toHaveLength(ITENS_POR_PAGINA_EM_GRADE);
    }
  });
});
