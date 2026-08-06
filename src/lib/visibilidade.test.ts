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

/**
 * O caso que sumiu as categorias da arvore de filtros.
 *
 * Todos os produtos "restritos" da loja estao, na verdade, marcados com **todos**
 * os tipos — ninguem restringiu nada. Entao a visibilidade deles depende so de
 * `liberadoParaTodos`, que compara o `visible_to` com a lista de tipos que
 * existem. E essa lista oscilava: quatro tipos padrao enquanto carregava, tres
 * vindos do banco depois.
 */
describe("lista de tipos incompleta ou desalinhada", () => {
  const marcadoComTres = { visible_to: ["cliente", "distribuidor", "lojista"] };

  it("com a lista igual a marcacao, todo mundo ve", () => {
    const tresTipos = ["cliente", "distribuidor", "lojista"];
    for (const quem of [null, "cliente", "lojista"]) {
      expect(
        podeVer(marcadoComTres, { customerType: quem, todosOsTipos: tresTipos }),
      ).toBe(true);
    }
  });

  it("com um tipo a mais na lista, quem nao tem tipo perde o produto", () => {
    // E o time de design: conta sem perfil de cliente, entao `customerType` nulo.
    // O superadmin nao sentia porque `isAdmin` atalha antes.
    const quatroTipos = ["cliente", "distribuidor", "lojista", "funcionario"];

    expect(podeVer(marcadoComTres, { customerType: null, todosOsTipos: quatroTipos })).toBe(false);
    expect(podeVer(marcadoComTres, { customerType: null, todosOsTipos: quatroTipos, isAdmin: true })).toBe(true);
  });

  it("com a marcacao completada, volta a valer para todos", () => {
    // O que a migration faz: acrescenta `funcionario` a quem ja marcava todos.
    const quatroTipos = ["cliente", "distribuidor", "lojista", "funcionario"];
    const completado = { visible_to: [...marcadoComTres.visible_to, "funcionario"] };

    expect(podeVer(completado, { customerType: null, todosOsTipos: quatroTipos })).toBe(true);
    expect(podeVer(completado, { customerType: null, todosOsTipos: ["cliente", "distribuidor", "lojista"] })).toBe(true);
  });

  it("produto restrito de proposito continua restrito", () => {
    // A migration nao pode liberar quem foi marcado com um tipo so.
    const soLojista = { visible_to: ["lojista"] };
    const quatroTipos = ["cliente", "distribuidor", "lojista", "funcionario"];

    expect(podeVer(soLojista, { customerType: "lojista", todosOsTipos: quatroTipos })).toBe(true);
    expect(podeVer(soLojista, { customerType: "cliente", todosOsTipos: quatroTipos })).toBe(false);
  });
});
