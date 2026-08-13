import { describe, expect, it } from "vitest";
import { faltaApenasOIbge } from "@/lib/ibgePorCep";

/**
 * O endereço do pedido que o ERP recusou — completo, menos o IBGE.
 * Copiado do registro real, não inventado.
 */
const PATRICIA = {
  cep: "97560000",
  street: "Rua Félix da Cunha",
  number: "984",
  complement: "",
  neighborhood: "Centro",
  city: "Quaraí",
  state: "RS",
  ibge: "",
};

describe("faltaApenasOIbge", () => {
  it("reconhece o caso que causou a recusa", () => {
    expect(faltaApenasOIbge(PATRICIA)).toBe(true);
  });

  it("com IBGE, não há o que completar", () => {
    expect(faltaApenasOIbge({ ...PATRICIA, ibge: "4315503" })).toBe(false);
  });

  it("endereço de verdade incompleto não é tratado como falta de IBGE", () => {
    /**
     * A distinção é o ponto da função.
     *
     * Faltando rua ou cidade, o problema é de quem preencheu e precisa voltar
     * para a tela — completar o IBGE ali só produziria um pedido que o ERP
     * recusaria de outro jeito, agora sem mensagem útil.
     */
    for (const campo of ["street", "number", "neighborhood", "city"] as const) {
      expect(faltaApenasOIbge({ ...PATRICIA, [campo]: "" }), campo).toBe(false);
    }
    expect(faltaApenasOIbge({ ...PATRICIA, state: "" })).toBe(false);
    expect(faltaApenasOIbge({ ...PATRICIA, cep: "9756" })).toBe(false);
  });

  it("IBGE curto conta como ausente", () => {
    // O código do município tem 7 dígitos. Um valor truncado passaria pela
    // checagem de "não vazio" e seria recusado pelo ERP do mesmo jeito.
    expect(faltaApenasOIbge({ ...PATRICIA, ibge: "431" })).toBe(true);
  });

  it("máscara no CEP não atrapalha", () => {
    expect(faltaApenasOIbge({ ...PATRICIA, cep: "97560-000" })).toBe(true);
  });

  it("endereço ausente não quebra", () => {
    expect(faltaApenasOIbge(null)).toBe(false);
    expect(faltaApenasOIbge(undefined)).toBe(false);
    expect(faltaApenasOIbge({})).toBe(false);
  });
});
