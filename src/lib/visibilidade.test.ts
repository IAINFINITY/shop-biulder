import { describe, expect, it } from "vitest";
import { podeVer } from "./visibilidade";

const TODOS = ["cliente", "distribuidor", "funcionario", "lojista"] as const;

const contexto = (customerType: string | null, isAdmin = false) => ({
  customerType,
  todosOsTipos: TODOS,
  isAdmin,
});

describe("visibilidade por tipo de cliente", () => {
  it("sem restrição, todo mundo vê", () => {
    expect(podeVer({ visible_to: null }, contexto("cliente"))).toBe(true);
    expect(podeVer({ visible_to: [] }, contexto(null))).toBe(true);
  });

  it("com alguns tipos marcados, só eles veem", () => {
    const alvo = { visible_to: ["distribuidor"] };
    expect(podeVer(alvo, contexto("distribuidor"))).toBe(true);
    expect(podeVer(alvo, contexto("cliente"))).toBe(false);
    expect(podeVer(alvo, contexto(null))).toBe(false);
  });

  /**
   * A armadilha: marcar a lista inteira achando que libera para todos passava a
   * *exigir* um tipo, e conta interna nao tem tipo. O item sumia justamente para
   * quem acabou de configura-lo.
   */
  it("marcar todos os tipos vale o mesmo que não marcar nenhum", () => {
    const alvo = { visible_to: [...TODOS] };
    expect(podeVer(alvo, contexto("cliente"))).toBe(true);
    expect(podeVer(alvo, contexto(null))).toBe(true);
  });

  it("admin vê o que está restrito, mesmo sem ter tipo de cliente", () => {
    const alvo = { visible_to: ["distribuidor"] };
    expect(podeVer(alvo, contexto(null, false))).toBe(false);
    expect(podeVer(alvo, contexto(null, true))).toBe(true);
  });

  it("sem saber quais tipos existem, não deduz 'marcou tudo'", () => {
    // Lista de tipos ainda carregando: melhor manter a restricao do que liberar
    // por engano um item que era para ser restrito.
    const alvo = { visible_to: [...TODOS] };
    expect(podeVer(alvo, { customerType: null, todosOsTipos: [] })).toBe(false);
    expect(podeVer(alvo, { customerType: "cliente", todosOsTipos: [] })).toBe(true);
  });
});
