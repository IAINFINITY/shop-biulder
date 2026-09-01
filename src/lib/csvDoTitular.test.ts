import { describe, expect, it } from "vitest";
import { BOM_DO_EXCEL, dataParaCelula, gerarCsv, simOuNao, type ColunaCsv } from "@/lib/csvDoTitular";
import { csvDaSecao, linhasDaSecao, montarPacoteDeDados, type PartesDoPacote } from "@/lib/meusDados";

/**
 * O CSV do titular.
 *
 * Este arquivo sai da empresa e vai para a máquina de outra pessoa — é o único
 * lugar do projeto onde um erro de formatação não é um bug de tela, é um dado
 * pessoal entregue errado.
 */

const COLUNAS: ColunaCsv[] = [
  { rotulo: "Nome", valor: (r) => String(r.nome ?? "") },
  { rotulo: "Valor", valor: (r) => Number(r.valor) || 0 },
];

describe("gerarCsv", () => {
  it("separa com ponto e vírgula, que é o que o Excel em português abre", () => {
    // Com vírgula, a planilha inteira cai numa coluna só numa máquina pt-BR:
    // o arquivo estaria tecnicamente correto e inútil na prática.
    const csv = gerarCsv(COLUNAS, [{ nome: "Ana", valor: 10 }]);
    expect(csv.split("\r\n")[0]).toBe("Nome;Valor");
  });

  it("escreve número com vírgula decimal", () => {
    const csv = gerarCsv(COLUNAS, [{ nome: "Ana", valor: 24.99 }]);
    expect(csv).toContain("Ana;24,99");
  });

  it("põe entre aspas o campo que contém o separador", () => {
    // Sem isto "Rua A; 30" viraria duas colunas e empurraria o resto da linha.
    const csv = gerarCsv(COLUNAS, [{ nome: "Rua A; 30", valor: 1 }]);
    expect(csv).toContain('"Rua A; 30";1,00');
  });

  it("dobra a aspa que existir dentro do campo", () => {
    const csv = gerarCsv(COLUNAS, [{ nome: 'Loja "Sol"', valor: 1 }]);
    expect(csv).toContain('"Loja ""Sol""";1,00');
  });

  it("mantém a quebra de linha dentro da célula, entre aspas", () => {
    // Comentário de avaliação tem parágrafo. Sem as aspas ele viraria duas
    // linhas da planilha, e a segunda ficaria sem as outras colunas.
    const csv = gerarCsv(COLUNAS, [{ nome: "linha 1\nlinha 2", valor: 1 }]);
    expect(csv).toContain('"linha 1\nlinha 2"');
    expect(csv.trimEnd().split("\r\n")).toHaveLength(2);
  });

  // ⚠️ Uma célula que começa com `=` é executada como fórmula quando a planilha
  // abre. O nome de uma empresa não pode virar `=HYPERLINK(...)` na máquina de
  // quem receber o arquivo.
  it("neutraliza texto que a planilha executaria como fórmula", () => {
    for (const perigoso of ["=1+1", "+1", "-1+1", "@SUM(A1)"]) {
      const csv = gerarCsv(COLUNAS, [{ nome: perigoso, valor: 0 }]);
      expect(csv, perigoso).toContain(`'${perigoso}`);
    }
  });

  it("não estraga número negativo, que também começa com sinal", () => {
    const csv = gerarCsv(COLUNAS, [{ nome: "x", valor: -5 }]);
    expect(csv).toContain("x;-5,00");
  });

  it("gera só o cabeçalho quando não há registro", () => {
    expect(gerarCsv(COLUNAS, [])).toBe("Nome;Valor\r\n");
  });

  it("o marcador de UTF-8 fica fora do conteúdo", () => {
    // Ele é assunto do arquivo, não do texto: quem só quer o conteúdo não leva
    // um caractere invisível no começo da primeira coluna.
    expect(gerarCsv(COLUNAS, [])).not.toContain(BOM_DO_EXCEL);
    expect(BOM_DO_EXCEL).toHaveLength(1);
  });
});

describe("dataParaCelula", () => {
  it("devolve vazio quando a data não existe ou não presta", () => {
    // "Invalid Date" numa planilha de dado pessoal é pior que célula vazia.
    for (const entrada of [null, undefined, "", "ontem", 42]) {
      expect(dataParaCelula(entrada)).toBe("");
    }
  });

  it("formata em dd/mm/aaaa, que é o que a célula pt-BR reconhece", () => {
    expect(dataParaCelula("2026-09-01T14:07:00.000Z")).toMatch(/^\d{2}\/\d{2}\/\d{4}/);
  });
});

describe("simOuNao", () => {
  it("não escreve TRUE numa planilha para gente", () => {
    expect(simOuNao(true)).toBe("Sim");
    expect(simOuNao(false)).toBe("Não");
    expect(simOuNao(null)).toBe("Não");
  });
});

const VAZIO: PartesDoPacote = {
  perfil: null,
  enderecos: [],
  pedidos: [],
  avaliacoes: [],
  favoritos: [],
  conversas: [],
  mensagens: [],
  aparelhos: [],
};

describe("linhasDaSecao", () => {
  const pedido = {
    id: "ped-1",
    created_at: "2026-09-01T14:07:00.000Z",
    status: "NOVO CARRINHO",
    customer_address_street: "Rua A",
    customer_address_number: "30",
    customer_address_city: "Maceió",
    customer_address_state: "AL",
    items: [
      { name: "5 Óleos", product_code: "7161", quantity: 3, unit_price: 16.24, line_total: 48.72 },
      { name: "Ômega 3", product_code: "7162", quantity: 1, unit_price: 32.99, line_total: 32.99 },
    ],
  };

  it("abre o pedido em uma linha por item", () => {
    // Uma linha por pedido teria de espremer os itens numa célula, e é o item
    // que a pessoa vai querer somar na planilha.
    const linhas = linhasDaSecao("pedidos", [pedido]);
    expect(linhas).toHaveLength(2);
    expect(linhas[0].produto).toBe("5 Óleos");
    expect(linhas[0].quantidade).toBe(3);
    expect(linhas[1].total_do_item).toBe(32.99);
  });

  it("repete os campos do pedido em cada item", () => {
    const linhas = linhasDaSecao("pedidos", [pedido]);
    for (const linha of linhas) {
      expect(linha.pedido_id).toBe("ped-1");
      expect(linha.entrega).toContain("Rua A, 30");
    }
  });

  it("mantém o pedido sem item, para a contagem da tela não mentir", () => {
    const linhas = linhasDaSecao("pedidos", [{ ...pedido, items: [] }]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].produto).toBe("");
  });

  it("as outras seções saem como estão", () => {
    const registros = [{ label: "Casa" }, { label: "Trabalho" }];
    expect(linhasDaSecao("enderecos", registros)).toEqual(registros);
  });
});

describe("csvDaSecao", () => {
  it("exporta uma seção sem arrastar as outras junto", () => {
    // É o pedido que originou tudo isto: "quero só meu endereço de entrega".
    const pacote = montarPacoteDeDados({ id: "u1", email: "a@b.c" }, {
      ...VAZIO,
      enderecos: [{ label: "Casa", street: "Rua A", number: "30", city: "Maceió", state: "AL", is_default: true }],
      pedidos: [{ id: "x", created_at: "2026-09-01T00:00:00.000Z", status: "NOVO", items: [] }],
    });

    const csv = csvDaSecao(pacote, "enderecos");
    expect(csv).toContain("Casa");
    expect(csv).toContain("Sim");
    expect(csv).not.toContain("NOVO");
  });

  it("toda seção do pacote sabe virar planilha", () => {
    // Seção nova sem coluna declarada sairia como um arquivo de cabeçalho
    // vazio, e ninguém perceberia até alguém baixar.
    const pacote = montarPacoteDeDados({ id: "u1", email: null }, VAZIO);
    for (const chave of Object.keys(pacote.secoes) as (keyof typeof pacote.secoes)[]) {
      const csv = csvDaSecao(pacote, chave as never);
      expect(csv.trim().length, `seção ${String(chave)}`).toBeGreaterThan(0);
    }
  });
});
