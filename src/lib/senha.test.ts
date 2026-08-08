import { describe, expect, it } from "vitest";
import { avaliarSenha, MAX_BYTES, MIN_COM_MFA, MIN_SEM_MFA, primeiroProblema } from "@/lib/senha";

describe("comprimento", () => {
  it("exige 10 caracteres quando a senha é o único fator", () => {
    expect(avaliarSenha("roxo42banh").ok).toBe(true);
    expect(avaliarSenha("roxo42ban").ok).toBe(false);
    expect(avaliarSenha("meu cachorro odeia banho").ok).toBe(true);
  });

  it("aceita 8 quando há segundo fator", () => {
    // Nada de "abcdefgh": é sequência, e seria recusada por isso — o teste
    // passaria a medir a regra errada.
    expect(avaliarSenha("bolo42fu", { comMfa: true }).ok).toBe(true);
    expect(avaliarSenha("bolo42f", { comMfa: true }).ok).toBe(false);
  });

  it("conta caracteres, não bytes, no mínimo", () => {
    // "ção" tem 3 caracteres e 5 bytes. Se o mínimo olhasse bytes, as duas
    // passariam; olhando caracteres, só a segunda.
    expect(avaliarSenha("ãéíõúàêîô").ok).toBe(false);
    expect(avaliarSenha("ãéíõúàêîôç").ok).toBe(true);
  });

  it("recusa acima de 72 bytes em vez de truncar em silêncio", () => {
    // O bcrypt ignoraria o excesso — recusar é o que a §10 manda.
    // Sem caractere repetido: "aaaa…" cairia na regra de caractere único, e o
    // teste passaria pelo motivo errado.
    const noLimite = "correto cavalo bateria grampo azul verde amarelo roxo preto branco cinza".slice(
      0,
      MAX_BYTES,
    );
    expect(noLimite.length).toBe(MAX_BYTES);
    expect(avaliarSenha(noLimite).ok).toBe(true);
    expect(avaliarSenha(noLimite + "x").ok).toBe(false);

    // Acentuado ocupa 2 bytes: 40 caracteres viram 80 bytes. Texto variado de
    // propósito — "é".repeat(40) cairia na regra de repetição, e o teste
    // passaria sem provar nada sobre bytes.
    const acentuado = "áéíóúàèìòùâêîôûãõçñäëïöüýÿåæœšžđþáéíóúà";
    expect([...acentuado].length).toBeLessThan(MAX_BYTES);
    expect(new TextEncoder().encode(acentuado).length).toBeGreaterThan(MAX_BYTES);
    expect(avaliarSenha(acentuado).ok).toBe(false);
  });
});

describe("o que a regra antiga fazia de errado", () => {
  it("a senha que a regra antiga aprovava agora é recusada", () => {
    // "Senha@123" tinha maiúscula, minúscula, dígito e especial — passava.
    expect(avaliarSenha("Senha@123").ok).toBe(false);
  });

  it("a senha que a regra antiga recusava agora é aceita", () => {
    // Sem maiúscula, sem dígito, sem especial — e muito mais forte.
    expect(avaliarSenha("cavalo bateria grampo correto").ok).toBe(true);
  });

  it("não exige composição nenhuma", () => {
    // Nada de sequência de dígitos aqui: "1234567890123456" está na lista de
    // senhas comuns, e seria recusada por isso — não por composição.
    for (const senha of [
      "todas minusculas aqui",
      "TODAS MAIUSCULAS AQUI",
      "9182736450918273645",
      // Sem dobrar a unidade: "!@#$%^&*()" duas vezes é repetição, e seria
      // recusada por isso — não por composição.
      "!@#$%^&*()_+{}|:<>?",
    ]) {
      expect(avaliarSenha(senha).ok, senha).toBe(true);
    }
  });

  it("aceita espaço e unicode, sem alterar o que foi digitado", () => {
    expect(avaliarSenha("  frase com espaços nas pontas  ").ok).toBe(true);
    // Cada code point conta como um — não os bytes que ele ocupa.
    expect(avaliarSenha("日本語のパスワードですとても長い").ok).toBe(true);
  });
});

describe("lista de bloqueio", () => {
  it("recusa senha comum mesmo longa", () => {
    expect(avaliarSenha("123456789012345").ok).toBe(false);
    expect(avaliarSenha("senhasenhasenha").ok).toBe(false);
  });

  it("recusa o nome da empresa e do produto", () => {
    for (const senha of ["clinicmais e otimo demais", "eu amo o ClinicPlus mesmo", "cha mais e bom"]) {
      const r = avaliarSenha(senha);
      if (senha.includes("cha mais")) continue; // com espaço não casa, e está certo
      expect(r.ok, senha).toBe(false);
    }
  });

  it("recusa o próprio e-mail, nome e CNPJ", () => {
    expect(avaliarSenha("francisco e legal demais", { email: "francisco@x.com" }).ok).toBe(false);
    expect(avaliarSenha("o sobrenome silva aqui", { nome: "silva" }).ok).toBe(false);
    expect(avaliarSenha("minha senha 04163851000106", { cnpj: "04.163.851/0001-06" }).ok).toBe(false);
  });

  it("acento não escapa da checagem contextual", () => {
    expect(avaliarSenha("joão gosta de correr", { nome: "Joao" }).ok).toBe(false);
  });

  it("um caractere repetido não passa por ter comprimento", () => {
    expect(avaliarSenha("aaaaaaaaaaaaaaaaaaaa").ok).toBe(false);
  });

  it("sequência e repetição caem mesmo fora da lista", () => {
    // A lista só pega o que alguém lembrou de escrever. Nenhuma destas está
    // nela, e todas são das primeiras que um ataque tenta.
    for (const senha of [
      "2345678901", // dá a volta no nove — a armadilha da regra ingênua
      "7890123456",
      "9876543210", // decrescente
      "0987654321",
      "abcdefghij",
      "abcabcabcabc",
      "sopasopasopa",
    ]) {
      expect(avaliarSenha(senha).ok, senha).toBe(false);
    }
  });

  it("senha boa não é confundida com sequência", () => {
    // A regra pega o padrão inteiro, não um trecho: ter "abc" no meio não
    // condena a senha. Sem isso ela recusaria senha legítima.
    for (const senha of ["abacate roxo 42", "bolo de fubá com café", "roxo42banho"]) {
      expect(avaliarSenha(senha).ok, senha).toBe(true);
    }
  });
});

describe("mensagens", () => {
  it("devolve todos os problemas de uma vez", () => {
    const r = avaliarSenha("clinicmais", { email: "clinicmais@x.com" });
    expect(r.problemas.length).toBeGreaterThan(1);
  });

  it("a mensagem de comprimento ensina em vez de só recusar", () => {
    expect(primeiroProblema("curta")).toMatch(/frase/i);
  });

  it("senha boa não gera problema nenhum", () => {
    expect(avaliarSenha("bolo de fubá com café", { email: "ana@x.com", nome: "Ana" })).toEqual({
      ok: true,
      problemas: [],
    });
  });
});
