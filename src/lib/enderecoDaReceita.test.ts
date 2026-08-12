import { describe, expect, it } from "vitest";
import { mapearEnderecoDaReceita } from "@/lib/enderecoDaReceita";

/**
 * Resposta real da BrasilAPI para o CNPJ 13.030.070/0001-34 (ECOZ), recortada
 * aos campos de endereço. Copiada da chamada de verdade, não inventada — é o
 * que garante que os nomes dos campos batem com a API.
 */
const ECOZ = {
  cep: "89820000",
  logradouro: "TRES PONTES",
  numero: "S/N",
  complemento: "LINHA",
  bairro: "INTERIOR",
  municipio: "XANXERE",
  uf: "SC",
  codigo_municipio_ibge: 4219507,
};

describe("mapearEnderecoDaReceita", () => {
  it("converte a resposta real da Receita", () => {
    expect(mapearEnderecoDaReceita(ECOZ)).toEqual({
      cep: "89820-000",
      street: "TRES PONTES",
      number: "S/N",
      complement: "LINHA",
      neighborhood: "INTERIOR",
      city: "XANXERE",
      state: "SC",
      ibge: "4219507",
    });
  });

  it("aplica a máscara do CEP, que a Receita entrega cru", () => {
    // A lista de endereços guarda "89820-000". Sem a máscara, o mesmo CEP
    // apareceria em dois formatos dependendo de onde veio.
    expect(mapearEnderecoDaReceita(ECOZ)?.cep).toBe("89820-000");
  });

  it("sem CEP não devolve endereço nenhum", () => {
    // Meio endereço é pior que nenhum: a ficha pareceria preenchida sem estar,
    // e ninguém iria conferir.
    expect(mapearEnderecoDaReceita({ ...ECOZ, cep: "" })).toBeNull();
    expect(mapearEnderecoDaReceita({ ...ECOZ, cep: "8982" })).toBeNull();
    expect(mapearEnderecoDaReceita(null)).toBeNull();
    expect(mapearEnderecoDaReceita(undefined)).toBeNull();
  });

  it("aceita o código do IBGE como número ou texto", () => {
    expect(mapearEnderecoDaReceita({ ...ECOZ, codigo_municipio_ibge: "4219507" })?.ibge).toBe("4219507");
    expect(mapearEnderecoDaReceita({ ...ECOZ, codigo_municipio_ibge: null })?.ibge).toBe("");
  });

  it("campo ausente vira texto vazio, e não 'undefined' na tela", () => {
    const semComplemento = mapearEnderecoDaReceita({ ...ECOZ, complemento: null, numero: undefined });
    expect(semComplemento?.complement).toBe("");
    expect(semComplemento?.number).toBe("");
  });

  it("mantém o texto da Receita como veio", () => {
    // Sem acento e em maiúscula é como o registro oficial existe. "Corrigir"
    // para "Xanxerê" seria inventar um dado que a fonte não tem.
    expect(mapearEnderecoDaReceita(ECOZ)?.city).toBe("XANXERE");
  });

  it("UF vem com dois caracteres em maiúscula", () => {
    expect(mapearEnderecoDaReceita({ ...ECOZ, uf: "sc" })?.state).toBe("SC");
  });
});
