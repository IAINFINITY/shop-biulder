import { describe, expect, it } from "vitest";
import { forcaDaSenha } from "@/lib/forcaDaSenha";
import { avaliarSenha } from "@/lib/senha";

/**
 * O acordo que estes testes travam: **o medidor nunca elogia uma senha que o
 * formulário vai recusar.**
 *
 * A primeira versão pontuava por maioria de checagens, e por isso dava "Média"
 * para uma senha de 6 caracteres e "Boa" para uma que continha o nome da
 * empresa. Foi encontrado testando a tela no navegador, não em teste unitário —
 * por isso este arquivo existe.
 */

const REPROVADAS = [
  ["curta demais", "abc123"],
  ["curta, mas variada", "Ab1!xY"],
  ["senha comum", "password123"],
  ["nome do produto", "clinicmais2026"],
  ["outro termo do contexto", "iainfinity123"],
];

describe("forcaDaSenha", () => {
  it("toda senha reprovada aparece como Fraca", () => {
    for (const [motivo, senha] of REPROVADAS) {
      const r = forcaDaSenha(senha);
      expect(avaliarSenha(senha).ok, `${motivo}: deveria ser reprovada`).toBe(false);
      expect(r.label, `${motivo} ("${senha}") não pode parecer aceitável`).toBe("Fraca");
      expect(r.score).toBe(0);
    }
  });

  it("nunca diz Boa ou Forte para o que será recusado", () => {
    for (const [, senha] of REPROVADAS) {
      expect(["Boa", "Forte"]).not.toContain(forcaDaSenha(senha).label);
    }
  });

  it("senha aceita gradua pelo comprimento", () => {
    expect(forcaDaSenha("roxo42banho").label).toBe("Média"); // 11
    expect(forcaDaSenha("jacaranda4278").label).toBe("Boa"); // 13
    expect(forcaDaSenha("jacaranda-portao42").label).toBe("Forte"); // 18
    expect(forcaDaSenha("jacaranda-portao-98-verde").label).toBe("Forte"); // 25
  });

  it("a senha vazia não vira Média por descuido", () => {
    expect(forcaDaSenha("").label).toBe("Fraca");
  });

  it("as checagens exibidas são as da política real", () => {
    const rotulos = forcaDaSenha("jacaranda-portao-98-verde").checks.map((c) => c.label);

    expect(rotulos.some((r) => r.includes("Mínimo 10"))).toBe(true);
    expect(rotulos.some((r) => r.includes("senha comum"))).toBe(true);
    // As regras de composição são proibidas pela §10 e não podem voltar à tela.
    for (const proibida of ["maiúscula", "minúscula", "Número", "especial"]) {
      expect(rotulos.some((r) => r.includes(proibida)), `"${proibida}" não deve aparecer`).toBe(false);
    }
  });

  it("reprova quando a senha deriva do e-mail", () => {
    const email = "franciscoaneto@empresa.com.br";
    expect(forcaDaSenha("franciscoaneto2026", email).label).toBe("Fraca");
  });

  it("concorda com avaliarSenha sobre o que passa", () => {
    // O medidor e a validação não podem divergir: se um aceita e o outro não,
    // a pessoa vê "Forte" e leva erro no envio.
    for (const senha of ["abc123", "password123", "clinicmais2026", "roxo42banho", "jacaranda-portao-98-verde"]) {
      const passou = avaliarSenha(senha).ok;
      const medidor = forcaDaSenha(senha);
      expect(medidor.label === "Fraca" && medidor.score === 0).toBe(!passou);
    }
  });
});
