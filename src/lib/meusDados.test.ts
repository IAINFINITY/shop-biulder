import { describe, expect, it } from "vitest";
import {
  contarRegistros,
  montarPacoteDeDados,
  nomeDoArquivo,
  serializarPacote,
  type PartesDoPacote,
} from "@/lib/meusDados";

const VAZIO: PartesDoPacote = {
  perfil: null,
  enderecos: [],
  pedidos: [],
  avaliacoes: [],
  favoritos: [],
  conversas: [],
  aparelhos: [],
};

const TITULAR = { id: "u1", email: "cliente@teste.local" };

describe("montarPacoteDeDados", () => {
  it("declara a finalidade de cada seção, e não só os dados", () => {
    // O art. 19, II exige declaração "clara e completa", com a finalidade do
    // tratamento. Um despejo de tabelas seria completo sem ser claro.
    const pacote = montarPacoteDeDados(TITULAR, VAZIO);

    for (const [chave, secao] of Object.entries(pacote.secoes)) {
      expect(secao.finalidade, `seção ${chave}`).toBeTruthy();
      expect(secao.titulo, `seção ${chave}`).toBeTruthy();
    }
  });

  it("cobre as sete origens de dado do titular", () => {
    const pacote = montarPacoteDeDados(TITULAR, VAZIO);
    expect(Object.keys(pacote.secoes).sort()).toEqual([
      "aparelhos",
      "avaliacoes",
      "conversas",
      "enderecos",
      "favoritos",
      "pedidos",
      "perfil",
    ]);
  });

  it("transforma o perfil, que é uma linha só, em lista", () => {
    const comPerfil = montarPacoteDeDados(TITULAR, { ...VAZIO, perfil: { name: "Fulano" } });
    expect(comPerfil.secoes.perfil.registros).toHaveLength(1);

    const semPerfil = montarPacoteDeDados(TITULAR, VAZIO);
    expect(semPerfil.secoes.perfil.registros).toHaveLength(0);
  });

  it("avisa que o ERP tem cópia própria", () => {
    // Prometer que o arquivo é tudo o que existe seria falso: o pedido vira
    // documento fiscal no Proxsys, e de lá este sistema não manda.
    const pacote = montarPacoteDeDados(TITULAR, VAZIO);
    expect(pacote.aviso.toLowerCase()).toContain("proxsys");
  });

  it("carimba a data de geração", () => {
    const pacote = montarPacoteDeDados(TITULAR, VAZIO, new Date("2026-08-19T12:00:00Z"));
    expect(pacote.gerado_em).toBe("2026-08-19T12:00:00.000Z");
  });

  it("preserva os registros que recebeu, sem reescrever", () => {
    const pedido = { id: "p1", total_items: 3 };
    const pacote = montarPacoteDeDados(TITULAR, { ...VAZIO, pedidos: [pedido] });
    expect(pacote.secoes.pedidos.registros[0]).toBe(pedido);
  });
});

describe("contarRegistros", () => {
  it("conta por seção", () => {
    const pacote = montarPacoteDeDados(TITULAR, {
      ...VAZIO,
      perfil: { name: "Fulano" },
      enderecos: [{ id: "a" }, { id: "b" }],
      pedidos: [{ id: "p" }],
    });

    const contagem = contarRegistros(pacote);
    expect(contagem.perfil).toBe(1);
    expect(contagem.enderecos).toBe(2);
    expect(contagem.pedidos).toBe(1);
    expect(contagem.favoritos).toBe(0);
  });
});

describe("nomeDoArquivo", () => {
  it("leva a data, para duas exportações não colidirem na pasta de downloads", () => {
    expect(nomeDoArquivo(new Date("2026-08-19T23:00:00Z"))).toBe("clinic-mais-meus-dados-2026-08-19.json");
  });
});

describe("serializarPacote", () => {
  it("sai indentado e válido", () => {
    const pacote = montarPacoteDeDados(TITULAR, { ...VAZIO, favoritos: [{ product_id: "x" }] });
    const texto = serializarPacote(pacote);

    expect(texto).toContain("\n  ");
    expect(() => JSON.parse(texto)).not.toThrow();
    expect(JSON.parse(texto).secoes.favoritos.registros).toEqual([{ product_id: "x" }]);
  });
});
