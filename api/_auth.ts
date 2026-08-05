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

async function resolveIsAdmin(userId: string): Promise<boolean> {
  const response = await supabaseFetch("/rest/v1/rpc/has_role", {
    method: "POST",
    body: JSON.stringify({ _user_id: userId, _role: "admin" }),
  });
  if (!response.ok) {
    // Erro de schema aqui viraria "nao e admin" em silencio e tiraria o painel
    // do ar sem explicacao. Logar alto para o problema aparecer.
    console.error("[auth] has_role falhou:", response.status, await response.text().catch(() => ""));
    return false;
  }
  return (await response.json().catch(() => false)) === true;
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

  const [isAdmin, profile] = await Promise.all([resolveIsAdmin(userId), resolveProfile(userId)]);
  return { userId, isAdmin, profile };
}

/**
 * Guard padrao das rotas. Responde e devolve null quando o chamador nao pode
 * seguir, entao quem chama so precisa de `if (!auth) return;`.
 */
export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse,
  options: { adminOnly?: boolean } = {},
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

  if (options.adminOnly && !auth.isAdmin) {
    res.status(403).json({ error: "Acesso restrito a administradores." });
    return null;
  }

  return auth;
}
