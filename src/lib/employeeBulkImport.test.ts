import { describe, expect, it } from "vitest";
import { EXEMPLO_TXT, SENHA_PADRAO, lerTxtDeFuncionarios } from "./employeeBulkImport";

describe("importação de funcionários por TXT", () => {
  it("lê uma linha completa e normaliza telefone, CPF e e-mail", () => {
    const { validos, erros } = lerTxtDeFuncionarios("Maria Souza,MARIA@empresa.com,(11) 91234-5678,123.456.789-01");

    expect(erros).toHaveLength(0);
    expect(validos[0]).toEqual({
      linha: 1,
      nome: "Maria Souza",
      email: "maria@empresa.com",
      telefone: "11912345678",
      cpf: "12345678901",
    });
  });

  it("aceita ponto e vírgula e tabulação além da vírgula", () => {
    // Planilha brasileira exporta com `;` e quem cola de uma tabela traz tab.
    const comPonto = lerTxtDeFuncionarios("Ana;ana@x.com;11912345678;12345678901");
    const comTab = lerTxtDeFuncionarios("Ana\tana@x.com\t11912345678\t12345678901");

    expect(comPonto.validos).toHaveLength(1);
    expect(comTab.validos).toHaveLength(1);
  });

  it("ignora linha em branco, comentário e cabeçalho", () => {
    const { validos, ignoradas } = lerTxtDeFuncionarios(
      ["nome,email,telefone,cpf", "", "# um comentário", "Ana,ana@x.com,11912345678,12345678901"].join("\n"),
    );

    expect(validos).toHaveLength(1);
    expect(ignoradas).toBe(3);
  });

  it("aponta a linha e o motivo de cada recusa", () => {
    const { validos, erros } = lerTxtDeFuncionarios(
      [
        "Ana,ana@x.com,11912345678,12345678901",
        "Bruno,sem-arroba,11912345678,12345678901",
        "Carla,carla@x.com,123,12345678901",
        "Diego,diego@x.com,11912345678,123",
        "SóDoisCampos,x@y.com",
      ].join("\n"),
    );

    expect(validos).toHaveLength(1);
    expect(erros.map((e) => e.linha)).toEqual([2, 3, 4, 5]);
    expect(erros[0].motivo).toContain("E-mail inválido");
    expect(erros[1].motivo).toContain("Telefone");
    expect(erros[2].motivo).toContain("CPF");
    expect(erros[3].motivo).toContain("4 campos");
  });

  /**
   * Sem esta checagem a segunda linha repetida so falharia no servidor, no meio
   * da importacao — com metade dos funcionarios ja criados e sem saber quais.
   */
  it("recusa e-mail e CPF repetidos dentro do próprio arquivo", () => {
    const { validos, erros } = lerTxtDeFuncionarios(
      [
        "Ana,ana@x.com,11912345678,12345678901",
        "Ana de novo,ANA@x.com,11912345679,99999999999",
        "Outro CPF igual,outro@x.com,11912345670,123.456.789-01",
      ].join("\n"),
    );

    expect(validos).toHaveLength(1);
    expect(erros[0].motivo).toContain("E-mail repetido");
    expect(erros[0].motivo).toContain("linha 1");
    expect(erros[1].motivo).toContain("CPF repetido");
  });

  /**
   * O banco tambem barra — e-mail pelo Auth, CPF pelo indice unico. Mas so na
   * hora de criar, um por vez: sem esta checagem, um arquivo com 10 pessoas ja
   * cadastradas gastaria 10 idas ao servidor para descobrir o que ja se sabia.
   */
  it("recusa quem já está cadastrado, antes de enviar qualquer coisa", () => {
    const jaCadastrados = [
      { email: "Ana@X.com", cpf: "123.456.789-01" },
      { email: null, cpf: "99999999999" },
    ];

    const { validos, erros } = lerTxtDeFuncionarios(
      [
        "Ana,ana@x.com,11912345678,11122233344",
        "Bruno,bruno@x.com,11912345678,12345678901",
        "Carla,carla@x.com,11912345678,99999999999",
        "Novo de verdade,novo@x.com,11912345678,55566677788",
      ].join("\n"),
      jaCadastrados,
    );

    expect(validos.map((v) => v.nome)).toEqual(["Novo de verdade"]);
    expect(erros[0].motivo).toContain("E-mail já cadastrado");
    expect(erros[1].motivo).toContain("CPF já cadastrado");
    expect(erros[2].motivo).toContain("CPF já cadastrado");
  });

  it("sem lista de já cadastrados, não barra ninguém por isso", () => {
    const { validos } = lerTxtDeFuncionarios("Ana,ana@x.com,11912345678,12345678901");
    expect(validos).toHaveLength(1);
  });

  it("a senha padrão passa nas regras do cadastro individual", () => {
    expect(SENHA_PADRAO.length).toBeGreaterThanOrEqual(8);
    expect(SENHA_PADRAO.length).toBeLessThanOrEqual(64);
    expect(SENHA_PADRAO).toMatch(/[A-Z]/);
    expect(SENHA_PADRAO).toMatch(/[a-z]/);
    expect(SENHA_PADRAO).toMatch(/\d/);
    expect(SENHA_PADRAO).toMatch(/[!@#$%^&*(),.?":{}|<>]/);
  });

  it("o exemplo distribuído é ele mesmo um arquivo válido", () => {
    const { validos, erros } = lerTxtDeFuncionarios(EXEMPLO_TXT);
    expect(erros).toHaveLength(0);
    expect(validos).toHaveLength(2);
  });
});
