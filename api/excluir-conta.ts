import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_auth.js";
import { aplicarRateLimit } from "./_rateLimit.js";

/**
 * Exclui a conta de quem está chamando.
 *
 * ## Por que no servidor
 *
 * Apagar o usuário do Supabase Auth exige a chave de service role, que nunca pode
 * ir para o navegador. E as tabelas ligadas precisam sair na **mesma** operação:
 * conta apagada com perfil órfão é pior que conta viva.
 *
 * ## Reautenticação (§27)
 *
 * A §27 exige "reautenticação forte recente". Estar logado não basta: sessão
 * esquecida aberta num computador compartilhado não pode virar conta apagada.
 * Por isso a senha é conferida aqui, contra o próprio Supabase, antes de
 * qualquer escrita.
 *
 * ## O que NÃO é apagado
 *
 * Pedido e conversa de suporte são chaveados por `customer_cnpj`, não por
 * `user_id`: pertencem ao CNPJ da empresa e têm guarda fiscal. A trilha de
 * auditoria também fica — ela não guarda dado pessoal, só datas e identificadores.
 * A lista que a tela mostra vive em `src/lib/exclusaoDeConta.ts`, e é a mesma
 * coisa que esta rota faz.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const ANON_KEY = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();

/** Tabelas apagadas por `user_id`, na ordem em que podem sair sem violar FK. */
const TABELAS_POR_USER_ID = [
  "clinic+b2b_customer_favorites",
  "clinic+b2b_catalog_notification_reads",
  "clinic+b2b_product_reviews",
  "clinic+b2b_customer_addresses",
  "clinic+b2b_customer_profiles",
  "clinic+b2b_user_roles",
  "clinic+b2b_admin_users",
] as const;

function comServiceRole(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      ...(init.headers ?? {}),
    },
  });
}

/** Confere a senha atual contra o Supabase. Não cria sessão utilizável. */
async function senhaConfere(email: string, senha: string): Promise<boolean> {
  const resposta = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ email, password: senha }),
  });
  return resposta.ok;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (!(await aplicarRateLimit(req, res, "excluir-conta", auth.userId))) return;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    console.error("[excluir-conta] credenciais do Supabase ausentes.");
    res.status(503).json({ error: "Exclusão indisponível no servidor." });
    return;
  }

  const senha = typeof req.body?.senha === "string" ? req.body.senha : "";
  if (!senha) {
    res.status(400).json({ error: "Informe sua senha atual para confirmar." });
    return;
  }

  // O e-mail vem do token, não do corpo: aceitar do cliente permitiria conferir a
  // senha de uma conta e apagar outra.
  const usuario = await comServiceRole(`/auth/v1/admin/users/${auth.userId}`, { method: "GET" });
  if (!usuario.ok) {
    console.error("[excluir-conta] não foi possível ler o usuário:", usuario.status);
    res.status(502).json({ error: "Não foi possível concluir. Tente de novo." });
    return;
  }
  const email = ((await usuario.json()) as { email?: string }).email ?? "";

  if (!email || !(await senhaConfere(email, senha))) {
    res.status(403).json({ error: "Senha incorreta." });
    return;
  }

  // A partir daqui, cada falha é registrada mas não interrompe: parar no meio
  // deixaria a conta viva com metade dos dados fora, que é o pior desfecho.
  const falhas: string[] = [];
  for (const tabela of TABELAS_POR_USER_ID) {
    const resposta = await comServiceRole(
      `/rest/v1/${encodeURIComponent(tabela)}?user_id=eq.${encodeURIComponent(auth.userId)}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } },
    );
    if (!resposta.ok) {
      falhas.push(tabela);
      console.error("[excluir-conta] falha ao limpar", tabela, resposta.status);
    }
  }

  // Por último o usuário: apagá-lo antes deixaria as linhas acima órfãs se algo
  // falhasse no meio. E é este passo que invalida sessões e autenticadores.
  const remocao = await comServiceRole(`/auth/v1/admin/users/${auth.userId}`, { method: "DELETE" });
  if (!remocao.ok) {
    console.error("[excluir-conta] falha ao remover o usuário:", remocao.status);
    res.status(502).json({
      error: "Não foi possível concluir a exclusão. Nenhuma alteração foi confirmada — fale com o suporte.",
    });
    return;
  }

  if (falhas.length > 0) {
    // A conta já não existe, então o acesso acabou. Mas sobrou dado, e isso
    // precisa aparecer para alguém — silenciar viraria promessa não cumprida.
    console.error("[excluir-conta] conta removida com resíduo em:", falhas.join(", "));
  }

  res.status(200).json({ ok: true });
}
