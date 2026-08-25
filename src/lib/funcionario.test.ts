import { describe, expect, it } from "vitest";
import { TIPO_FUNCIONARIO, ehFuncionario } from "@/lib/funcionario";

describe("ehFuncionario", () => {
  it("reconhece pelo tipo", () => {
    expect(ehFuncionario({ customer_type: TIPO_FUNCIONARIO })).toBe(true);
    expect(ehFuncionario({ customer_type: "  Funcionario  " })).toBe(true);
  });

  it("reconhece pelo vínculo, antes de o tipo existir", () => {
    /**
     * A janela real: a função de borda grava `linked_company_cnpj` ao criar o
     * perfil e a sincronização com o Proxis roda no mesmo instante. Se só o tipo
     * valesse, um pedido feito nesse intervalo iria para o ERP com preço de
     * funcionário carimbado com a tabela 8728.
     */
    expect(ehFuncionario({ customer_type: "cliente", linked_company_cnpj: "04163851000106" })).toBe(true);
  });

  it("cliente comum não é funcionário", () => {
    expect(ehFuncionario({ customer_type: "cliente" })).toBe(false);
    expect(ehFuncionario({ customer_type: "lojista", linked_company_cnpj: "" })).toBe(false);
    expect(ehFuncionario({ customer_type: "distribuidor", linked_company_cnpj: null })).toBe(false);
  });

  it("perfil ausente não quebra e não vira funcionário", () => {
    // Visitante no checkout aberto chega aqui sem perfil. Responder `true`
    // faria todo pedido de visitante parar de ir ao ERP.
    expect(ehFuncionario(null)).toBe(false);
    expect(ehFuncionario(undefined)).toBe(false);
    expect(ehFuncionario({})).toBe(false);
  });
});
