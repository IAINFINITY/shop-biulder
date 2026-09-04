import { describe, expect, it } from "vitest";
import { podeResetarSenha, type ContextoDeReset } from "@/lib/permissaoDeReset";

const base: ContextoDeReset = {
  ehSuperadmin: false,
  temPermissaoDeFuncionarios: false,
  alvoEhFuncionario: true,
  alvoEhDaEquipe: false,
  ehAPropriaConta: false,
};

const ctx = (mudancas: Partial<ContextoDeReset>): ContextoDeReset => ({ ...base, ...mudancas });

describe("admin que administra funcionários", () => {
  // O relato de 04/09/2026: "um adm que tem acesso à área de funcionários e pode
  // configurar eles não conseguiu resetar a senha, pq tá limitado só a superadmin".
  it("reseta a senha de um funcionário", () => {
    expect(podeResetarSenha(ctx({ temPermissaoDeFuncionarios: true }))).toEqual({ permitido: true });
  });

  // ⚠️ O teste que impede a escada de privilégio: sem ele, um admin com a
  // permissão resetaria a senha do superadmin e assumiria a conta.
  it("NÃO reseta a senha de quem é da equipe", () => {
    const decisao = podeResetarSenha(ctx({ temPermissaoDeFuncionarios: true, alvoEhDaEquipe: true }));
    expect(decisao.permitido).toBe(false);
  });

  it("não alcança conta que não é de funcionário", () => {
    const decisao = podeResetarSenha(
      ctx({ temPermissaoDeFuncionarios: true, alvoEhFuncionario: false }),
    );
    expect(decisao.permitido).toBe(false);
  });
});

describe("admin sem a permissão", () => {
  it("continua barrado", () => {
    expect(podeResetarSenha(ctx({})).permitido).toBe(false);
  });
});

describe("superadmin", () => {
  it("reseta qualquer conta, inclusive de outro admin", () => {
    expect(podeResetarSenha(ctx({ ehSuperadmin: true, alvoEhDaEquipe: true }))).toEqual({ permitido: true });
  });

  it("reseta conta que não é de funcionário", () => {
    expect(podeResetarSenha(ctx({ ehSuperadmin: true, alvoEhFuncionario: false }))).toEqual({ permitido: true });
  });
});

describe("a própria conta", () => {
  // Sai com senha provisória e troca obrigatória, e a sessão cai junto — quem
  // faz isso em si mesmo se tranca do lado de fora.
  it("ninguém reseta a si mesmo, nem o superadmin", () => {
    expect(podeResetarSenha(ctx({ ehSuperadmin: true, ehAPropriaConta: true })).permitido).toBe(false);
    expect(
      podeResetarSenha(ctx({ temPermissaoDeFuncionarios: true, ehAPropriaConta: true })).permitido,
    ).toBe(false);
  });

  it("a recusa vem antes de qualquer outra, para a mensagem ser a útil", () => {
    const decisao = podeResetarSenha(ctx({ ehAPropriaConta: true }));
    // `"motivo" in decisao` e não `if (decisao.permitido)`: este projeto compila
    // sem `strict`, e sem ele o TypeScript não estreita a união pelo literal
    // booleano. O `in` estreita em qualquer modo.
    expect("motivo" in decisao && decisao.motivo).toMatch(/própria senha/i);
  });
});
