import { describe, expect, it } from "vitest";
import { mapaDeTipoPorConta, pedidoTemCadastro, tipoDaContaDoPedido } from "@/lib/tipoDaContaDoPedido";

/**
 * A classificação do pedido por tipo de conta.
 *
 * O teste que importa é o primeiro: **o pedido de funcionário tem de sair como
 * "funcionario"**. Ele saía como "sem cadastro", porque a compra é gravada com
 * o CNPJ da Clinic+ e esse CNPJ não pertence a perfil nenhum — os funcionários
 * têm o próprio CPF no cadastro.
 *
 * Relatado em 02/09/2026: "estou com uma conta de administrador e não estou
 * vendo os pedidos dos funcionários. Aqui diz que só tem pedido de cliente e de
 * distribuidor."
 */

const CNPJ_DA_CLINIC = "04163851000106";

// `normalizeCustomerType` de verdade mora em `pricing.ts` e arrasta o módulo
// inteiro; aqui basta o contrato que a função pede.
const normalizar = (valor: unknown) => String(valor ?? "").trim().toLowerCase() || "cliente";

const PERFIS = [
  { user_id: "u-rafaela", cnpj: "09914012981", customer_type: "funcionario", linked_company_cnpj: CNPJ_DA_CLINIC },
  { user_id: "u-jaqui", cnpj: "06648780916", customer_type: "funcionario", linked_company_cnpj: CNPJ_DA_CLINIC },
  { user_id: "u-sergio", cnpj: "59476025000109", customer_type: "cliente", linked_company_cnpj: null },
  { user_id: "u-dimab", cnpj: "06302654000156", customer_type: "distribuidor", linked_company_cnpj: null },
];

const mapa = mapaDeTipoPorConta(PERFIS, normalizar);

describe("pedido de funcionário", () => {
  it("⚠️ é classificado como funcionário, e não como 'sem cadastro'", () => {
    const pedido = { user_id: "u-rafaela", customer_cnpj: CNPJ_DA_CLINIC };
    expect(tipoDaContaDoPedido(pedido, mapa)).toBe("funcionario");
  });

  it("dois funcionários diferentes continuam sendo duas contas", () => {
    // O CNPJ é o mesmo nos dois; só o dono separa.
    expect(tipoDaContaDoPedido({ user_id: "u-rafaela", customer_cnpj: CNPJ_DA_CLINIC }, mapa)).toBe("funcionario");
    expect(tipoDaContaDoPedido({ user_id: "u-jaqui", customer_cnpj: CNPJ_DA_CLINIC }, mapa)).toBe("funcionario");
    expect(mapa.get("u-rafaela")).toBe(mapa.get("u-jaqui"));
  });

  // O CNPJ da Clinic+ não é de perfil nenhum, então sem dono não há o que dizer.
  it("sem dono registrado, fica sem cadastro", () => {
    expect(tipoDaContaDoPedido({ customer_cnpj: CNPJ_DA_CLINIC }, mapa)).toBeNull();
  });
});

describe("os outros tipos", () => {
  it("classifica pelo CNPJ quando o pedido não sabe o dono", () => {
    expect(tipoDaContaDoPedido({ customer_cnpj: "59.476.025/0001-09" }, mapa)).toBe("cliente");
    expect(tipoDaContaDoPedido({ customer_cnpj: "06302654000156" }, mapa)).toBe("distribuidor");
  });

  it("o dono vale mais que o CNPJ", () => {
    // Cliente que comprou com o CNPJ de outra empresa continua sendo cliente.
    expect(tipoDaContaDoPedido({ user_id: "u-sergio", customer_cnpj: "06302654000156" }, mapa)).toBe("cliente");
  });

  it("aceita a coluna antiga quando não há `user_id`", () => {
    expect(tipoDaContaDoPedido({ customer_user_id: "u-sergio", customer_cnpj: "" }, mapa)).toBe("cliente");
  });

  it("pedido de quem não tem cadastro fica sem tipo", () => {
    expect(tipoDaContaDoPedido({ customer_cnpj: "11111111000111" }, mapa)).toBeNull();
    expect(tipoDaContaDoPedido({}, mapa)).toBeNull();
  });
});

describe("mapaDeTipoPorConta", () => {
  it("indexa por dono e por CNPJ", () => {
    expect(mapa.get("u-sergio")).toBe("cliente");
    expect(mapa.get("59476025000109")).toBe("cliente");
  });

  // ⚠️ Os 97 funcionários compartilham o `linked_company_cnpj`, mas cada um tem
  // o próprio CPF em `cnpj` — é esse que vira chave, e por isso não colidem.
  it("não deixa um funcionário sobrescrever o outro", () => {
    expect(mapa.get("09914012981")).toBe("funcionario");
    expect(mapa.get("06648780916")).toBe("funcionario");
  });

  it("trata como funcionário quem só tem o vínculo, antes do tipo chegar", () => {
    const recem = [{ user_id: "u-novo", cnpj: "12345678901", customer_type: "cliente", linked_company_cnpj: CNPJ_DA_CLINIC }];
    expect(mapaDeTipoPorConta(recem, normalizar).get("u-novo")).toBe("funcionario");
  });
});

describe("pedidoTemCadastro", () => {
  const indice = {
    userIdSet: new Set(["u-rafaela", "u-jaqui", "u-sergio"]),
    cnpjSet: new Set(["09914012981", "06648780916", "59476025000109"]),
    nameSet: new Set(["rafaela"]),
    companySet: new Set(["clinic+"]),
  };
  const texto = (v: string) => v.trim().toLowerCase();

  it("⚠️ o pedido de funcionário conta, mesmo com o CNPJ da Clinic+", () => {
    // Era aqui que 11 pedidos sumiam da "Operação diária": o CNPJ da Clinic+
    // não pertence a perfil nenhum, e a checagem parava nele.
    const pedido = { user_id: "u-rafaela", customer_cnpj: CNPJ_DA_CLINIC, customer_name: "Rafaela" };
    expect(pedidoTemCadastro(pedido, indice, texto)).toBe(true);
  });

  it("o dono decide, e decide sozinho", () => {
    // Conta apagada: o `user_id` sobrou no pedido e não está mais no índice.
    // Cair no CNPJ depois disso ressuscitaria o pedido órfão, que é o que este
    // filtro existe para esconder.
    const orfao = { user_id: "u-apagado", customer_cnpj: "59476025000109" };
    expect(pedidoTemCadastro(orfao, indice, texto)).toBe(false);
  });

  it("sem dono, cai no CNPJ, como sempre foi", () => {
    expect(pedidoTemCadastro({ customer_cnpj: "59.476.025/0001-09" }, indice, texto)).toBe(true);
    expect(pedidoTemCadastro({ customer_cnpj: "11111111000111" }, indice, texto)).toBe(false);
  });

  it("sem dono e sem CNPJ, tenta nome e depois empresa", () => {
    expect(pedidoTemCadastro({ customer_name: "Rafaela" }, indice, texto)).toBe(true);
    expect(pedidoTemCadastro({ customer_company: "Clinic+" }, indice, texto)).toBe(true);
    expect(pedidoTemCadastro({ customer_name: "Ninguém" }, indice, texto)).toBe(false);
    expect(pedidoTemCadastro({}, indice, texto)).toBe(false);
  });
});
