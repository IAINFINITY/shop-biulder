import { describe, expect, it } from "vitest";
import { distanciaDeEdicao, sugerirCorrecaoDeEmail } from "@/lib/emailTypo";

describe("sugerirCorrecaoDeEmail", () => {
  it("corrige o caso que originou esta função", () => {
    // Digitado em teste real: faltou o `l` de gmail.
    expect(sugerirCorrecaoDeEmail("franciscoaneto13@gmai.com")).toBe("franciscoaneto13@gmail.com");
  });

  it("corrige os erros de digitação mais comuns", () => {
    expect(sugerirCorrecaoDeEmail("alguem@gmial.com")).toBe("alguem@gmail.com");
    expect(sugerirCorrecaoDeEmail("alguem@gmail.co")).toBe("alguem@gmail.com");
    expect(sugerirCorrecaoDeEmail("alguem@hotmial.com")).toBe("alguem@hotmail.com");
    expect(sugerirCorrecaoDeEmail("alguem@outlok.com")).toBe("alguem@outlook.com");
    expect(sugerirCorrecaoDeEmail("alguem@yaho.com")).toBe("alguem@yahoo.com");
  });

  it("não sugere nada quando o domínio já está correto", () => {
    expect(sugerirCorrecaoDeEmail("alguem@gmail.com")).toBeNull();
    expect(sugerirCorrecaoDeEmail("alguem@uol.com.br")).toBeNull();
    expect(sugerirCorrecaoDeEmail("ALGUEM@GMAIL.COM")).toBeNull();
  });

  it("não mexe em domínio corporativo", () => {
    // O caso que mais importa não estragar: e-mail de empresa é o normal aqui.
    expect(sugerirCorrecaoDeEmail("compras@clinicmais.com.br")).toBeNull();
    expect(sugerirCorrecaoDeEmail("financeiro@iainfinity.com.br")).toBeNull();
    expect(sugerirCorrecaoDeEmail("contato@empresa.com.br")).toBeNull();
  });

  it("não chuta quando está longe demais", () => {
    // Três edições ou mais deixa de ser erro de digitação e vira outro domínio.
    expect(sugerirCorrecaoDeEmail("alguem@protonmail.com")).toBeNull();
    expect(sugerirCorrecaoDeEmail("alguem@xyz.com")).toBeNull();
  });

  it("preserva a parte antes do arroba", () => {
    expect(sugerirCorrecaoDeEmail("nome.sobrenome+tag@gmai.com")).toBe(
      "nome.sobrenome+tag@gmail.com",
    );
  });

  it("devolve null para entrada que não é e-mail", () => {
    expect(sugerirCorrecaoDeEmail("")).toBeNull();
    expect(sugerirCorrecaoDeEmail("sem-arroba")).toBeNull();
    expect(sugerirCorrecaoDeEmail("@gmai.com")).toBeNull();
    expect(sugerirCorrecaoDeEmail("alguem@")).toBeNull();
    expect(sugerirCorrecaoDeEmail("alguem@semponto")).toBeNull();
    expect(sugerirCorrecaoDeEmail(null)).toBeNull();
    expect(sugerirCorrecaoDeEmail(undefined)).toBeNull();
  });

  it("usa só a lista fixa — não depende de saber quem tem conta", () => {
    // A §21 exige que a resposta seja a mesma para conta existente e inexistente.
    // Duas contas diferentes no mesmo domínio errado recebem a mesma sugestão.
    expect(sugerirCorrecaoDeEmail("a@gmai.com")).toBe("a@gmail.com");
    expect(sugerirCorrecaoDeEmail("b@gmai.com")).toBe("b@gmail.com");
  });
});

describe("distanciaDeEdicao", () => {
  it("conta as edições corretamente", () => {
    expect(distanciaDeEdicao("gmail.com", "gmail.com")).toBe(0);
    expect(distanciaDeEdicao("gmai.com", "gmail.com")).toBe(1);
    expect(distanciaDeEdicao("gmial.com", "gmail.com")).toBe(2);
    expect(distanciaDeEdicao("", "abc")).toBe(3);
    expect(distanciaDeEdicao("abc", "")).toBe(3);
  });
});
