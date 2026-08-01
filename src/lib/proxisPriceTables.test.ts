import { describe, expect, it } from "vitest";
import {
  fetchAllProxisPriceTables,
  normalizeProxisPriceTable,
  toPriceOverrideRows,
} from "./proxisPriceTables";

/** Recorte fiel do que `ObterTabelasPreco` devolve. */
const bruta = {
  tpr_id: 8728.0,
  tpr_descricao: "CLINIC MAIS REPRESENTANTE NACIONAL 2026",
  ativo: true,
  tabelapreco: [
    { ite_numero: "2188", tit_preco: 3.55, ite_descricao: "CHA ANIS" },
    { ite_numero: "5037", tit_preco: 60.0, ite_descricao: "VITAMINA D3" },
  ],
};

describe("normalizeProxisPriceTable", () => {
  it("lê o cabeçalho e os itens", () => {
    const t = normalizeProxisPriceTable(bruta)!;
    expect(t.tprId).toBe(8728);
    expect(t.description).toBe("CLINIC MAIS REPRESENTANTE NACIONAL 2026");
    expect(t.items).toHaveLength(2);
    expect(t.items[0]).toEqual({ productCode: "2188", price: 3.55, description: "CHA ANIS" });
  });

  /**
   * O defeito que colocou 143 produtos por R$ 0,00 na vitrine. Zero numa tabela
   * de preco quer dizer "nao precificado aqui", nunca "de graca".
   */
  it("descarta item com preço zero", () => {
    const t = normalizeProxisPriceTable({
      ...bruta,
      tabelapreco: [{ ite_numero: "2188", tit_preco: 0 }],
    })!;
    expect(t.items).toHaveLength(0);
  });

  it("descarta item sem código", () => {
    const t = normalizeProxisPriceTable({ ...bruta, tabelapreco: [{ ite_numero: "  ", tit_preco: 9 }] })!;
    expect(t.items).toHaveLength(0);
  });

  it("normaliza o código para caixa alta", () => {
    const t = normalizeProxisPriceTable({ ...bruta, tabelapreco: [{ ite_numero: " cha-001 ", tit_preco: 9 }] })!;
    expect(t.items[0].productCode).toBe("CHA-001");
  });

  it("mantém a última linha quando o produto vem repetido", () => {
    const t = normalizeProxisPriceTable({
      ...bruta,
      tabelapreco: [
        { ite_numero: "2188", tit_preco: 3.55 },
        { ite_numero: "2188", tit_preco: 3.95 },
      ],
    })!;
    expect(t.items).toHaveLength(1);
    expect(t.items[0].price).toBe(3.95);
  });

  it("ignora tabela sem tpr_id", () => {
    expect(normalizeProxisPriceTable({ tpr_descricao: "x" })).toBeNull();
  });
});

describe("fetchAllProxisPriceTables", () => {
  it("pagina até a origem parar de devolver", async () => {
    const paginas = [[bruta, bruta], [bruta]];
    const chamadas: number[] = [];
    const tabelas = await fetchAllProxisPriceTables(async (start) => {
      chamadas.push(start);
      return paginas.shift() ?? [];
    }, 2);

    expect(chamadas).toEqual([0, 2]);
    expect(tabelas).toHaveLength(3);
  });

  it("para na primeira página vazia", async () => {
    const tabelas = await fetchAllProxisPriceTables(async () => [], 50);
    expect(tabelas).toEqual([]);
  });
});

describe("toPriceOverrideRows", () => {
  it("guarda só o que o catálogo vende", () => {
    const t = normalizeProxisPriceTable(bruta)!;
    const rows = toPriceOverrideRows(t, "cliente", new Set(["2188"]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      customer_type: "cliente",
      proxis_tpr_id: 8728,
      product_code: "2188",
      price: 3.55,
      active: true,
    });
  });

  it("sem lista de códigos, guarda tudo", () => {
    const t = normalizeProxisPriceTable(bruta)!;
    expect(toPriceOverrideRows(t, "cliente")).toHaveLength(2);
  });
});
