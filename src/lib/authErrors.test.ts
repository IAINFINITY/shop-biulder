import { describe, expect, it } from "vitest";
import { translateAuthErrorMessage } from "@/lib/authErrors";

/**
 * A §21 exige comportamento observável equivalente para conta inexistente, senha
 * incorreta, conta suspensa e cadastro com identificador existente. Mensagem
 * diferente é diferença observável: bastava um formulário e uma lista de e-mails
 * para levantar quem é cliente da Clinic+.
 */
describe("não revela se a conta existe", () => {
  const MENSAGENS_DO_SUPABASE = [
    "Invalid login credentials",
    "Email not confirmed",
    "email not verified",
    "User already registered",
    "email already exists",
    "Email exists",
  ];

  it("todas respondem exatamente o mesmo texto", () => {
    const respostas = new Set(MENSAGENS_DO_SUPABASE.map((m) => translateAuthErrorMessage(m)));
    expect(respostas.size, [...respostas].join(" | ")).toBe(1);
  });

  it("e o texto não diz nada sobre existir conta", () => {
    for (const m of MENSAGENS_DO_SUPABASE) {
      const r = translateAuthErrorMessage(m);
      expect(r, m).not.toMatch(/já está cadastrado|já existe|confirme seu e-mail|não confirmado/i);
    }
  });

  it("o antigo `duplicateEmailText` é ignorado", () => {
    // O parâmetro continua na assinatura para não quebrar chamador antigo, mas
    // não há texto de "já cadastrado" que seja seguro.
    const r = translateAuthErrorMessage("User already registered", {
      duplicateEmailText: "Este e-mail já está cadastrado.",
    });
    expect(r).not.toMatch(/já está cadastrado/i);
  });
});

describe("o que continua sendo dito", () => {
  it("CNPJ duplicado permanece — quem digita já é dono dele", () => {
    expect(translateAuthErrorMessage("duplicate key value violates customer_profiles_cnpj_unique")).toMatch(
      /CNPJ já possui cadastro/i,
    );
  });

  it("limite de tentativas permanece", () => {
    expect(translateAuthErrorMessage("Rate limit exceeded")).toMatch(/Muitas tentativas/i);
  });
});

describe("mensagem desconhecida", () => {
  it("não vaza o texto cru do provedor", () => {
    const cru = "pq: duplicate key value violates constraint auth_users_pkey on table users";
    expect(translateAuthErrorMessage(cru)).not.toContain("auth_users_pkey");
  });

  it("vazia continua genérica", () => {
    expect(translateAuthErrorMessage("")).toBe("Erro ao autenticar.");
  });
});
