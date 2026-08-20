import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  estaPendenteDeConfirmacao,
  listarCadastrosPendentes,
  type UsuarioBruto,
} from "../src/lib/cadastrosPendentes.js";
import { requireAuth } from "./_auth.js";
import { aplicarRateLimit } from "./_rateLimit.js";

/**
 * Cadastros parados na confirmação de e-mail — listar e reenviar.
 *
 * ## Por que no servidor
 *
 * A lista mora em `auth.users`, que só a chave de service role alcança. Ela
 * nunca pode ir para o navegador, então a leitura acontece aqui.
 *
 * ## Por que a tela precisa disso
 *
 * O perfil do cliente só nasce depois da confirmação. Antes disso a conta
 * existe, mas some da aba Clientes — e o atendimento responde "não há
 * cadastro" para alguém que se cadastrou. Foi o caso da Opção de Vida: duas
 * contas criadas no mesmo dia, nenhuma confirmada, nenhuma visível.
 *
 * ## O que esta rota NÃO devolve
 *
 * Nada que sirva para entrar na conta: sem token, sem hash de senha, sem link
 * de confirmação. O link é credencial — publicá-lo no painel faria a lista
 * virar um caminho para acessar a conta de terceiros. O reenvio manda a
 * mensagem para o **e-mail cadastrado**, e o link só existe na caixa da pessoa.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const ANON_KEY = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();

/** Quantas contas varrer. O volume é pequeno; o teto existe para não paginar sem limite. */
const MAX_USUARIOS = 200;

async function listar(res: VercelResponse) {
  const resposta = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?per_page=${MAX_USUARIOS}`,
    { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
  );

  if (!resposta.ok) {
    console.error("[cadastros-pendentes] falha ao listar usuários:", resposta.status);
    res.status(502).json({ error: "Não foi possível consultar os cadastros." });
    return;
  }

  const corpo = (await resposta.json()) as { users?: UsuarioBruto[] };
  res.status(200).json({ pendentes: listarCadastrosPendentes(corpo.users, Date.now()) });
}

async function reenviar(req: VercelRequest, res: VercelResponse) {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  if (!email) {
    res.status(400).json({ error: "Informe o e-mail." });
    return;
  }

  /**
   * Só reenvia para quem está mesmo pendente — conferido aqui, não presumido.
   *
   * A primeira versão deste arquivo afirmava que `/auth/v1/resend` recusa
   * e-mail já confirmado. **Não recusa.** Testado contra uma conta confirmada:
   * devolveu `200`. A proteção que eu documentei não existia, e um comentário
   * que garante o que não acontece é pior que nenhum — alguém confia nele.
   *
   * Sem esta checagem, o painel viraria um botão para disparar mensagem a
   * qualquer cliente já ativo, e a lista de pendentes deixaria de ser o limite
   * do que a tela consegue fazer.
   */
  const busca = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?per_page=${MAX_USUARIOS}`,
    { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
  );

  if (!busca.ok) {
    console.error("[cadastros-pendentes] não foi possível conferir o cadastro:", busca.status);
    res.status(502).json({ error: "Não foi possível confirmar o cadastro agora." });
    return;
  }

  const usuarios = ((await busca.json()) as { users?: UsuarioBruto[] }).users ?? [];
  const alvo = usuarios.find((u) => (u.email ?? "").trim().toLowerCase() === email.toLowerCase());

  if (!alvo || !estaPendenteDeConfirmacao(alvo)) {
    // Mesma resposta para "não existe" e "já confirmou", de propósito: são as
    // duas coisas que a §21 manda não distinguir para quem pergunta de fora.
    // Aqui quem pergunta é o painel, mas a resposta é registrada em log e o
    // custo de manter a regra é zero.
    res.status(409).json({
      error: "Este e-mail não está aguardando confirmação.",
      detalhe: "Ou a conta já foi confirmada, ou não existe cadastro com este endereço.",
    });
    return;
  }

  const resposta = await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ type: "signup", email }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    console.error("[cadastros-pendentes] reenvio recusado:", resposta.status, detalhe.slice(0, 200));
    res.status(502).json({
      error: "Não foi possível reenviar agora.",
      detalhe: "O Supabase limita reenvios seguidos para o mesmo e-mail. Tente de novo em alguns minutos.",
    });
    return;
  }

  res.status(200).json({ ok: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  // Só o painel. A lista revela quem tentou se cadastrar — e-mail e empresa de
  // gente que ainda nem é cliente.
  const auth = await requireAuth(req, res, { adminOnly: true });
  if (!auth) return;

  if (!(await aplicarRateLimit(req, res, "cadastros-pendentes", auth.userId))) return;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    console.error("[cadastros-pendentes] credenciais do Supabase ausentes.");
    res.status(503).json({ error: "Consulta indisponível no servidor." });
    return;
  }

  if (req.method === "GET") return listar(res);
  return reenviar(req, res);
}
