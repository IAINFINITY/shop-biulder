/**
 * Garantia de autenticacao (AAL) — a regra, pura e testavel.
 *
 * A §11 do padrao e categorica: *"MFA DEVE ser exigido para administradores,
 * operadores privilegiados e contas de alto valor"*. E a §31 lista "autenticacao
 * ou autorizacao somente no frontend" como antipadrao — ou seja, exigir o segundo
 * fator so na tela e teatro. O que vale e o servidor recusar o token que nao
 * carrega a prova.
 *
 * ## Onde a prova esta
 *
 * O Supabase grava no proprio JWT a reivindicacao `aal`:
 *
 * - `aal1` — a pessoa provou um fator (senha);
 * - `aal2` — provou dois (senha + TOTP/WebAuthn).
 *
 * Nao ha como forjar: o valor esta dentro do token assinado. Um token `aal1`
 * continua valendo para a loja e deixa de valer para o painel.
 *
 * ## Sobre ler o payload sem verificar a assinatura
 *
 * `lerAal` decodifica o corpo do JWT sem conferir assinatura, e isso **so e
 * seguro depois** de o token ter sido validado — em `api/_auth.ts` isso acontece
 * na chamada a `/auth/v1/user`, que responde 200 apenas para token legitimo.
 * Chamar `lerAal` antes dessa validacao seria confiar em texto que o cliente
 * escreveu.
 */

export type Aal = "aal1" | "aal2" | null;

/**
 * O `aal` de dentro do token.
 *
 * Devolve `null` quando o token nao tem o formato esperado ou nao traz a
 * reivindicacao — e `null` nunca satisfaz `aal2`, entao a ausencia da informacao
 * e tratada como ausencia de garantia, e nao como permissao.
 */
export function lerAal(accessToken: string | null | undefined): Aal {
  if (!accessToken) return null;

  const partes = accessToken.split(".");
  if (partes.length !== 3) return null;

  try {
    // JWT usa base64url: `-` e `_` no lugar de `+` e `/`, e sem o preenchimento.
    const base64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const preenchido = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = typeof atob === "function"
      ? atob(preenchido)
      : Buffer.from(preenchido, "base64").toString("binary");
    const payload = JSON.parse(json) as { aal?: unknown };
    return payload.aal === "aal2" ? "aal2" : payload.aal === "aal1" ? "aal1" : null;
  } catch {
    return null;
  }
}

export type ContextoDeAcesso = {
  isAdmin: boolean;
  aal: Aal;
  /** Se a pessoa ja tem algum fator verificado cadastrado. */
  temFatorVerificado: boolean;
  /**
   * Se o segundo fator e **obrigatorio** para administrar.
   *
   * Vem de `VITE_MFA_ADMIN_OBRIGATORIO`. Enquanto for `false`, o painel abre
   * para admin sem fator — e o cadastro fica disponivel na conta, para quem
   * quiser ativar antes da virada.
   *
   * **Isto e so a tela.** Quem recusa de verdade e o servidor, lendo
   * `MFA_ADMIN_OBRIGATORIO` em `api/_auth.ts`. As duas precisam virar juntas:
   * so aqui deixaria a rota aberta, so la deixaria o painel inutilizavel.
   */
  obrigatorio: boolean;
};

export type ExigenciaDeMfa =
  | { estado: "liberado" }
  /** Tem fator cadastrado, mas esta sessao nao passou por ele. */
  | { estado: "desafio_necessario"; motivo: string }
  /** Nem cadastrou o fator ainda. */
  | { estado: "cadastro_necessario"; motivo: string };

/**
 * O que falta para esta sessao poder agir como administradora.
 *
 * A separacao entre "cadastro" e "desafio" nao e detalhe de tela: sao dois
 * problemas diferentes. Quem nunca cadastrou precisa de um QR Code; quem
 * cadastrou e abriu sessao nova precisa digitar seis digitos. Um so estado
 * obrigaria a interface a adivinhar qual dos dois mostrar.
 */
export function avaliarExigenciaDeMfa(contexto: ContextoDeAcesso): ExigenciaDeMfa {
  // Ja provou o segundo fator nesta sessao.
  if (contexto.aal === "aal2") return { estado: "liberado" };

  /**
   * **Quem tem fator, usa — seja admin ou cliente.**
   *
   * A versao anterior perguntava *quem voce e* (`if (!isAdmin) return liberado`)
   * antes de perguntar *o que a conta tem*. O efeito era que um cliente
   * cadastrava o autenticador, passava pela cerimonia inteira — senha, QR,
   * codigo — e nada nunca mais pedia o codigo. O fator ficava decorativo, e a
   * propria tela da conta dizia "estes sao os dispositivos que podem confirmar
   * sua identidade" enquanto nenhum era chamado a confirmar coisa alguma.
   *
   * Isso e pior do que nao oferecer MFA: da sensacao de protecao sem protecao.
   *
   * Nao e decisao de politica — e honrar a promessa que a interface fez. Quem
   * nao quiser usar remove o fator; enquanto ele existir, vale.
   */
  if (contexto.temFatorVerificado) {
    return {
      estado: "desafio_necessario",
      motivo: "Confirme o código do seu aplicativo autenticador para continuar.",
    };
  }

  /**
   * Sem fator: so o admin, e so quando a exigencia estiver ligada.
   *
   * Exigir o cadastro de todos no mesmo instante trancaria os administradores
   * para fora — e o painel e onde se cadastra o fator. Implantar assim nao e
   * endurecer a seguranca, e derrubar a operacao e ter que voltar atras.
   *
   * O caminho de cadastro fica aberto na conta e no painel, para quem quiser
   * ativar antes de a exigencia valer.
   */
  if (contexto.isAdmin && contexto.obrigatorio) {
    return {
      estado: "cadastro_necessario",
      motivo: "Acesso administrativo exige verificação em duas etapas. Cadastre um aplicativo autenticador.",
    };
  }

  return { estado: "liberado" };
}

/**
 * O servidor pode atender esta rota administrativa?
 *
 * `exigir` vem da flag de implantacao. Em sombra (`false`) a rota responde
 * normalmente e o chamador registra quem teria sido barrado — sem isso, ligar a
 * exigencia derrubaria todo administrador que ainda nao cadastrou o fator, e a
 * descoberta seria o painel fora do ar.
 *
 * A §2 e clara: rodar em sombra e uma **exceção temporaria**, nao conformidade.
 * Enquanto `exigir` for `false`, o item 3.2 do perfil continua em aberto.
 */
export function podeAtenderRotaAdmin(aal: Aal, exigir: boolean): boolean {
  if (!exigir) return true;
  return aal === "aal2";
}

/** O que a tela de inventario precisa saber sobre um fator para decidir. */
export type FatorParaRemocao = {
  id: string;
  status: "verified" | "unverified";
};

/**
 * Pode remover este autenticador? Devolve o impedimento, ou `null` se pode.
 *
 * A §12 pede que a pessoa **veja e remova** os proprios autenticadores — e o
 * inventario so serve para alguma coisa se der para agir sobre ele: descobrir um
 * fator estranho e nao poder tira-lo seria pior que nao ver.
 *
 * O unico impedimento e o ultimo fator verificado de quem e obrigado a ter MFA.
 * Nao e para proteger a pessoa de se trancar fora — ela nao se tranca, o
 * `MfaGate` pediria cadastro de novo. E que a remocao rebaixaria a conta para
 * `aal1` **silenciosamente**, e a diferenca entre "nao tenho MFA ainda" e "eu
 * tinha e sumiu" e exatamente o que um invasor com sessao roubada quer apagar.
 * Trocar de autenticador continua possivel: cadastra o novo, depois remove o
 * velho.
 *
 * Fator `unverified` sai sempre — e sobra de cadastro abandonado, nao protege
 * nada, e acumular esse lixo faz o inventario parar de ser legivel.
 */
export function motivoParaNaoRemoverFator(contexto: {
  fatores: FatorParaRemocao[];
  fatorId: string;
  /** Quem e obrigado a ter MFA. Hoje: administrador. */
  exigeMfa: boolean;
}): string | null {
  const alvo = contexto.fatores.find((f) => f.id === contexto.fatorId);
  if (!alvo) return "Este autenticador não existe mais nesta conta.";
  if (alvo.status === "unverified") return null;
  if (!contexto.exigeMfa) return null;

  const verificados = contexto.fatores.filter((f) => f.status === "verified");
  if (verificados.length > 1) return null;

  return "Este é o único autenticador da conta, e o acesso administrativo exige verificação em duas etapas. Cadastre outro antes de remover este.";
}
