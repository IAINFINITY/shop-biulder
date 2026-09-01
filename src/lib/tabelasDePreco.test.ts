import { describe, expect, it } from "vitest";
import {
  alertasDasTabelas,
  contarPessoasPorTabela,
  filtrarTabelasNegociadas,
  lerChaveDeTabela,
  resumirTabelasNegociadas,
  resumirTabelasPorTipo,
  type OverrideParaResumo,
  type PerfilParaResumo,
} from "./tabelasDePreco";

const preco = (
  customer_type: string,
  proxis_tpr_id: number | null,
  product_code: string,
  active = true,
): OverrideParaResumo => ({ customer_type, proxis_tpr_id, product_code, active });

describe("contarPessoasPorTabela", () => {
  it("conta pela tabela do Proxis quando a pessoa tem TPR", () => {
    const perfis: PerfilParaResumo[] = [
      { customer_type: "cliente", proxis_tpr_id: 8728 },
      { customer_type: "cliente", proxis_tpr_id: 8728 },
      { customer_type: "cliente", proxis_tpr_id: null },
    ];
    const { porTipo, porTpr } = contarPessoasPorTabela(perfis);
    // Quem tem TPR nao conta na geral: contar nas duas prometeria um alcance
    // que a tabela geral nao tem.
    expect(porTpr.get(8728)).toBe(2);
    expect(porTipo.get("cliente")).toBe(1);
  });

  it("funcionario cai na tabela geral do tipo", () => {
    const { porTipo } = contarPessoasPorTabela([
      { customer_type: "funcionario", proxis_tpr_id: null },
      { customer_type: "funcionario", proxis_tpr_id: null },
    ]);
    expect(porTipo.get("funcionario")).toBe(2);
  });

  it("tipo ausente vira cliente", () => {
    const { porTipo } = contarPessoasPorTabela([{ customer_type: null, proxis_tpr_id: null }]);
    expect(porTipo.get("cliente")).toBe(1);
  });
});

describe("resumirTabelasPorTipo", () => {
  it("conta produtos e pessoas por tipo", () => {
    const tabelas = resumirTabelasPorTipo(
      [preco("funcionario", null, "1"), preco("funcionario", null, "2"), preco("funcionario", null, "3")],
      [
        { customer_type: "funcionario", proxis_tpr_id: null },
        { customer_type: "funcionario", proxis_tpr_id: null },
      ],
      ["funcionario"],
    );
    expect(tabelas).toHaveLength(1);
    expect(tabelas[0]).toMatchObject({ produtos: 3, produtosAtivos: 3, pessoas: 2, editavel: true });
  });

  it("mostra um tipo conhecido que ainda nao tem preco nenhum", () => {
    // Sem isto, a unica forma de descobrir que o tipo existe seria errando.
    const tabelas = resumirTabelasPorTipo([], [], ["lojista"]);
    expect(tabelas.map((t) => t.customerType)).toContain("lojista");
    expect(tabelas[0].produtos).toBe(0);
  });

  it("acusa a tabela quase vazia que tem gente comprando por ela", () => {
    // O caso real: a geral `cliente` tinha 1 produto e 6 clientes sem TPR.
    const tabelas = resumirTabelasPorTipo(
      [preco("cliente", null, "2188")],
      Array.from({ length: 6 }, () => ({ customer_type: "cliente", proxis_tpr_id: null })),
      ["cliente"],
    );
    expect(tabelas[0].alerta).toEqual({
      gravidade: "aviso",
      texto: "Quase sem preços: quase tudo sai pelo preço normal do catálogo",
    });
  });

  it("acusa como erro a tabela sem nenhum preco ativo e com gente dentro", () => {
    const tabelas = resumirTabelasPorTipo(
      [preco("lojista", null, "1", false)],
      [{ customer_type: "lojista", proxis_tpr_id: null }],
      ["lojista"],
    );
    expect(tabelas[0].alerta?.gravidade).toBe("erro");
  });

  it("linha desligada nao conta como preco ativo", () => {
    const tabelas = resumirTabelasPorTipo(
      [preco("funcionario", null, "1"), preco("funcionario", null, "2", false)],
      [],
      ["funcionario"],
    );
    expect(tabelas[0]).toMatchObject({ produtos: 2, produtosAtivos: 1 });
  });
});

describe("resumirTabelasNegociadas", () => {
  it("toda tabela e editavel desde a saida do Proxis", () => {
    // Antes elas eram espelho do ERP e a tela recusava edicao. Sem ERP, o preco
    // passa a ser mantido aqui — como ja era o da tabela de funcionario.
    const tabelas = resumirTabelasNegociadas([preco("cliente", 8728, "1")], [], [
      { tprId: 8728, description: "Representante Nacional" },
    ]);
    expect(tabelas[0].editavel).toBe(true);
    expect(tabelas[0].nome).toBe("Representante Nacional");
  });

  it("acusa cliente numa tabela que nao tem preco importado", () => {
    // O caso real das TPR 80 e 82: tres clientes, zero precos.
    const tabelas = resumirTabelasNegociadas(
      [],
      [
        { customer_type: "cliente", proxis_tpr_id: 80 },
        { customer_type: "cliente", proxis_tpr_id: 80 },
      ],
      [],
    );
    expect(tabelas[0]).toMatchObject({ tprId: 80, pessoas: 2, produtos: 0 });
    expect(tabelas[0].alerta?.gravidade).toBe("erro");
    expect(tabelas[0].alerta?.texto).toContain("não está cadastrada");
  });

  it("acusa tabela importada que ninguem usa", () => {
    // O caso real das 8744 e 8745: ~150 produtos cada, zero clientes.
    const tabelas = resumirTabelasNegociadas([preco("cliente", 8744, "1")], [], [
      { tprId: 8744, description: "Tabela 8744" },
    ]);
    expect(tabelas[0].alerta).toEqual({ gravidade: "aviso", texto: "Nenhum cliente usa esta tabela" });
  });

  it("ordena pelas que atendem mais gente", () => {
    const tabelas = resumirTabelasNegociadas(
      [],
      [
        { customer_type: "cliente", proxis_tpr_id: 8729 },
        { customer_type: "cliente", proxis_tpr_id: 8728 },
        { customer_type: "cliente", proxis_tpr_id: 8728 },
      ],
      [],
    );
    expect(tabelas.map((t) => t.tprId)).toEqual([8728, 8729]);
  });
});

describe("alertasDasTabelas", () => {
  it("poe erro antes de aviso e ignora tabela sadia", () => {
    const site = resumirTabelasPorTipo(
      [preco("funcionario", null, "1"), preco("funcionario", null, "2"), preco("funcionario", null, "3")],
      [{ customer_type: "funcionario", proxis_tpr_id: null }],
      ["funcionario"],
    );
    const proxis = resumirTabelasNegociadas(
      [preco("cliente", 8744, "1")],
      [{ customer_type: "cliente", proxis_tpr_id: 80 }],
      [{ tprId: 8744, description: "Sem uso" }],
    );
    const alertas = alertasDasTabelas([...site, ...proxis]);
    expect(alertas).toHaveLength(2);
    expect(alertas[0].alerta.gravidade).toBe("erro");
    expect(alertas[1].alerta.gravidade).toBe("aviso");
  });
});

describe("tabela padrão de quem se cadastra", () => {
  it("marca a 8728, que é a tabela que toda conta nova recebe", () => {
    // Regra antiga do projeto, em `proxisTpr.ts`: `DEFAULT_PROXSIS_TPR_ID`.
    // Sem o selo, não havia como saber, olhando a tela, qual das tabelas do
    // Proxis é a que vale para quem acabou de se cadastrar.
    const tabelas = resumirTabelasNegociadas([], [], [
      { tprId: 8729, description: "Outra" },
      { tprId: 8728, description: "Representante Nacional" },
    ]);
    expect(tabelas.find((t) => t.tprId === 8728)?.padraoDeNovasContas).toBe(true);
    expect(tabelas.find((t) => t.tprId === 8729)?.padraoDeNovasContas).toBe(false);
  });

  it("a padrão vem primeiro, mesmo com menos clientes que outra", () => {
    const tabelas = resumirTabelasNegociadas(
      [],
      [
        { customer_type: "cliente", proxis_tpr_id: 8729 },
        { customer_type: "cliente", proxis_tpr_id: 8729 },
        { customer_type: "cliente", proxis_tpr_id: 8728 },
      ],
      [],
    );
    expect(tabelas[0].tprId).toBe(8728);
  });

  it("tabela do site nunca é marcada como padrão de novas contas", () => {
    const tabelas = resumirTabelasPorTipo([], [], ["funcionario"]);
    expect(tabelas[0].padraoDeNovasContas).toBe(false);
  });
});

describe("lerChaveDeTabela", () => {
  it("lê a tabela do site", () => {
    expect(lerChaveDeTabela("tipo:funcionario")).toEqual({
      origem: "tipo",
      customerType: "funcionario",
      tprId: null,
    });
  });

  it("lê a tabela do Proxis", () => {
    expect(lerChaveDeTabela("negociada:8728")).toEqual({ origem: "negociada", customerType: null, tprId: 8728 });
  });

  it("devolve null para lixo, para o link velho cair na lista", () => {
    for (const entrada of [null, undefined, "", "tipo:", "negociada:", "negociada:abc", "negociada:-1", "outra:coisa", "8728"]) {
      expect(lerChaveDeTabela(entrada)).toBeNull();
    }
  });

  it("a chave que o resumo gera é a que o leitor entende", () => {
    // As duas pontas têm de casar: o resumo escreve a chave na lista e a URL a
    // devolve depois. Divergindo, o link abriria a tela vazia.
    const site = resumirTabelasPorTipo([], [], ["funcionario"])[0];
    expect(lerChaveDeTabela(site.chave)).toMatchObject({ origem: "tipo", customerType: "funcionario" });

    const proxis = resumirTabelasNegociadas([], [{ customer_type: "cliente", proxis_tpr_id: 8728 }], [])[0];
    expect(lerChaveDeTabela(proxis.chave)).toMatchObject({ origem: "negociada", tprId: 8728 });
  });
});

describe("filtrarTabelasNegociadas", () => {
  const resumo = (tprId: number, pessoas: number, produtos: number) =>
    resumirTabelasNegociadas(
      Array.from({ length: produtos }, (_, i) => preco("cliente", tprId, String(i))),
      Array.from({ length: pessoas }, () => ({ customer_type: "cliente", proxis_tpr_id: tprId })),
      [{ tprId, description: `Tabela ${tprId}` }],
    )[0];

  it("esconde a tabela sem produto e sem conta", () => {
    const { visiveis, ocultas } = filtrarTabelasNegociadas([resumo(9001, 0, 0)]);
    expect(visiveis).toHaveLength(0);
    expect(ocultas).toBe(1);
  });

  it("esconde a tabela cheia de produtos que ninguém usa", () => {
    // As duas que o dono do projeto pediu para tirar: ~150 produtos, zero contas.
    const { visiveis, ocultas } = filtrarTabelasNegociadas([resumo(8744, 0, 150)]);
    expect(visiveis).toHaveLength(0);
    expect(ocultas).toBe(1);
  });

  it("mantém a tabela com conta e sem preço, que é o problema a mostrar", () => {
    // TPR 80: três clientes comprando pelo preço do catálogo sem ninguém saber.
    const { visiveis } = filtrarTabelasNegociadas([resumo(80, 3, 0)]);
    expect(visiveis).toHaveLength(1);
    expect(visiveis[0].alerta?.gravidade).toBe("erro");
  });

  it("mantém a padrão de novas contas mesmo zerada", () => {
    const { visiveis, ocultas } = filtrarTabelasNegociadas([resumo(8728, 0, 0)]);
    expect(visiveis.map((t) => t.tprId)).toEqual([8728]);
    expect(ocultas).toBe(0);
  });

  it("conta quantas ficaram de fora, para a tela poder dizer", () => {
    const { visiveis, ocultas } = filtrarTabelasNegociadas([
      resumo(8728, 18, 138),
      resumo(8744, 0, 150),
      resumo(9001, 0, 0),
      resumo(9002, 0, 0),
    ]);
    expect(visiveis.map((t) => t.tprId)).toEqual([8728]);
    expect(ocultas).toBe(3);
  });
});
