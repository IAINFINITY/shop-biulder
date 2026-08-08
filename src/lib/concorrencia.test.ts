import { describe, expect, it } from "vitest";
import { mapearComLimite } from "@/lib/concorrencia";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("mapearComLimite", () => {
  it("devolve na ordem da entrada, não na ordem em que terminou", async () => {
    // O primeiro item é o mais lento de propósito: se a ordem seguisse a
    // conclusão, ele sairia por último.
    const atrasos = [30, 1, 1, 1];

    const resultado = await mapearComLimite(atrasos, 4, async (ms, i) => {
      await esperar(ms);
      return i;
    });

    expect(resultado).toEqual([0, 1, 2, 3]);
  });

  it("nunca ultrapassa o teto de execuções simultâneas", async () => {
    let emVoo = 0;
    let pico = 0;

    await mapearComLimite(Array.from({ length: 20 }, (_, i) => i), 5, async () => {
      emVoo += 1;
      pico = Math.max(pico, emVoo);
      await esperar(2);
      emVoo -= 1;
    });

    expect(pico).toBeLessThanOrEqual(5);
    expect(pico).toBeGreaterThan(1);
  });

  it("processa cada item exatamente uma vez", async () => {
    const vistos: number[] = [];

    await mapearComLimite(Array.from({ length: 50 }, (_, i) => i), 7, async (item) => {
      await esperar(1);
      vistos.push(item);
    });

    expect(vistos).toHaveLength(50);
    expect(new Set(vistos).size).toBe(50);
  });

  it("aceita lista vazia sem chamar a função", async () => {
    let chamadas = 0;

    const resultado = await mapearComLimite([], 5, async () => {
      chamadas += 1;
    });

    expect(resultado).toEqual([]);
    expect(chamadas).toBe(0);
  });

  it("trata teto inválido como 1, em vez de travar", async () => {
    for (const teto of [0, -3, Number.NaN]) {
      const resultado = await mapearComLimite([1, 2, 3], teto, async (n) => n * 2);
      expect(resultado).toEqual([2, 4, 6]);
    }
  });

  it("não engole rejeição: quem chama decide o que fazer", async () => {
    await expect(
      mapearComLimite([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("falhou no item 2");
        return n;
      }),
    ).rejects.toThrow("falhou no item 2");
  });

  it("com teto maior que a lista, não cria trabalhador ocioso", async () => {
    const resultado = await mapearComLimite([1, 2], 10, async (n) => n + 1);

    expect(resultado).toEqual([2, 3]);
  });
});
