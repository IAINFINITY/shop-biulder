import { describe, expect, it } from "vitest";
import {
  MENSAGEM_DE_CREDENCIAL,
  classificarFalhaDeLogin,
  translateAuthErrorMessage,
} from "@/lib/authErrors";

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

describe("classificarFalhaDeLogin", () => {
  /**
   * A parte que continua fechada: quem só tem uma lista de e-mails não aprende
   * nada. Conta inexistente e senha errada chegam aqui com o **mesmo** código do
   * Supabase (`invalid_credentials`, medido em 24/08/2026), então não há como
   * esta função separar as duas nem por acidente.
   */
  it("conta inexistente e senha errada são o mesmo caso", () => {
    const inexistente = classificarFalhaDeLogin("Invalid login credentials", "invalid_credentials");
    const senhaErrada = classificarFalhaDeLogin("Invalid login credentials", "invalid_credentials");
    expect(inexistente).toEqual(senhaErrada);
    expect(inexistente.tipo).toBe("credencial");
  });

  it("conta suspensa responde como credencial", () => {
    // A §21 lista "conta suspensa" junto com "conta inexistente".
    expect(classificarFalhaDeLogin("User is banned", "user_banned").mensagem).toBe(MENSAGEM_DE_CREDENCIAL);
  });

  it("e-mail não confirmado ganha caso próprio", () => {
    /**
     * Isto **muda** a regra anterior, e de propósito.
     *
     * O Supabase só devolve `email_not_confirmed` depois de a senha bater — com
     * senha errada numa conta não confirmada ele devolve `invalid_credentials`.
     * Então quem lê esta mensagem já provou ter a senha daquela conta, e não
     * aprendeu nada novo. O que se ganha é o cliente parar de achar que a conta
     * quebrou quando o problema é um e-mail parado na caixa de spam.
     */
    const r = classificarFalhaDeLogin("Email not confirmed", "email_not_confirmed");
    expect(r.tipo).toBe("email_nao_confirmado");
    expect(r.mensagem).toMatch(/confirmar seu e-mail/i);
  });

  it("classifica pela mensagem quando o SDK não manda código", () => {
    expect(classificarFalhaDeLogin("Email not confirmed").tipo).toBe("email_nao_confirmado");
    expect(classificarFalhaDeLogin("Invalid login credentials").tipo).toBe("credencial");
  });

  it("limite de tentativas não vira credencial", () => {
    // Dizer "e-mail ou senha incorretos" para quem só bateu no limite manda a
    // pessoa trocar a senha sem necessidade.
    expect(classificarFalhaDeLogin("Rate limit exceeded", "over_request_rate_limit").tipo).toBe(
      "muitas_tentativas",
    );
  });

  it("desconhecido não vaza o texto cru", () => {
    const r = classificarFalhaDeLogin("pq: relation auth_users_pkey does not exist", "algo_novo");
    expect(r.tipo).toBe("desconhecido");
    expect(r.mensagem).not.toContain("auth_users_pkey");
  });
});

describe("a tradução reconhece a própria saída", () => {
  /**
   * O bug que motivou tudo isto: `signIn` devolvia o texto já traduzido e o
   * `Login` traduzia de novo. O português não casava com nenhum ramo e **toda**
   * falha virava "Não foi possível concluir" — inclusive senha errada.
   *
   * A chamada dupla foi removida. Esta guarda existe para que, se voltar, o
   * resultado seja o texto certo em vez do genérico.
   */
  it("traduzir duas vezes dá o mesmo resultado", () => {
    for (const cru of ["Invalid login credentials", "Rate limit exceeded", "Invalid email", ""]) {
      const uma = translateAuthErrorMessage(cru);
      expect(translateAuthErrorMessage(uma), cru).toBe(uma);
    }
  });

  it("a saída do classificador de login também sobrevive", () => {
    const credencial = classificarFalhaDeLogin("Invalid login credentials", "invalid_credentials").mensagem;
    expect(translateAuthErrorMessage(credencial)).toBe(credencial);
  });
});
