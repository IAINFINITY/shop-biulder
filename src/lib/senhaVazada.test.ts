import { describe, expect, it } from "vitest";
import {
  contarNoIntervalo,
  dividirHash,
  hashSha1Hex,
  mensagemDeVazamento,
  prefixoValido,
  TAMANHO_DO_PREFIXO,
  verificarSenhaVazada,
} from "@/lib/senhaVazada";

describe("hashSha1Hex", () => {
  it("bate com o valor conhecido de 'password'", () => {
    // SHA-1("password") — o mesmo que o HIBP indexa.
    return expect(hashSha1Hex("password")).resolves.toBe(
      "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8",
    );
  });

  it("acento não muda de codificação entre chamadas", async () => {
    expect(await hashSha1Hex("coração")).toBe(await hashSha1Hex("coração"));
  });
});

describe("dividirHash", () => {
  it("separa 5 do resto", () => {
    const { prefixo, sufixo } = dividirHash("5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8");
    expect(prefixo).toBe("5BAA6");
    expect(prefixo).toHaveLength(TAMANHO_DO_PREFIXO);
    expect(sufixo).toBe("1E4C9B93F3F0682250B6CF8331B7EE68FD8");
  });

  it("o que sai da máquina é só o prefixo", () => {
    const hash = "ABCDEF0123456789";
    const { prefixo, sufixo } = dividirHash(hash);
    expect(hash.startsWith(prefixo)).toBe(true);
    expect(prefixo).not.toContain(sufixo);
  });
});

describe("prefixoValido", () => {
  it("aceita só 5 hexadecimais", () => {
    expect(prefixoValido("5BAA6")).toBe(true);
    expect(prefixoValido("5baa6")).toBe(true);
  });

  it("recusa o resto", () => {
    for (const v of ["5BAA", "5BAA61", "5BAAG", "", null, undefined, 12345, "../../etc", "5BAA%"]) {
      expect(prefixoValido(v), String(v)).toBe(false);
    }
  });
});

describe("contarNoIntervalo", () => {
  const FAIXA = [
    "1E4C9B93F3F0682250B6CF8331B7EE68FD8:9659365",
    "0018A45C4D1DEF81644B54AB7F969B88D65:1",
    "00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2",
  ].join("\r\n");

  it("acha o sufixo e devolve a contagem", () => {
    expect(contarNoIntervalo(FAIXA, "1E4C9B93F3F0682250B6CF8331B7EE68FD8")).toBe(9659365);
  });

  it("sufixo ausente devolve zero", () => {
    expect(contarNoIntervalo(FAIXA, "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")).toBe(0);
  });

  it("linha de preenchimento (contagem 0) não conta como vazamento", () => {
    // O cabeçalho `Add-Padding` faz o HIBP injetar linhas falsas com contagem 0
    // para o tamanho da resposta não revelar nada. Tratá-las como vazamento
    // recusaria senha boa.
    const comPadding = FAIXA + "\r\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:0";
    expect(contarNoIntervalo(comPadding, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toBe(0);
  });

  it("não se confunde com maiúscula, minúscula ou espaço", () => {
    expect(contarNoIntervalo(FAIXA, " 1e4c9b93f3f0682250b6cf8331b7ee68fd8 ")).toBe(9659365);
  });

  it("corpo vazio ou torto devolve zero", () => {
    for (const corpo of ["", "lixo", ":::", "SEMDOISPONTOS"]) {
      expect(contarNoIntervalo(corpo, "ABC"), corpo).toBe(0);
    }
  });
});

describe("verificarSenhaVazada", () => {
  it("marca como vazada quando o sufixo aparece", async () => {
    const r = await verificarSenhaVazada("password", async () =>
      "1E4C9B93F3F0682250B6CF8331B7EE68FD8:9659365",
    );
    expect(r).toEqual({ vazada: true, ocorrencias: 9659365, indisponivel: false });
  });

  it("senha ausente da faixa passa", async () => {
    const r = await verificarSenhaVazada("uma frase bem longa e propria", async () => "");
    expect(r.vazada).toBe(false);
    expect(r.indisponivel).toBe(false);
  });

  it("falha na consulta deixa passar, e diz que deixou", async () => {
    // Recusar cadastro porque um serviço de terceiro caiu transformaria a
    // indisponibilidade deles na nossa.
    const r = await verificarSenhaVazada("qualquer senha aqui", async () => {
      throw new Error("rede fora");
    });
    expect(r).toEqual({ vazada: false, ocorrencias: 0, indisponivel: true });
  });

  it("só o prefixo é enviado para quem busca", async () => {
    const enviados: string[] = [];
    await verificarSenhaVazada("password", async (p) => {
      enviados.push(p);
      return "";
    });
    expect(enviados).toEqual(["5BAA6"]);
    expect(enviados[0]).toHaveLength(TAMANHO_DO_PREFIXO);
  });
});

describe("mensagemDeVazamento", () => {
  it("muda o tom conforme a gravidade", () => {
    expect(mensagemDeVazamento(3)).not.toMatch(/milhares/);
    expect(mensagemDeVazamento(9659365)).toMatch(/milhares/);
  });
});
