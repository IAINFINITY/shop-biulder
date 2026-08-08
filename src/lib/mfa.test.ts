import { describe, expect, it } from "vitest";
import {
  avaliarExigenciaDeMfa,
  lerAal,
  motivoParaNaoRemoverFator,
  podeAtenderRotaAdmin,
} from "@/lib/mfa";

/** Monta um JWT de mentira — só o payload importa para `lerAal`. */
function tokenCom(payload: Record<string, unknown>): string {
  const base64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.assinatura-falsa`;
}

describe("lerAal", () => {
  it("lê aal1 e aal2 do payload", () => {
    expect(lerAal(tokenCom({ aal: "aal1", sub: "u1" }))).toBe("aal1");
    expect(lerAal(tokenCom({ aal: "aal2", sub: "u1" }))).toBe("aal2");
  });

  it("sem a reivindicação, devolve null — ausência não é permissão", () => {
    expect(lerAal(tokenCom({ sub: "u1" }))).toBeNull();
  });

  it("valor inesperado não vira aal2", () => {
    // O que importa é a direção do erro: nada além do literal "aal2" pode passar.
    for (const valor of ["aal3", "AAL2", "", 2, true, null, { aal: "aal2" }]) {
      expect(lerAal(tokenCom({ aal: valor })), String(valor)).not.toBe("aal2");
    }
  });

  it("token torto não explode e não libera", () => {
    for (const torto of [null, undefined, "", "abc", "a.b", "a.b.c.d", "a.!!!.c"]) {
      expect(lerAal(torto as string), String(torto)).not.toBe("aal2");
    }
  });

  it("payload com acento decodifica sem quebrar", () => {
    expect(lerAal(tokenCom({ aal: "aal2", nome: "João Perón" }))).toBe("aal2");
  });
});

describe("avaliarExigenciaDeMfa", () => {
  it("quem não é admin passa direto", () => {
    expect(
      avaliarExigenciaDeMfa({ isAdmin: false, aal: "aal1", temFatorVerificado: false, obrigatorio: true }).estado,
    ).toBe("liberado");
  });

  it("admin em aal2 está liberado", () => {
    expect(
      avaliarExigenciaDeMfa({ isAdmin: true, aal: "aal2", temFatorVerificado: true, obrigatorio: true }).estado,
    ).toBe("liberado");
  });

  it("admin sem fator cadastrado precisa cadastrar", () => {
    const r = avaliarExigenciaDeMfa({ isAdmin: true, aal: "aal1", temFatorVerificado: false, obrigatorio: true });
    expect(r.estado).toBe("cadastro_necessario");
  });

  it("admin com fator, mas sessão em aal1, precisa do desafio", () => {
    // Sessão nova de quem já cadastrou: falta digitar os seis dígitos, não
    // cadastrar de novo. São telas diferentes.
    const r = avaliarExigenciaDeMfa({ isAdmin: true, aal: "aal1", temFatorVerificado: true, obrigatorio: true });
    expect(r.estado).toBe("desafio_necessario");
  });

  it("aal ausente é tratado como aal1, nunca como liberado", () => {
    expect(
      avaliarExigenciaDeMfa({ isAdmin: true, aal: null, temFatorVerificado: true, obrigatorio: true }).estado,
    ).toBe("desafio_necessario");
  });

  it("com MFA opcional, admin SEM fator entra no painel", () => {
    // A virada de "recomendado" para "obrigatorio" e operacional, nao tecnica:
    // exigir de todos no mesmo instante tranca o painel, que e onde se cadastra.
    const r = avaliarExigenciaDeMfa({
      isAdmin: true,
      aal: "aal1",
      temFatorVerificado: false,
      obrigatorio: false,
    });
    expect(r.estado).toBe("liberado");
  });

  it("com MFA opcional, quem JA cadastrou continua passando pelo desafio", () => {
    // O ponto que nao pode escorregar: deixar passar sem pedir o codigo
    // transformaria o fator em enfeite, e a conta ficaria so com a senha.
    const r = avaliarExigenciaDeMfa({
      isAdmin: true,
      aal: "aal1",
      temFatorVerificado: true,
      obrigatorio: false,
    });
    expect(r.estado).toBe("desafio_necessario");
  });

  it("com MFA opcional, aal ausente não vira liberado para quem tem fator", () => {
    const r = avaliarExigenciaDeMfa({
      isAdmin: true,
      aal: null,
      temFatorVerificado: true,
      obrigatorio: false,
    });
    expect(r.estado).toBe("desafio_necessario");
  });

  it("a obrigatoriedade não afeta quem não é admin", () => {
    for (const obrigatorio of [true, false]) {
      expect(
        avaliarExigenciaDeMfa({ isAdmin: false, aal: "aal1", temFatorVerificado: false, obrigatorio })
          .estado,
      ).toBe("liberado");
    }
  });

  it("CLIENTE com fator cadastrado passa pelo desafio", () => {
    // O ponto da mudança de 08/08. Antes, `if (!isAdmin) return liberado` vinha
    // primeiro: o cliente cadastrava o autenticador e nada nunca pedia o código.
    // O fator ficava decorativo, com a tela prometendo proteção que não havia.
    const r = avaliarExigenciaDeMfa({
      isAdmin: false,
      aal: "aal1",
      temFatorVerificado: true,
      obrigatorio: false,
    });
    expect(r.estado).toBe("desafio_necessario");
  });

  it("cliente com fator não é liberado nem com aal ausente", () => {
    expect(
      avaliarExigenciaDeMfa({ isAdmin: false, aal: null, temFatorVerificado: true, obrigatorio: false })
        .estado,
    ).toBe("desafio_necessario");
  });

  it("cliente com fator em aal2 está liberado", () => {
    expect(
      avaliarExigenciaDeMfa({ isAdmin: false, aal: "aal2", temFatorVerificado: true, obrigatorio: false })
        .estado,
    ).toBe("liberado");
  });

  it("cliente SEM fator continua entrando direto", () => {
    // A mudança não pode virar exigência para quem nunca pediu MFA.
    for (const obrigatorio of [true, false]) {
      expect(
        avaliarExigenciaDeMfa({ isAdmin: false, aal: "aal1", temFatorVerificado: false, obrigatorio })
          .estado,
      ).toBe("liberado");
    }
  });

  it("cadastro só é exigido de admin, e só com a flag ligada", () => {
    const casos = [
      { isAdmin: true, obrigatorio: true, esperado: "cadastro_necessario" },
      { isAdmin: true, obrigatorio: false, esperado: "liberado" },
      { isAdmin: false, obrigatorio: true, esperado: "liberado" },
      { isAdmin: false, obrigatorio: false, esperado: "liberado" },
    ] as const;

    for (const c of casos) {
      const r = avaliarExigenciaDeMfa({
        isAdmin: c.isAdmin,
        aal: "aal1",
        temFatorVerificado: false,
        obrigatorio: c.obrigatorio,
      });
      expect(r.estado, `isAdmin=${c.isAdmin} obrigatorio=${c.obrigatorio}`).toBe(c.esperado);
    }
  });

  it("o motivo diz o que fazer", () => {
    const cadastro = avaliarExigenciaDeMfa({ isAdmin: true, aal: null, temFatorVerificado: false, obrigatorio: true });
    const desafio = avaliarExigenciaDeMfa({ isAdmin: true, aal: null, temFatorVerificado: true, obrigatorio: true });
    if (cadastro.estado === "cadastro_necessario") expect(cadastro.motivo).toMatch(/[Cc]adastre/);
    if (desafio.estado === "desafio_necessario") expect(desafio.motivo).toMatch(/[Cc]ódigo/);
  });
});

describe("podeAtenderRotaAdmin", () => {
  it("em sombra, tudo passa", () => {
    expect(podeAtenderRotaAdmin("aal1", false)).toBe(true);
    expect(podeAtenderRotaAdmin(null, false)).toBe(true);
  });

  it("exigindo, só aal2 passa", () => {
    expect(podeAtenderRotaAdmin("aal2", true)).toBe(true);
    expect(podeAtenderRotaAdmin("aal1", true)).toBe(false);
    expect(podeAtenderRotaAdmin(null, true)).toBe(false);
  });
});

describe("motivoParaNaoRemoverFator", () => {
  const totp = (id: string, status: "verified" | "unverified" = "verified") => ({ id, status });

  it("cliente comum remove o que quiser, inclusive o último", () => {
    expect(
      motivoParaNaoRemoverFator({ fatores: [totp("a")], fatorId: "a", exigeMfa: false }),
    ).toBeNull();
  });

  it("admin não fica sem nenhum autenticador de uma vez", () => {
    expect(
      motivoParaNaoRemoverFator({ fatores: [totp("a")], fatorId: "a", exigeMfa: true }),
    ).toMatch(/único autenticador/i);
  });

  it("admin com dois troca um pelo outro", () => {
    // O caminho de trocar de celular: cadastra o novo, remove o antigo.
    expect(
      motivoParaNaoRemoverFator({ fatores: [totp("a"), totp("b")], fatorId: "a", exigeMfa: true }),
    ).toBeNull();
  });

  it("sobra de cadastro abandonado sai mesmo sendo a única linha", () => {
    // `unverified` não protege nada; contá-lo como proteção deixaria o admin
    // preso a um fator que nunca funcionou.
    expect(
      motivoParaNaoRemoverFator({ fatores: [totp("a", "unverified")], fatorId: "a", exigeMfa: true }),
    ).toBeNull();
  });

  it("pendente não conta como proteção ao remover o verificado", () => {
    const fatores = [totp("verificado"), totp("pendente", "unverified")];
    expect(
      motivoParaNaoRemoverFator({ fatores, fatorId: "verificado", exigeMfa: true }),
    ).toMatch(/único autenticador/i);
  });

  it("id que não existe não vira remoção silenciosa", () => {
    expect(
      motivoParaNaoRemoverFator({ fatores: [totp("a")], fatorId: "sumiu", exigeMfa: true }),
    ).toMatch(/não existe/i);
  });
});
