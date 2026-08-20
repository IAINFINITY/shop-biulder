import { describe, expect, it } from "vitest";
import {
  agruparPorEmpresa,
  estaPendenteDeConfirmacao,
  listarCadastrosPendentes,
} from "@/lib/cadastrosPendentes";

/** 20/08/2026 12:00, para os dias parados serem determinísticos. */
const AGORA = new Date("2026-08-20T12:00:00Z").getTime();

/** Os quatro casos reais do banco no dia em que o suporte perguntou. */
const REAIS = [
  {
    id: "1",
    email: "wennareis@gmail.com",
    created_at: "2026-08-16T20:13:11.787Z",
    email_confirmed_at: null,
    last_sign_in_at: null,
    user_metadata: { company: "OPCAO DE VIDA COMERCIO DE PRODUTOS NATURAIS LTDA", cnpj: "11.847.016/0001-50" },
  },
  {
    id: "2",
    email: "opcao.vida@hotmail.com",
    created_at: "2026-08-16T21:02:00.000Z",
    email_confirmed_at: null,
    last_sign_in_at: null,
    user_metadata: { company: "OPCAO DE VIDA COMERCIO DE PRODUTOS NATURAIS LTDA", cnpj: "11.847.016/0001-50" },
  },
  {
    id: "3",
    email: "confirmado@x.com",
    created_at: "2026-08-10T10:00:00.000Z",
    email_confirmed_at: "2026-08-10T10:05:00.000Z",
    last_sign_in_at: "2026-08-10T10:06:00.000Z",
    user_metadata: { company: "Empresa OK" },
  },
];

describe("estaPendenteDeConfirmacao", () => {
  it("reconhece quem nunca confirmou nem entrou", () => {
    expect(estaPendenteDeConfirmacao(REAIS[0])).toBe(true);
  });

  it("quem confirmou não está pendente", () => {
    expect(estaPendenteDeConfirmacao(REAIS[2])).toBe(false);
  });

  it("quem já entrou alguma vez não entra na lista", () => {
    /**
     * As duas condições juntas são o ponto.
     *
     * Conta criada pelo painel nasce confirmada, e conta antiga pode ter
     * `email_confirmed_at` nulo sem estar travada — porque já entrou. Olhar só
     * a confirmação encheria a lista de gente que não precisa de ajuda.
     */
    expect(
      estaPendenteDeConfirmacao({
        id: "x",
        email: "antigo@x.com",
        email_confirmed_at: null,
        last_sign_in_at: "2026-07-01T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("entrada ausente não quebra", () => {
    expect(estaPendenteDeConfirmacao(null)).toBe(false);
    expect(estaPendenteDeConfirmacao(undefined)).toBe(false);
  });
});

describe("listarCadastrosPendentes", () => {
  it("traz só os travados, com os dados do cadastro", () => {
    const lista = listarCadastrosPendentes(REAIS, AGORA);
    expect(lista.map((c) => c.email)).toEqual(["opcao.vida@hotmail.com", "wennareis@gmail.com"]);
    expect(lista[1].empresa).toContain("OPCAO DE VIDA");
    expect(lista[1].cnpj).toBe("11.847.016/0001-50");
  });

  it("conta quantos dias a conta está parada", () => {
    const lista = listarCadastrosPendentes([REAIS[0]], AGORA);
    expect(lista[0].diasParado).toBe(3);
  });

  it("mais recente primeiro", () => {
    // Quem acabou de travar é quem ainda está tentando — e quem ligou.
    const lista = listarCadastrosPendentes(REAIS, AGORA);
    expect(lista[0].criadoEm > lista[1].criadoEm).toBe(true);
  });

  it("conta sem e-mail fica de fora", () => {
    // Sem e-mail não há o que reenviar nem como identificar a pessoa.
    const lista = listarCadastrosPendentes(
      [{ id: "z", email: "", email_confirmed_at: null, last_sign_in_at: null }],
      AGORA,
    );
    expect(lista).toEqual([]);
  });

  it("aceita metadados nos dois formatos", () => {
    // A API admin devolve `user_metadata`; a consulta direta ao banco,
    // `raw_user_meta_data`. Ler só um deixaria a empresa vazia num dos casos.
    const lista = listarCadastrosPendentes(
      [{ id: "w", email: "a@b.com", created_at: "2026-08-19T00:00:00Z", email_confirmed_at: null, last_sign_in_at: null, raw_user_meta_data: { company: "Via banco" } }],
      AGORA,
    );
    expect(lista[0].empresa).toBe("Via banco");
  });

  it("lista vazia ou ausente não quebra", () => {
    expect(listarCadastrosPendentes([], AGORA)).toEqual([]);
    expect(listarCadastrosPendentes(null, AGORA)).toEqual([]);
  });
});

describe("agruparPorEmpresa", () => {
  it("junta as duas tentativas da mesma empresa", () => {
    /**
     * O sinal que o caso real deu: duas contas, e-mails diferentes, mesmo CNPJ,
     * mesmo dia, nenhuma confirmada. Isso não é a pessoa esquecendo de clicar —
     * é a mensagem não chegando. Soltas na lista, ninguém relaciona as duas.
     */
    const grupos = agruparPorEmpresa(listarCadastrosPendentes(REAIS, AGORA));
    expect(grupos.size).toBe(1);
    expect([...grupos.values()][0]).toHaveLength(2);
  });

  it("empresas diferentes não se misturam", () => {
    const grupos = agruparPorEmpresa([
      { id: "1", email: "a@x.com", criadoEm: "2026-08-19", empresa: "A", cnpj: "11111111000191", diasParado: 1, enviadoEm: "" },
      { id: "2", email: "b@y.com", criadoEm: "2026-08-18", empresa: "B", cnpj: "22222222000192", diasParado: 2, enviadoEm: "" },
    ]);
    expect(grupos.size).toBe(2);
  });
});

describe("enviadoEm", () => {
  it("guarda quando o e-mail saiu", () => {
    /**
     * Separa dois problemas com respostas opostas: "não enviamos" (algo nosso
     * quebrado) e "enviamos e não chegou" (spam, caixa cheia, endereço errado).
     * Nos quatro pendentes reais o envio consta — então o caminho a investigar
     * é a entrega, não o disparo.
     */
    const lista = listarCadastrosPendentes(
      [{ ...REAIS[0], confirmation_sent_at: "2026-08-16T20:13:12.000Z" }],
      AGORA,
    );
    expect(lista[0].enviadoEm).toBe("2026-08-16T20:13:12.000Z");
  });

  it("sem envio registrado, fica vazio em vez de inventar data", () => {
    const lista = listarCadastrosPendentes([REAIS[0]], AGORA);
    expect(lista[0].enviadoEm).toBe("");
  });
});
