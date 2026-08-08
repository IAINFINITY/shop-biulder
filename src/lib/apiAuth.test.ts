import { describe, expect, it } from "vitest";
import { canActForCnpj, parseBearerToken, type AuthContext } from "@/lib/apiAuth";

const CNPJ_PROPRIO = "04163851000106";
const CNPJ_OUTRO = "11222333000181";

function contexto(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user-1",
    isAdmin: false,
    // `aal1` como base: o contexto do teste representa uma sessao comum, de um
    // fator. Quem testa comportamento de aal2 sobrescreve.
    aal: "aal1",
    profile: {
      cnpj: CNPJ_PROPRIO,
      customer_type: "lojista",
      proxis_tpr_id: 8278,
      linked_company_cnpj: null,
    },
    ...overrides,
  };
}

describe("parseBearerToken", () => {
  it("extrai o token do header", () => {
    expect(parseBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(parseBearerToken("bearer abc")).toBe("abc");
  });

  it("devolve vazio sem header válido", () => {
    expect(parseBearerToken(undefined)).toBe("");
    expect(parseBearerToken("")).toBe("");
    expect(parseBearerToken("Basic abc")).toBe("");
    expect(parseBearerToken("abc.def.ghi")).toBe("");
  });
});

describe("canActForCnpj", () => {
  it("permite o cliente no próprio CNPJ, com ou sem máscara", () => {
    expect(canActForCnpj(contexto(), CNPJ_PROPRIO)).toBe(true);
    expect(canActForCnpj(contexto(), "04.163.851/0001-06")).toBe(true);
  });

  it("bloqueia o cliente no CNPJ de outra empresa", () => {
    expect(canActForCnpj(contexto(), CNPJ_OUTRO)).toBe(false);
  });

  it("permite o funcionário no CNPJ da empresa vinculada", () => {
    const funcionario = contexto({
      profile: {
        cnpj: CNPJ_OUTRO,
        customer_type: "funcionario",
        proxis_tpr_id: null,
        linked_company_cnpj: CNPJ_PROPRIO,
      },
    });

    expect(canActForCnpj(funcionario, CNPJ_PROPRIO)).toBe(true);
    expect(canActForCnpj(funcionario, CNPJ_OUTRO)).toBe(true);
  });

  it("libera o admin para qualquer CNPJ — é ele quem reenvia pedido pelo painel", () => {
    const admin = contexto({ isAdmin: true, profile: null });

    expect(canActForCnpj(admin, CNPJ_OUTRO)).toBe(true);
  });

  it("bloqueia quando o cliente não tem perfil", () => {
    expect(canActForCnpj(contexto({ profile: null }), CNPJ_PROPRIO)).toBe(false);
  });

  it("bloqueia CNPJ incompleto ou ausente", () => {
    expect(canActForCnpj(contexto(), "0416385100010")).toBe(false);
    expect(canActForCnpj(contexto(), "")).toBe(false);
    expect(canActForCnpj(contexto(), null)).toBe(false);
  });
});
