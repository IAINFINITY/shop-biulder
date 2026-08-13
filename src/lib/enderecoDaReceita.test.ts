import { describe, expect, it } from "vitest";
import { mapearEnderecoDaReceita } from "@/lib/enderecoDaReceita";

/**
 * Resposta real da `publica.cnpj.ws` para o CNPJ 66.121.553/0001-00, recortada
 * aos campos de endereço. Copiada da chamada de verdade, não inventada — é o
 * que garante que os nomes dos campos batem com a API.
 */
const REAL = {
  estabelecimento: {
    tipo_logradouro: "10A AVENIDA",
    logradouro: "AVENIDA ANTONIO REINALDO",
    numero: "527",
    complemento: null,
    bairro: "CENTRO",
    cep: "57935000",
    cidade: { nome: "Paripueira", ibge_id: 2706448 },
    estado: { sigla: "AL" },
  },
};

describe("mapearEnderecoDaReceita", () => {
  it("converte a resposta real da Receita", () => {
    expect(mapearEnderecoDaReceita(REAL)).toEqual({
      cep: "57935-000",
      street: "10A AVENIDA AVENIDA ANTONIO REINALDO",
      number: "527",
      complement: "",
      neighborhood: "CENTRO",
      city: "Paripueira",
      state: "AL",
      ibge: "2706448",
    });
  });

  it("cola o tipo do logradouro na frente do nome", () => {
    /**
     * A razão de a fonte ter sido trocada.
     *
     * A BrasilAPI devolvia `logradouro` sem o tipo — "DO CONTORNO",
     * "MARECHAL FLORIANO" — e sozinho isso não identifica rua nenhuma. Aqui o
     * tipo vem num campo separado e é recolado.
     */
    const contorno = mapearEnderecoDaReceita({
      estabelecimento: { ...REAL.estabelecimento, tipo_logradouro: "AVENIDA", logradouro: "DO CONTORNO" },
    });
    expect(contorno?.street).toBe("AVENIDA DO CONTORNO");
  });

  it("sem o tipo, não sobra espaço solto na frente", () => {
    const semTipo = mapearEnderecoDaReceita({
      estabelecimento: { ...REAL.estabelecimento, tipo_logradouro: null },
    });
    expect(semTipo?.street).toBe("AVENIDA ANTONIO REINALDO");
  });

  it("preserva a acentuação que a fonte entrega", () => {
    // "Foz do Iguaçu", e não "FOZ DO IGUACU" — foi o segundo motivo da troca.
    const foz = mapearEnderecoDaReceita({
      estabelecimento: { ...REAL.estabelecimento, cidade: { nome: "Foz do Iguaçu", ibge_id: 4108304 } },
    });
    expect(foz?.city).toBe("Foz do Iguaçu");
  });

  it("aplica a máscara do CEP, que a fonte entrega cru", () => {
    // A lista de endereços guarda "89820-000". Sem a máscara, o mesmo CEP
    // apareceria em dois formatos dependendo de onde veio.
    expect(mapearEnderecoDaReceita(REAL)?.cep).toBe("57935-000");
  });

  it("sem CEP não devolve endereço nenhum", () => {
    // Meio endereço é pior que nenhum: a ficha pareceria preenchida sem estar,
    // e ninguém iria conferir.
    const semCep = { estabelecimento: { ...REAL.estabelecimento, cep: "" } };
    expect(mapearEnderecoDaReceita(semCep)).toBeNull();
    expect(mapearEnderecoDaReceita({ estabelecimento: { ...REAL.estabelecimento, cep: "579" } })).toBeNull();
  });

  it("resposta sem estabelecimento não quebra", () => {
    expect(mapearEnderecoDaReceita(null)).toBeNull();
    expect(mapearEnderecoDaReceita(undefined)).toBeNull();
    expect(mapearEnderecoDaReceita({})).toBeNull();
    expect(mapearEnderecoDaReceita({ estabelecimento: null })).toBeNull();
  });

  it("campo ausente vira texto vazio, e não 'undefined' na tela", () => {
    const magro = mapearEnderecoDaReceita({
      estabelecimento: { cep: "57935000", cidade: null, estado: null },
    });
    expect(magro).toEqual({
      cep: "57935-000",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      ibge: "",
    });
  });

  it("UF vem com dois caracteres em maiúscula", () => {
    const minusculo = mapearEnderecoDaReceita({
      estabelecimento: { ...REAL.estabelecimento, estado: { sigla: "al" } },
    });
    expect(minusculo?.state).toBe("AL");
  });
});
