import { describe, expect, it } from "vitest";
import {
  alteracoesDe,
  chaveDoEscopo,
  formatarParaCampo,
  lerPrecoDigitado,
  montarEscopos,
  type LinhaDePrecoDoProduto,
} from "@/lib/precoEmTodasAsTabelas";

const TIPOS = [
  { name: "cliente", label: "Cliente" },
  { name: "distribuidor", label: "Distribuidor" },
  { name: "funcionario", label: "Funcionário" },
];

const TABELAS = [
  { tprId: 8729, description: "Clinic 2026 B", ativa: true },
  { tprId: 8728, description: "Clinic 2026 A", ativa: true },
];

describe("montarEscopos", () => {
  it("põe os gerais antes das tabelas negociadas", () => {
    // Os gerais são o preço de partida de cada tipo; as negociadas são exceção
    // por cima disso, e é nessa ordem que se lê a tela.
    const escopos = montarEscopos(TIPOS, TABELAS);
    expect(escopos.map(chaveDoEscopo)).toEqual([
      "geral:cliente",
      "geral:distribuidor",
      "geral:funcionario",
      "tabela:8728",
      "tabela:8729",
    ]);
  });

  // ⚠️ Tabela negociada é sempre do tipo `cliente` — é assim que as 8728/8729
  // estão gravadas, e é o que a resolução de preço no servidor espera.
  it("marca toda tabela negociada como do tipo cliente", () => {
    const negociadas = montarEscopos(TIPOS, TABELAS).filter((e) => e.tipo === "tabela");
    expect(negociadas.every((e) => e.customerType === "cliente")).toBe(true);
  });

  it("usa o número quando a tabela não tem nome", () => {
    const [tabela] = montarEscopos([], [{ tprId: 9000, description: "", ativa: false }]);
    expect(tabela.rotulo).toBe("Tabela 9000");
  });
});

describe("lerPrecoDigitado", () => {
  it("aceita vírgula e ponto de milhar, que é como se digita aqui", () => {
    expect(lerPrecoDigitado("24,99")).toBe(24.99);
    expect(lerPrecoDigitado("1.234,56")).toBe(1234.56);
    expect(lerPrecoDigitado("24.99")).toBe(24.99);
    expect(lerPrecoDigitado(" 30 ")).toBe(30);
  });

  it("arredonda para centavos", () => {
    expect(lerPrecoDigitado("24,999")).toBe(25);
  });

  // Vazio é "não mexi nisto", e não zero.
  it("devolve nulo para vazio e para lixo", () => {
    expect(lerPrecoDigitado("")).toBeNull();
    expect(lerPrecoDigitado("   ")).toBeNull();
    expect(lerPrecoDigitado("abc")).toBeNull();
    expect(lerPrecoDigitado("-5")).toBeNull();
  });
});

describe("formatarParaCampo", () => {
  it("mostra o preço gravado com vírgula", () => {
    expect(formatarParaCampo(24.9)).toBe("24,90");
    expect(formatarParaCampo(null)).toBe("");
  });

  it("ida e volta preserva o valor", () => {
    expect(lerPrecoDigitado(formatarParaCampo(1234.56))).toBe(1234.56);
  });
});

describe("alteracoesDe", () => {
  const linhas: LinhaDePrecoDoProduto[] = [
    { escopo: { tipo: "geral", customerType: "cliente", rotulo: "Cliente" }, precoAtual: 30, ativo: true },
    { escopo: { tipo: "geral", customerType: "funcionario", rotulo: "Funcionário" }, precoAtual: null, ativo: true },
    { escopo: { tipo: "tabela", tprId: 8728, customerType: "cliente", rotulo: "A", ativa: true }, precoAtual: 25, ativo: true },
  ];

  // ⚠️ O teste que evita o pior desfecho: abrir o diálogo, salvar sem digitar,
  // e zerar o preço de todo escopo em branco.
  it("campo vazio não vira alteração", () => {
    expect(alteracoesDe(linhas, {})).toEqual([]);
    expect(alteracoesDe(linhas, { "geral:cliente": "", "tabela:8728": "  " })).toEqual([]);
  });

  it("preço igual ao gravado não vira alteração", () => {
    // Gravar por gravar mexe no `updated_at` e faz parecer que alguém alterou.
    expect(alteracoesDe(linhas, { "geral:cliente": "30,00" })).toEqual([]);
    expect(alteracoesDe(linhas, { "geral:cliente": "30" })).toEqual([]);
  });

  it("junta só o que mudou, de todos os escopos de uma vez", () => {
    const mudancas = alteracoesDe(linhas, {
      "geral:cliente": "31,50",
      "geral:funcionario": "19,90",
      "tabela:8728": "25,00",
    });

    expect(mudancas.map((m) => [chaveDoEscopo(m.escopo), m.preco])).toEqual([
      ["geral:cliente", 31.5],
      ["geral:funcionario", 19.9],
    ]);
  });

  it("escopo sem preço hoje entra quando recebe valor", () => {
    const [mudanca] = alteracoesDe(linhas, { "geral:funcionario": "10" });
    expect(mudanca.escopo.tipo).toBe("geral");
    expect(mudanca.preco).toBe(10);
  });

  it("zero explícito é uma alteração de verdade", () => {
    // Produto de brinde existe. O que não pode é zero por omissão.
    expect(alteracoesDe(linhas, { "geral:cliente": "0" })).toHaveLength(1);
  });
});
