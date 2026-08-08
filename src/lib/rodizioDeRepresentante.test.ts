import { describe, expect, it } from "vitest";
import { escolherRepresentante, hashDeRodizio } from "@/lib/rodizioDeRepresentante";

const LISTA = [2871, 3216, 2880, 7798, 7057, 6437, 7318, 2365, 2370];

describe("escolherRepresentante", () => {
  it("é determinístico: a mesma chave cai sempre no mesmo representante", () => {
    // É o que impede um reenvio de gerar duas comissões para uma venda.
    const primeira = escolherRepresentante(LISTA, "pedido-abc-123");

    for (let i = 0; i < 20; i += 1) {
      expect(escolherRepresentante(LISTA, "pedido-abc-123")).toBe(primeira);
    }
  });

  it("sempre devolve alguém da lista", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(LISTA).toContain(escolherRepresentante(LISTA, `pedido-${i}`));
    }
  });

  it("espalha de forma razoável — que é o defeito que originou a correção", () => {
    const contagem = new Map<number, number>();
    for (let i = 0; i < 900; i += 1) {
      const rep = escolherRepresentante(LISTA, `submission-${i}-xyz`)!;
      contagem.set(rep, (contagem.get(rep) ?? 0) + 1);
    }

    // Todos recebem, e ninguém fica com uma fatia absurda. Com contador de
    // módulo em serverless, os primeiros levavam quase tudo.
    expect(contagem.size).toBe(LISTA.length);
    for (const total of contagem.values()) {
      expect(total).toBeGreaterThan(900 / LISTA.length / 3);
      expect(total).toBeLessThan((900 / LISTA.length) * 3);
    }
  });

  it("respeita o representante explícito quando ele existe na lista", () => {
    expect(escolherRepresentante(LISTA, "qualquer", 7057)).toBe(7057);
  });

  it("ignora representante explícito fora da lista e sorteia", () => {
    // Aceitar um id qualquer do corpo da requisição deixaria o cliente escolher
    // a quem creditar a venda.
    const escolhido = escolherRepresentante(LISTA, "pedido-x", 99999);

    expect(escolhido).not.toBe(99999);
    expect(LISTA).toContain(escolhido);
  });

  it("devolve null com lista vazia, em vez de inventar um id", () => {
    expect(escolherRepresentante([], "pedido-x")).toBeNull();
    expect(escolherRepresentante([], "pedido-x", 7057)).toBeNull();
  });

  it("cai numa posição estável quando não há chave", () => {
    expect(escolherRepresentante(LISTA, "")).toBe(LISTA[0]);
    expect(escolherRepresentante(LISTA, "   ")).toBe(LISTA[0]);
  });

  it("funciona com lista de um só representante", () => {
    expect(escolherRepresentante([2871], "qualquer")).toBe(2871);
  });
});

describe("hashDeRodizio", () => {
  it("devolve inteiro sem sinal de 32 bits", () => {
    for (const chave of ["a", "pedido-123", "04163851000106", "x".repeat(200)]) {
      const h = hashDeRodizio(chave);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("chaves parecidas caem em valores distintos", () => {
    expect(hashDeRodizio("pedido-1")).not.toBe(hashDeRodizio("pedido-2"));
    expect(hashDeRodizio("04163851000106")).not.toBe(hashDeRodizio("04163851000107"));
  });
});
