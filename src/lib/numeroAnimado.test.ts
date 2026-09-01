import { describe, expect, it } from "vitest";
import { DURACAO_PADRAO_MS, progressoDaAnimacao, suavizar, valorNaAnimacao } from "./numeroAnimado";

describe("progressoDaAnimacao", () => {
  it("vai de 0 a 1 ao longo da duração", () => {
    expect(progressoDaAnimacao(0, 1000)).toBe(0);
    expect(progressoDaAnimacao(500, 1000)).toBe(0.5);
    expect(progressoDaAnimacao(1000, 1000)).toBe(1);
  });

  it("nunca passa de 1, mesmo com o quadro atrasado", () => {
    // Aba em segundo plano segura o `requestAnimationFrame`: o primeiro quadro
    // depois de voltar pode vir com segundos de atraso.
    expect(progressoDaAnimacao(99_000, 1000)).toBe(1);
  });

  it("duração zero significa 'já terminou'", () => {
    // É por aqui que o modo de movimento reduzido cai no valor final, sem
    // precisar de um caminho separado no componente.
    expect(progressoDaAnimacao(0, 0)).toBe(1);
    expect(progressoDaAnimacao(10, 0)).toBe(1);
  });
});

describe("suavizar", () => {
  it("começa em 0 e termina em 1", () => {
    expect(suavizar(0)).toBe(0);
    expect(suavizar(1)).toBe(1);
  });

  it("desacelera: na metade do tempo já andou mais da metade", () => {
    expect(suavizar(0.5)).toBeGreaterThan(0.5);
  });

  it("é monotônica — o número nunca volta atrás", () => {
    let anterior = -1;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const atual = suavizar(p);
      expect(atual).toBeGreaterThanOrEqual(anterior);
      anterior = atual;
    }
  });
});

describe("valorNaAnimacao", () => {
  it("termina exatamente no alvo", () => {
    // Sem o atalho no progresso 1, `0.3 * suavizar(1)` daria 0.30000000000000004
    // e o cartão pararia num centavo a menos que a fonte.
    expect(valorNaAnimacao(1234, 1)).toBe(1234);
    expect(valorNaAnimacao(0.3, 1)).toBe(0.3);
    expect(valorNaAnimacao(1234.56, 1)).toBe(1234.56);
  });

  it("nunca passa do alvo no meio do caminho", () => {
    for (let p = 0; p <= 1; p += 0.1) {
      expect(valorNaAnimacao(97, p)).toBeLessThanOrEqual(97);
    }
  });

  it("mantém inteiro inteiro durante a subida", () => {
    for (let p = 0; p < 1; p += 0.13) {
      expect(Number.isInteger(valorNaAnimacao(97, p))).toBe(true);
    }
  });

  it("dinheiro sobe em centavos, e não com quinze casas", () => {
    const meio = valorNaAnimacao(1234.56, 0.37);
    expect(Math.round(meio * 100)).toBe(meio * 100);
  });

  it("alvo zero fica em zero o tempo todo", () => {
    expect(valorNaAnimacao(0, 0)).toBe(0);
    expect(valorNaAnimacao(0, 0.5)).toBe(0);
    expect(valorNaAnimacao(0, 1)).toBe(0);
  });

  it("valor inválido vira zero em vez de NaN na tela", () => {
    expect(valorNaAnimacao(Number.NaN, 0.5)).toBe(0);
    expect(valorNaAnimacao(Number.POSITIVE_INFINITY, 0.5)).toBe(0);
  });

  it("a duração padrão é curta o bastante para não atrasar leitura", () => {
    expect(DURACAO_PADRAO_MS).toBeLessThanOrEqual(800);
  });
});
