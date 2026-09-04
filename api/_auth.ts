// Validacao do chamador das rotas `/api/*`.
//
// Arquivos com prefixo `_` dentro de `api/` nao viram rotas na Vercel.
//
// A decisao de autorizacao mora em `src/lib/apiAuth.ts` (pura e testavel); aqui
// fica so o I/O: ler a credencial do ambiente e perguntar ao Supabase quem e o
// portador do token. Usa `fetch` direto na API REST, como
// `proxisOrderStatusStore`, para nao carregar o SDK numa funcao serverless.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseBearerToken, type AuthContext, type AuthProfile } from "../src/lib/apiAuth.js";
import { dispositivoConfiavel } from "./_dispositivo.js";
import { lerAal, podeAtenderRotaAdmin } from "../src/lib/mfa.js";

/**
 * Repetido de proposito. O valor canonico e `CUSTOMER_PROFILES_TABLE` em
 * `src/lib/customerProfile.ts`, mas aquele arquivo importa o client do Supabase
 * do navegador — importa-lo aqui arrastaria o SDK inteiro para dentro da funcao
 * serverless. Se o nome mudar no banco, muda nos dois lugares.
 */
const CUSTOMER_PROFILES_TABLE = "clinic+b2b_customer_profiles";

const REQUEST_TIMEOUT_MS = 5000;

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

export function isAuthConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

async function supabaseFetch(path: string, init: RequestInit & { token?: string } = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${SUPABASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${init.token ?? SERVICE_ROLE_KEY}`,
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Id do usuario dono do token, ou null se o token nao valer. */
async function resolveUserId(token: string): Promise<string | null> {
  const response = await supabaseFetch("/auth/v1/user", { method: "GET", token });
  if (!response.ok) return null;
  const user = (await response.json().catch(() => null)) as { id?: unknown } | null;
  return typeof user?.id === "string" && user.id ? user.id : null;
}

export async function temPapel(userId: string, papel: "admin" | "superadmin"): Promise<boolean> {
  const response = await supabaseFetch("/rest/v1/rpc/has_role", {
    method: "POST",
    body: JSON.stringify({ _user_id: userId, _role: papel }),
  });
  if (!response.ok) {
    // Erro de schema aqui viraria "nao e admin" em silencio e tiraria o painel
    // do ar sem explicacao. Logar alto para o problema aparecer.
    console.error("[auth] has_role falhou:", response.status, await response.text().catch(() => ""));
    return false;
  }
  return (await response.json().catch(() => false)) === true;
}

/**
 * A permissão de seção de um admin.
 *
 * ⚠️ Ausência de linha vale como **acesso completo**: é o admin antigo, de antes
 * das permissões, e é o mesmo critério que `canAccessAdminSection` aplica no
 * painel. Tratar `null` como "não pode" tiraria esses admins do ar sem aviso —
 * foi assim que a seção de funcionários sumiu para todo mundo em 25/08/2026.
 */
export async function temPermissaoDeSecao(userId: string, secao: string): Promise<boolean> {
  const table = encodeURIComponent("clinic+b2b_admin_users");
  const response = await supabaseFetch(
    `/rest/v1/${table}?user_id=eq.${encodeURIComponent(userId)}&select=permissions&limit=1`,
    { method: "GET" },
  );

  if (!response.ok) {
    console.error("[auth] permissões falharam:", response.status, await response.text().catch(() => ""));
    return false;
  }

  const linhas = (await response.json().catch(() => null)) as { permissions?: Record<string, unknown> | null }[] | null;
  if (!Array.isArray(linhas) || linhas.length === 0) return true;

  const permissoes = linhas[0]?.permissions;
  if (permissoes === null || permissoes === undefined) return true;

  // `=== true` estrito, como nas funções de borda: um valor estranho na coluna
  // não deve virar permissão.
  return (permissoes as Record<string, unknown>)[secao] === true;
}

/** O tipo de conta do alvo, para decidir sobre quem uma permissão alcança. */
export async function tipoDeContaDe(userId: string): Promise<string | null> {
  const perfil = await resolveProfile(userId);
  return perfil?.customer_type ?? null;
}

async function resolveProfile(userId: string): Promise<AuthProfile | null> {
  const table = encodeURIComponent(CUSTOMER_PROFILES_TABLE);
  const columns = "cnpj,customer_type,proxis_tpr_id,linked_company_cnpj";
  const response = await supabaseFetch(
    `/rest/v1/${table}?user_id=eq.${encodeURIComponent(userId)}&select=${columns}&limit=1`,
    { method: "GET" },
  );
  if (!response.ok) {
    // Idem: sem perfil, todo cliente levaria 403 no checkout.
    console.error("[auth] leitura do perfil falhou:", response.status, await response.text().catch(() => ""));
    return null;
  }
  const rows = (await response.json().catch(() => null)) as AuthProfile[] | null;
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export async function authenticate(req: VercelRequest): Promise<AuthContext | null> {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) return null;

  const userId = await resolveUserId(token);
  if (!userId) return null;

  const [isAdmin, profile] = await Promise.all([temPapel(userId, "admin"), resolveProfile(userId)]);
  // `lerAal` decodifica o payload sem conferir assinatura, e isso so e seguro
  // **aqui**: `resolveUserId` acabou de provar que este token e legitimo. Chamar
  // antes disso seria confiar em texto escrito pelo cliente.
  return { userId, isAdmin, profile, aal: lerAal(token) };
}

/**
 * Guard padrao das rotas. Responde e devolve null quando o chamador nao pode
 * seguir, entao quem chama so precisa de `if (!auth) return;`.
 */
/**
 * Ultimo aviso de "admin sem aal2" por usuario, para nao repetir.
 *
 * Vive no modulo, entao vale enquanto a instancia serverless viver. Numa
 * instancia nova o aviso sai de novo — o que e desejavel: o objetivo e saber
 * **se ainda acontece**, nao contar quantas vezes.
 */
const avisoSemAal2 = new Map<string, number>();
const INTERVALO_DO_AVISO_MS = 60 * 60 * 1000;

function deveAvisarSemAal2(userId: string): boolean {
  const agora = Date.now();
  const ultimo = avisoSemAal2.get(userId);
  if (ultimo && agora - ultimo < INTERVALO_DO_AVISO_MS) return false;

  avisoSemAal2.set(userId, agora);
  // O mapa nao cresce sem limite: sao poucos admins, e entradas velhas saem.
  if (avisoSemAal2.size > 50) {
    for (const [id, quando] of avisoSemAal2) {
      if (agora - quando >= INTERVALO_DO_AVISO_MS) avisoSemAal2.delete(id);
    }
  }
  return true;
}

export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse,
  options: { adminOnly?: boolean; superadminOnly?: boolean } = {},
): Promise<AuthContext | null> {
  if (!isAuthConfigured()) {
    console.error("[auth] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes: rota indisponivel.");
    res.status(503).json({ error: "Autenticação indisponível no servidor." });
    return null;
  }

  let auth: AuthContext | null = null;
  try {
    auth = await authenticate(req);
  } catch (error) {
    console.error("[auth] falha ao validar o token:", error);
    res.status(503).json({ error: "Não foi possível validar a autenticação." });
    return null;
  }

  if (!auth) {
    res.status(401).json({ error: "Não autenticado." });
    return null;
  }

  // Superadmin implica admin: sem isto, uma rota marcada so como
  // `superadminOnly` pularia a exigencia de segundo fator logo abaixo, que
  // esta amarrada em `adminOnly`. Justamente a rota mais sensivel ficaria com a
  // guarda mais fraca.
  const exigeAdmin = Boolean(options.adminOnly || options.superadminOnly);

  if (exigeAdmin && !auth.isAdmin) {
    res.status(403).json({ error: "Acesso restrito a administradores." });
    return null;
  }

  if (options.superadminOnly && !(await temPapel(auth.userId, "superadmin"))) {
    res.status(403).json({ error: "Acesso restrito ao superadministrador." });
    return null;
  }

  /**
   * Rota administrativa exige segundo fator (§11).
   *
   * Este e o ponto que faz o MFA valer: exigido so na tela, ele seria contornado
   * por quem chamasse `/api/*` direto com o token — o que a §31 chama de
   * "autenticacao ou autorizacao somente no frontend".
   *
   * **Modo sombra enquanto `MFA_ADMIN_OBRIGATORIO` estiver vazio.** Ligar de uma
   * vez derrubaria todo administrador que ainda nao cadastrou o fator, e a
   * descoberta seria o painel fora do ar. Mesmo padrao de
   * `PRICING_ENFORCE_SERVER_PRICE`.
   *
   * A §2 e clara em que rodar em sombra e **exceção temporaria**, nao
   * conformidade: enquanto a flag estiver desligada, o item 3.2 do
   * PERFIL-CLINIC-PLUS.md continua em aberto.
   */
  if (exigeAdmin) {
    const exigir = process.env.MFA_ADMIN_OBRIGATORIO === "1";

    /**
     * Aparelho confiavel vale tanto quanto `aal2` — e por isso ele existe.
     *
     * Sem esta linha, "lembrar deste aparelho" seria fachada: a tela dispensaria
     * o desafio, o token continuaria `aal1`, e no dia em que
     * `MFA_ADMIN_OBRIGATORIO=1` subisse o painel devolveria 403 para justamente
     * quem marcou a caixinha. O front prometeria uma coisa e o servidor faria
     * outra — exatamente o desencontro que a §31 chama de autorizacao so no
     * frontend.
     *
     * A consulta so acontece quando faz diferenca: com `aal2` ja provado, nao ha
     * o que perguntar, e o `&&` de curto-circuito poupa uma ida ao banco em toda
     * chamada administrativa de quem digitou o codigo.
     *
     * Isto **nao** afrouxa a §11. O aparelho so entrou na lista depois de alguem
     * ter passado pelo segundo fator naquela maquina, e some com a revogacao ou
     * em 30 dias.
     */
    const comDispositivo =
      auth.aal !== "aal2" && (await dispositivoConfiavel(req, auth.userId));

    if (!comDispositivo && !podeAtenderRotaAdmin(auth.aal, exigir)) {
      res.status(403).json({
        error: "Esta operação exige verificação em duas etapas.",
        codigo: "mfa_necessario",
      });
      return null;
    }
    if (!exigir && auth.aal !== "aal2" && !comDispositivo && deveAvisarSemAal2(auth.userId)) {
      // O log e o que permite saber quando da para ligar a flag sem derrubar
      // ninguem: quando esta linha parar de aparecer, todo admin ja tem fator.
      //
      // **Uma vez por admin a cada hora**, e nao por requisicao. Cada tela do
      // painel dispara varias chamadas, entao a versao anterior repetia a mesma
      // frase dezenas de vezes por minuto e afogava o resto do log — inclusive
      // os erros que alguem precisaria ver. Um aviso que ninguem consegue ler
      // deixa de ser aviso.
      console.warn(
        `[auth] admin ${auth.userId} acessou rota administrativa sem aal2 (aal=${auth.aal}). ` +
          "Com MFA_ADMIN_OBRIGATORIO=1 este acesso seria recusado.",
      );
    }
  }

  return auth;
}
