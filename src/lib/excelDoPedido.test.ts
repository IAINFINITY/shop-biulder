import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { montarPlanilhaDoPedido } from "./excelDoPedido";
import type { OrderExportInput } from "./orderExportTypes";

/**
 * A planilha do pedido.
 *
 * Os testes olham as **propriedades da planilha**, não o texto: largura de
 * coluna, formato de número e painel congelado é o que separava a versão
 * anterior de uma planilha utilizável, e nada disso aparece lendo células.
 */

const MAPAS: OrderExportInput["enrichmentMaps"] = {
  codeByProductId: new Map(),
  priceByProductId: new Map(),
  codeByProductName: new Map(),
  priceByProductName: new Map(),
  imageByProductId: new Map(),
  imageByProductName: new Map(),
};

function pedido(partes: Partial<OrderExportInput> = {}): OrderExportInput {
  return {
    id: "abc",
    created_at: "2026-09-01T11:03:00.000Z",
    customer_name: "sergio bilibio",
    customer_company: "LOJA MAGAZINE NATURAL LTDA",
    customer_phone: "55996504118",
    customer_cnpj: "59476025000109",
    customer_tpr_id: null,
    status: "NOVO CARRINHO",
    items: [
      { code: "7161", name: "5 Óleos", quantity: 13, unit_price: 16.24 },
      { code: "7229", name: "Creatina Monohidratada", quantity: 3, unit_price: 17.54 },
    ],
    proxis_import_id: null,
    enrichmentMaps: MAPAS,
    numeroDoPedido: 35,
    customer_address_street: "av 21 de abril",
    customer_address_number: "430",
    customer_address_city: "Ijuí",
    customer_address_state: "RS",
    customer_address_cep: "98700-000",
    ...partes,
  };
}

function planilhaDe(order: OrderExportInput) {
  const arquivo = montarPlanilhaDoPedido(order, order.numeroDoPedido ?? 0);
  return arquivo.Sheets[arquivo.SheetNames[0]];
}

/** Onde está o cabeçalho da tabela — as linhas de identificação variam. */
function linhaDoCabecalho(planilha: XLSX.WorkSheet): number {
  const grade = XLSX.utils.sheet_to_json<string[]>(planilha, { header: 1, blankrows: true });
  return grade.findIndex((linha) => linha?.[0] === "Código");
}

describe("montarPlanilhaDoPedido", () => {
  it("a aba se chama Pedido", () => {
    const arquivo = montarPlanilhaDoPedido(pedido(), 35);
    expect(arquivo.SheetNames).toEqual(["Pedido"]);
  });

  // ⚠️ Sem largura, toda coluna nasce com ~8 caracteres e o nome do produto sai
  // cortado — o primeiro gesto de quem abria era arrastar cinco divisórias.
  it("as colunas têm largura, e a do produto é a maior", () => {
    const colunas = planilhaDe(pedido())["!cols"];
    expect(colunas).toHaveLength(5);
    expect(colunas?.[1].wch).toBeGreaterThan(40);
  });

  // ⚠️ `z` só vale em célula numérica. Se o valor entrar como texto, o formato
  // é ignorado em silêncio e a planilha deixa de somar.
  it("dinheiro é número e tem formato de moeda", () => {
    const planilha = planilhaDe(pedido());
    const primeira = linhaDoCabecalho(planilha) + 1;

    const unitario = planilha[XLSX.utils.encode_cell({ r: primeira, c: 3 })];
    expect(unitario.t).toBe("n");
    expect(unitario.v).toBe(16.24);
    expect(unitario.z).toContain("R$");
  });

  it("a quantidade também é número, e não texto", () => {
    const planilha = planilhaDe(pedido());
    const quantidade = planilha[XLSX.utils.encode_cell({ r: linhaDoCabecalho(planilha) + 1, c: 2 })];
    expect(quantidade.t).toBe("n");
    expect(quantidade.v).toBe(13);
  });

  // ⚠️ O total ficava em duas linhas soltas, com o rótulo em A, a quantidade em
  // C e o valor em E — três células que não se leem como um fecho de tabela.
  it("o total fecha a tabela nas mesmas colunas que soma", () => {
    const planilha = planilhaDe(pedido());
    const grade = XLSX.utils.sheet_to_json<(string | number)[]>(planilha, { header: 1, blankrows: true });
    const ultima = grade[grade.length - 1];

    expect(ultima[1]).toBe("Total do pedido");
    expect(ultima[2]).toBe(16); // 13 + 3
    expect(ultima[4]).toBeCloseTo(13 * 16.24 + 3 * 17.54, 2);
  });

  it("congela o cabeçalho e liga o filtro na tabela", () => {
    const planilha = planilhaDe(pedido());
    const cabecalho = linhaDoCabecalho(planilha);

    expect(planilha["!freeze"]?.ySplit).toBe(cabecalho + 1);
    // O filtro cobre o cabeçalho e os itens, **sem** a linha de total: incluí-la
    // faria o Excel ordenar o total junto com os produtos.
    expect(planilha["!autofilter"]?.ref).toBe(
      XLSX.utils.encode_range({ r: cabecalho, c: 0 }, { r: cabecalho + 2, c: 4 }),
    );
  });

  it("documento e telefone saem formatados, e não como dígitos crus", () => {
    const grade = XLSX.utils.sheet_to_json<string[]>(planilhaDe(pedido()), { header: 1, blankrows: true });
    const texto = grade.flat().join(" ");
    expect(texto).toContain("59.476.025/0001-09");
    expect(texto).toContain("(55) 99650-4118");
  });

  it("pedido sem endereço não cria a linha de entrega vazia", () => {
    const grade = XLSX.utils.sheet_to_json<string[]>(
      planilhaDe(
        pedido({
          customer_address_street: null,
          customer_address_number: null,
          customer_address_city: null,
          customer_address_state: null,
          customer_address_cep: null,
        }),
      ),
      { header: 1, blankrows: true },
    );
    expect(grade.some((linha) => linha?.[0] === "Entrega")).toBe(false);
  });

  it("pedido sem itens ainda gera a planilha", () => {
    const grade = XLSX.utils.sheet_to_json<(string | number)[]>(planilhaDe(pedido({ items: [] })), {
      header: 1,
      blankrows: true,
    });
    expect(grade[grade.length - 1][4]).toBe(0);
  });
});
