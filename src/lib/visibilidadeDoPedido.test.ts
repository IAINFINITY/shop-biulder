import { describe, expect, it } from "vitest";
import { pedidoEhVisivelParaOTitular, pedidosDoTitular } from "@/lib/visibilidadeDoPedido";

/**
 * A regra que decide de quem é o pedido.
 *
 * ## O caso que originou tudo isto
 *
 * 02/09/2026: uma funcionária abriu "Meus pedidos" e viu o pedido de outra.
 * Os 97 perfis de funcionário compartilham `linked_company_cnpj` — o CNPJ da
 * Clinic+ — e a regra casava por CNPJ.
 *
 * O teste de baixo, "funcionária não vê o pedido da colega", é o que impede
 * essa volta. Ele é a razão deste arquivo existir.
 */

const CNPJ_DA_CLINIC = "04163851000106";

const FUNCIONARIA = {
  cnpj: "09914012981",
  linked_company_cnpj: CNPJ_DA_CLINIC,
  customer_type: "funcionario",
};

const CLIENTE = {
  cnpj: "59.476.025/0001-09",
  linked_company_cnpj: null,
  customer_type: "cliente",
};

describe("funcionário", () => {
  it("⚠️ não vê o pedido da colega, mesmo com o CNPJ da empresa igual", () => {
    const daColega = { customer_cnpj: CNPJ_DA_CLINIC, user_id: "outra-pessoa" };
    expect(pedidoEhVisivelParaOTitular(daColega, FUNCIONARIA, "eu")).toBe(false);
  });

  it("vê o próprio pedido, que carrega o mesmo CNPJ da empresa", () => {
    const meu = { customer_cnpj: CNPJ_DA_CLINIC, user_id: "eu" };
    expect(pedidoEhVisivelParaOTitular(meu, FUNCIONARIA, "eu")).toBe(true);
  });

  // Pedido antigo, anterior à coluna `user_id` e sem telefone que o
  // identificasse no backfill. Some da lista — e é o certo: sem dono
  // registrado, a única pista é o CNPJ da empresa, que não distingue ninguém.
  it("não vê pedido sem dono, ainda que da empresa dele", () => {
    const semDono = { customer_cnpj: CNPJ_DA_CLINIC, user_id: null };
    expect(pedidoEhVisivelParaOTitular(semDono, FUNCIONARIA, "eu")).toBe(false);
  });
});

describe("cliente B2B", () => {
  it("continua vendo os pedidos do próprio CNPJ, com ou sem pontuação", () => {
    const daEmpresa = { customer_cnpj: "59476025000109", user_id: null };
    expect(pedidoEhVisivelParaOTitular(daEmpresa, CLIENTE, "eu")).toBe(true);
  });

  it("vê o pedido do CNPJ ao qual sua conta está vinculada", () => {
    const filial = { cnpj: "11111111000111", linked_company_cnpj: "59476025000109", customer_type: "cliente" };
    expect(pedidoEhVisivelParaOTitular({ customer_cnpj: "59476025000109" }, filial, "eu")).toBe(true);
  });

  it("não vê o pedido de outra empresa", () => {
    expect(pedidoEhVisivelParaOTitular({ customer_cnpj: "30408676000180" }, CLIENTE, "eu")).toBe(false);
  });

  it("vê o próprio pedido mesmo se o CNPJ do cadastro mudou depois", () => {
    // Trocar o CNPJ no cadastro não deve apagar o histórico de quem comprou.
    const antigo = { customer_cnpj: "00000000000000", user_id: "eu" };
    expect(pedidoEhVisivelParaOTitular(antigo, CLIENTE, "eu")).toBe(true);
  });
});

describe("bordas", () => {
  it("sem perfil, não vê nada", () => {
    expect(pedidoEhVisivelParaOTitular({ customer_cnpj: CNPJ_DA_CLINIC, user_id: "eu" }, null, "eu")).toBe(false);
  });

  // ⚠️ Pedido sem CNPJ e perfil sem CNPJ não podem casar por "vazio = vazio".
  it("vazio não casa com vazio", () => {
    const semCnpj = { cnpj: "", linked_company_cnpj: null, customer_type: "cliente" };
    expect(pedidoEhVisivelParaOTitular({ customer_cnpj: "" }, semCnpj, "eu")).toBe(false);
    expect(pedidoEhVisivelParaOTitular({ customer_cnpj: null }, semCnpj, "eu")).toBe(false);
  });

  it("deslogado não vira dono de pedido sem dono", () => {
    expect(pedidoEhVisivelParaOTitular({ customer_cnpj: CNPJ_DA_CLINIC, user_id: null }, FUNCIONARIA, null)).toBe(false);
  });
});

describe("pedidosDoTitular", () => {
  it("filtra a lista mantendo a ordem", () => {
    const lista = [
      { id: "a", customer_cnpj: CNPJ_DA_CLINIC, user_id: "eu" },
      { id: "b", customer_cnpj: CNPJ_DA_CLINIC, user_id: "colega" },
      { id: "c", customer_cnpj: CNPJ_DA_CLINIC, user_id: "eu" },
    ];
    expect(pedidosDoTitular(lista, FUNCIONARIA, "eu").map((p) => p.id)).toEqual(["a", "c"]);
  });
});
