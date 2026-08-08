import { useCallback, useEffect, useState } from "react";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import {
  avaliarExigenciaDeMfa,
  motivoParaNaoRemoverFator,
  type Aal,
  type ExigenciaDeMfa,
} from "@/lib/mfa";

/**
 * O segundo fator e obrigatorio para administrar?
 *
 * Espelha `MFA_ADMIN_OBRIGATORIO` do servidor, com o prefixo `VITE_` porque so
 * variavel prefixada chega ao navegador. **As duas viram juntas** — ver a nota
 * em `ContextoDeAcesso`.
 *
 * Vazio (o padrao hoje) = opcional: o painel abre para admin sem fator, e quem
 * quiser ativar encontra o cadastro na pagina da conta.
 */
const MFA_ADMIN_OBRIGATORIO = (import.meta.env.VITE_MFA_ADMIN_OBRIGATORIO ?? "").trim() === "1";

/**
 * O nome que aparece no aplicativo autenticador do celular.
 *
 * Sem isto, o Supabase monta a URI a partir do `site_url` do projeto — que esta
 * como `http://localhost:3000`. O resultado, medido em 08/08:
 *
 *   otpauth://totp/localhost:3000:pessoa@email.com?...&issuer=localhost:3000
 *
 * E o app do celular mostrava "localhost:3000". **Isso nao se corrige no
 * deploy**: o rotulo vem da URI, e a URI vem do `site_url`, nao do endereco de
 * onde a pagina foi aberta.
 *
 * Passar aqui torna o nome independente de configuracao de painel — mesmo
 * principio do `VITE_WEBAUTHN_RP_ID`.
 *
 * **Curto de proposito.** O autenticador lista varias contas numa coluna
 * estreita; "Clinicmais Suplemento e Nutricao" seria truncado justamente na
 * parte que identifica. Para e-mail, onde ha espaco, o nome completo continua.
 *
 * **Fica gravado no cadastro.** Trocar este valor nao renomeia quem ja
 * cadastrou — para mudar, a pessoa remove e cadastra de novo.
 */
const EMISSOR_DO_TOTP = "Clinicmais";

/**
 * Estado do segundo fator da sessao atual.
 *
 * Toda a mecanica do TOTP — RFC 6238, periodo de 30s, anti-replay, limite de
 * tentativas, guarda do segredo — fica no Supabase, que e o que a §11 exige e o
 * que nao se deve reimplementar. Aqui so mora o fluxo da tela.
 *
 * **Isto nao e o controle de acesso.** Quem recusa e o servidor, em
 * `api/_auth.ts`, olhando o `aal` de dentro do token assinado. Este hook existe
 * para a pessoa **conseguir** chegar em `aal2` — se ele fosse a unica barreira,
 * bastaria chamar `/api/*` direto para contorna-lo.
 */

export type TipoDeFator = "totp" | "webauthn";

export type Fator = {
  id: string;
  amigavel: string | null;
  status: "verified" | "unverified";
  tipo: TipoDeFator;
  /**
   * Quando o fator foi cadastrado. A §12 pede que a gestao mostre a criacao —
   * e sem data a lista nao responde "isto apareceu quando?", que e a unica
   * pergunta util diante de um autenticador que a pessoa nao reconhece.
   *
   * `null` quando o SDK nao devolve a data (fator antigo, ou formato inesperado):
   * a tela omite a linha em vez de inventar uma data.
   */
  criadoEm: string | null;
  /**
   * Quando o fator foi usado pela ultima vez para confirmar identidade.
   *
   * Vem da trilha de auditoria, e nao do SDK — ver `useMfa`. `null` quando nunca
   * foi usado, quando a trilha nao respondeu, ou quando a migration
   * `20260808130000` ainda nao foi aplicada. Nos tres casos a tela omite a
   * linha, porque "nunca usado" e "nao sei" nao devem parecer a mesma coisa que
   * uma data.
   */
  usadoEm: string | null;
};

/**
 * O passkey esta ligado **no projeto**?
 *
 * Diferente do suporte do navegador: aqui a pergunta e se o servidor aceita.
 * Hoje nao aceita, e nao ha como fazer aceitar — a Management API recusa o
 * proprio interruptor:
 *
 *   PATCH /config/auth  →  422
 *   {"message":"Enabling of MFA with WebAuthn not currently supported"}
 *
 * Enquanto `mfa_web_authn_enroll_enabled` for `false`, `mfa.webauthn.register`
 * devolve `MFA enroll is disabled for WebAuthn` — que foi o que o usuario viu ao
 * clicar no botao em 08/08.
 *
 * Fica em variavel, e nao em `false` fixo, porque o dia em que o Supabase
 * liberar a chave e um `.env` — nao um deploy de codigo. Ver
 * `scripts/configurar-auth-supabase.mjs`, que guarda a tentativa e a recusa.
 */
const PASSKEY_HABILITADO = (import.meta.env.VITE_PASSKEY_HABILITADO ?? "").trim() === "1";

/**
 * RP ID vindo de configuracao explicita, ja aparado.
 *
 * O `.trim()` nao e zelo: em 08/08 a variavel entrou na Vercel valendo
 * `"catalogo-clinicmais.iainfinity.com.br\r\n"`, porque o pipe do PowerShell
 * acrescenta CRLF ao mandar para o stdin do `vercel env add` — a propria CLI
 * avisou (`WARN! Value contains newlines`).
 *
 * As outras flags escaparam por comparar com `=== "1"`, onde lixo no fim so
 * deixa o resultado falso — que ja era o valor desejado. Esta nao: o RP ID vai
 * inteiro para dentro da chamada WebAuthn, e o navegador exige que ele seja
 * sufixo registravel da origem. Com `\r\n` no fim nao e, e o cadastro morre com
 * um `SecurityError` que nao aponta para a causa.
 *
 * Ficaria adormecido ate alguem ligar o passkey — ou seja, quebraria longe de
 * quem mexeu. Aparar aqui custa nada e vale para qualquer origem do valor.
 */
const RP_ID = (import.meta.env.VITE_WEBAUTHN_RP_ID ?? "").trim();

/**
 * O navegador suporta passkey?
 *
 * `PublicKeyCredential` nao existe em contexto inseguro nem em navegador antigo.
 * Sem esta checagem, o botao apareceria e falharia no clique — pior do que nao
 * aparecer.
 *
 * As duas pontas precisam concordar: navegador capaz **e** projeto com o recurso
 * ligado. Faltando qualquer uma, o clique falha do mesmo jeito para quem usa.
 */
export function suportaPasskey(): boolean {
  return (
    PASSKEY_HABILITADO &&
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}

export type EstadoDoMfa = {
  carregando: boolean;
  aal: Aal;
  fatores: Fator[];
  /** `null` enquanto carrega — a tela nao deve decidir nada antes disso. */
  exigencia: ExigenciaDeMfa | null;
  erro: string | null;
};

const INICIAL: EstadoDoMfa = {
  carregando: true,
  aal: null,
  fatores: [],
  exigencia: null,
  erro: null,
};

export function useMfa(isAdmin: boolean) {
  const [estado, setEstado] = useState<EstadoDoMfa>(INICIAL);

  const recarregar = useCallback(async () => {
    setEstado((anterior) => ({ ...anterior, carregando: true, erro: null }));
    try {
      const supabase = await loadSupabaseClient();
      const [nivel, lista, uso] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
        // Ultimo uso vem da trilha de auditoria, nao do SDK: `updated_at` do
        // fator marca alteracao do registro, nao uso. Ver a migration
        // `20260808130000_ultimo_uso_do_autenticador.sql`.
        //
        // A falha e tolerada de proposito — a lista de autenticadores e o botao
        // de remover valem mais do que a data, e derrubar tudo porque a trilha
        // nao respondeu seria trocar uma informacao a menos por uma tela vazia.
        supabase.rpc("clinic_b2b_ultimo_uso_dos_fatores").then(
          (r) => (r.error ? null : r.data),
          () => null,
        ),
      ]);

      // `currentLevel` e o nivel **desta sessao**; `nextLevel` seria o alcancavel.
      // Confundir os dois liberaria quem tem fator cadastrado mas nao o usou hoje.
      const aal = (nivel.data?.currentLevel as Aal) ?? null;

      const usoPorFator = new Map<string, string>();
      for (const linha of (uso ?? []) as Array<{ factor_id?: unknown; ultimo_uso?: unknown }>) {
        const id = typeof linha?.factor_id === "string" ? linha.factor_id : null;
        const quando = typeof linha?.ultimo_uso === "string" ? linha.ultimo_uso : null;
        if (id && quando) usoPorFator.set(id, quando);
      }

      const fatores: Fator[] = (lista.data?.all ?? [])
        .filter((f) => f.factor_type === "totp" || f.factor_type === "webauthn")
        .map((f) => ({
          id: f.id,
          amigavel: f.friendly_name ?? null,
          status: f.status === "verified" ? "verified" : "unverified",
          tipo: f.factor_type === "webauthn" ? "webauthn" : "totp",
          criadoEm: typeof f.created_at === "string" && f.created_at ? f.created_at : null,
          usadoEm: usoPorFator.get(f.id) ?? null,
        }));

      setEstado({
        carregando: false,
        aal,
        fatores,
        exigencia: avaliarExigenciaDeMfa({
          isAdmin,
          aal,
          obrigatorio: MFA_ADMIN_OBRIGATORIO,
          temFatorVerificado: fatores.some((f) => f.status === "verified"),
        }),
        erro: null,
      });
    } catch (erro) {
      console.error("[mfa] falha ao ler o estado:", erro);
      setEstado({
        carregando: false,
        aal: null,
        fatores: [],
        // Falha de leitura nao pode virar "liberado". Sem saber o nivel, a tela
        // pede o desafio; o servidor decide de verdade.
        exigencia: isAdmin
          ? { estado: "desafio_necessario", motivo: "Não foi possível confirmar a verificação em duas etapas." }
          : { estado: "liberado" },
        erro: "Não foi possível confirmar a verificação em duas etapas.",
      });
    }
  }, [isAdmin]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  /**
   * Confere a senha atual — a "autenticacao recente" que a §12 exige.
   *
   * *"Registro DEVE exigir autenticacao recente ou cerimonia equivalente. Um
   * cookie de sessao antigo, isoladamente, NAO DEVE autorizar novo passkey."*
   *
   * Sem isto, uma sessao restaurada do armazenamento dias depois — ou deixada
   * aberta numa maquina compartilhada — bastaria para vincular um autenticador
   * novo a conta. Quem achasse a tela aberta cadastraria o proprio celular.
   */
  const reautenticar = useCallback(async (senha: string) => {
    const supabase = await loadSupabaseClient();
    const { data: sessao } = await supabase.auth.getUser();
    const email = sessao.user?.email;
    if (!email) throw new Error("Sessão sem e-mail. Entre novamente.");

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error("Senha incorreta.");
  }, []);

  /**
   * Comeca o cadastro de um autenticador e devolve o que a tela precisa mostrar.
   *
   * Reaproveita um fator `unverified` que tenha sobrado de tentativa anterior: o
   * Supabase recusa cadastrar dois com o mesmo nome, e sem isso a pessoa que
   * fechou a tela no meio ficaria travada sem entender por que.
   */
  const iniciarCadastro = useCallback(async () => {
    const supabase = await loadSupabaseClient();

    const lista = await supabase.auth.mfa.listFactors();
    const pendente = (lista.data?.all ?? []).find(
      (f) => f.factor_type === "totp" && f.status === "unverified",
    );
    if (pendente) await supabase.auth.mfa.unenroll({ factorId: pendente.id });

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      issuer: EMISSOR_DO_TOTP,
      friendlyName: `Clinicmais · ${new Date().toLocaleDateString("pt-BR")}`,
    });
    if (error) throw error;

    return {
      fatorId: data.id,
      qrCode: data.totp.qr_code,
      segredo: data.totp.secret,
    };
  }, []);

  /** Confirma o codigo de seis digitos — vale tanto para cadastro quanto para desafio. */
  const confirmarCodigo = useCallback(
    async (fatorId: string, codigo: string) => {
      const supabase = await loadSupabaseClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: fatorId,
        code: codigo.replace(/\D/g, ""),
      });
      if (error) throw error;
      // O token novo ja vem com `aal2`; recarregar e o que faz a tela sair do
      // portao.
      await recarregar();
    },
    [recarregar],
  );

  /**
   * Cadastra um passkey — a opcao resistente a phishing que a §11 exige.
   *
   * O SDK faz a cerimonia inteira: registra o fator, pede o desafio, chama
   * `navigator.credentials.create()` e verifica. `rpId` e `rpOrigins` ficam com o
   * padrao (host e origem atuais), que e o correto — fixa-los na mao e o jeito
   * classico de quebrar o login ao trocar de dominio.
   *
   * A API esta marcada `@experimental` no proprio SDK. Por isso o passkey e
   * **alternativa** ao TOTP, e nao substituto: se ela mudar de forma numa versao
   * futura, quem cadastrou passkey ainda tem o aplicativo autenticador.
   */
  const cadastrarPasskey = useCallback(async () => {
    const supabase = await loadSupabaseClient();
    const { error } = await supabase.auth.mfa.webauthn.register({
      friendlyName: `Passkey · ${new Date().toLocaleDateString("pt-BR")}`,
      // A §12 exige que "RP ID e origens permitidas DEVEM vir de configuracao
      // explicita". Sem a variavel, cai no padrao do SDK (host atual) — que
      // funciona, mas nao e configuracao explicita; fica registrado no perfil.
      ...(RP_ID ? { webauthn: { rpId: RP_ID } } : {}),
    });
    if (error) throw error;
    await recarregar();
  }, [recarregar]);

  /** Desafio por passkey, para quem ja cadastrou um. */
  const autenticarComPasskey = useCallback(
    async (fatorId: string) => {
      const supabase = await loadSupabaseClient();
      const { error } = await supabase.auth.mfa.webauthn.authenticate({ factorId: fatorId });
      if (error) throw error;
      await recarregar();
    },
    [recarregar],
  );

  /**
   * Remove um autenticador.
   *
   * A regra de **se** pode remover mora em `motivoParaNaoRemoverFator`, pura e
   * testada; aqui fica so o I/O. A checagem e refeita contra o estado recem-lido
   * do servidor, e nao contra o que a tela mostrava: entre abrir a pagina e
   * clicar, o fator pode ter sido removido em outra aba.
   *
   * A senha e exigida pelo mesmo motivo do cadastro (§12): sessao velha achada
   * aberta nao pode desmontar a protecao da conta.
   */
  /**
   * Remove um autenticador.
   *
   * ## Por que o codigo, e nao a senha
   *
   * A versao anterior pedia a senha e chamava `signInWithPassword` para provar
   * "autenticacao recente" (§12). Isso **quebrava a remocao**: `signInWithPassword`
   * abre uma sessao nova em `aal1`, derrubando o `aal2` que a pessoa tinha — e o
   * Supabase recusa com "AAL2 required to unenroll verified factor". A prova de
   * identidade destruia a permissao de agir.
   *
   * Pedir o codigo do proprio fator resolve os dois lados de uma vez: sobe a
   * sessao para `aal2`, que e o que o servidor exige, e e prova **mais forte**
   * que a senha — quem tem o codigo tem o autenticador em maos, que e
   * exatamente o que se quer confirmar antes de desligar a protecao.
   *
   * Fator ainda nao verificado nao pede nada: e sobra de um cadastro que nao
   * terminou, nao ha protecao ativa para derrubar.
   */
  const removerFator = useCallback(
    async (fatorId: string, codigo: string) => {
      const supabase = await loadSupabaseClient();

      const alvo = (await supabase.auth.mfa.listFactors()).data?.all?.find((f) => f.id === fatorId);
      if (alvo?.status === "verified") {
        const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({ factorId: fatorId });
        if (erroDesafio || !desafio) throw new Error("Não foi possível iniciar a confirmação.");

        const { error: erroCodigo } = await supabase.auth.mfa.verify({
          factorId: fatorId,
          challengeId: desafio.id,
          code: codigo,
        });
        if (erroCodigo) throw new Error("Código inválido. Confira o aplicativo e tente de novo.");
      }

      const lista = await supabase.auth.mfa.listFactors();
      const atuais = (lista.data?.all ?? []).map((f) => ({
        id: f.id,
        status: f.status === "verified" ? ("verified" as const) : ("unverified" as const),
      }));

      const impedimento = motivoParaNaoRemoverFator({ fatores: atuais, fatorId, exigeMfa: isAdmin });
      if (impedimento) throw new Error(impedimento);

      const { error } = await supabase.auth.mfa.unenroll({ factorId: fatorId });
      if (error) throw error;
      await recarregar();
    },
    [isAdmin, recarregar],
  );

  return {
    ...estado,
    recarregar,
    removerFator,
    reautenticar,
    iniciarCadastro,
    confirmarCodigo,
    cadastrarPasskey,
    autenticarComPasskey,
  };
}
