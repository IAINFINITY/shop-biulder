import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_auth.js";
import { aplicarRateLimit } from "./_rateLimit.js";

/**
 * Devolve uma conta à senha provisória padrão.
 *
 * ## Por que no servidor, e não uma chamada do painel
 *
 * O trabalho pesado está na função `resetar_senha_para_o_padrao`, que é
 * `security definer` sobre `auth.users` e só o service role executa. Se o painel
 * pudesse chamá-la direto, qualquer cliente logado trocaria a senha de qualquer
 * conta. Aqui o service role fica do lado de cá, atrás de `requireAuth`.
 *
 * ## Por que uma rota `/api/*`, e não uma função de borda
 *
 * O resto do CRUD de funcionário são funções de borda. Esta diverge de propósito:
 * `requireAuth` traz três coisas que a borda não tem — exigência de segundo fator
 * (§11), limite de frequência, e deploy junto com o front, sem passo separado.
 * Para uma operação de credencial, essas três valem mais que a simetria.
 *
 * ## O que a rota NÃO aceita
 *
 * Senha escolhida por quem chama. O corpo tem só `userId`; o valor vem sempre de
 * `clinic+b2b_config_seguranca`. Aceitar uma senha aqui transformaria isto em
 * "defina a senha de outra pessoa", que é operação diferente e mais perigosa.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

/** Formato de UUID. Barrar aqui evita mandar lixo para o banco. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  // GET so le o valor; POST troca a credencial de outra pessoa. Dai a diferenca
  // de exigencia: ler a senha provisoria e o que todo admin precisa para
  // repassar ao funcionario, e ela ja aparece na tela de cadastro hoje.
  // Aplica-la sobre uma conta existente e superadmin, igual ao resto do CRUD.
  const auth = await requireAuth(req, res, req.method === "GET" ? { adminOnly: true } : { superadminOnly: true });
  if (!auth) return;

  // Contadores separados por metodo, e nao um so. Com o teto compartilhado, o
  // painel gastaria as 20 chamadas/hora do reset apenas ABRINDO a tela de
  // funcionarios — e o proximo reset de verdade levaria 429.
  const rota = req.method === "GET" ? "reset-senha-leitura" : "reset-senha";
  if (!(await aplicarRateLimit(req, res, rota, auth.userId))) return;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[reset-senha] credenciais do Supabase ausentes.");
    res.status(503).json({ error: "Operação indisponível no servidor." });
    return;
  }

  if (req.method === "GET") {
    const leitura = await fetch(
      `${SUPABASE_URL}/rest/v1/${encodeURIComponent("clinic+b2b_config_seguranca")}` +
        "?chave=eq.senha_padrao_funcionario&select=valor",
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
    );

    if (!leitura.ok) {
      console.error("[reset-senha] não foi possível ler a senha padrão:", leitura.status);
      res.status(502).json({ error: "Não foi possível ler a senha padrão." });
      return;
    }

    const linhas = (await leitura.json().catch(() => null)) as { valor?: string }[] | null;
    const senha = Array.isArray(linhas) ? linhas[0]?.valor ?? "" : "";
    res.status(200).json({ senha });
    return;
  }

  const userId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
  if (!UUID.test(userId)) {
    res.status(400).json({ error: "Informe o usuário." });
    return;
  }

  // Resetar a própria senha por aqui deixaria o superadmin trancado do lado de
  // fora: a conta sai com senha provisória e troca obrigatória, e ele perderia a
  // sessão no mesmo movimento. Para a própria senha existe a tela da conta.
  if (userId === auth.userId) {
    res.status(400).json({
      error: "Não é possível resetar a própria senha por aqui.",
      detalhe: "Use 'Esqueceu a senha?' ou a troca de senha na sua conta.",
    });
    return;
  }

  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/rpc/resetar_senha_para_o_padrao`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ alvo: userId }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    console.error("[reset-senha] rpc recusou:", resposta.status, detalhe.slice(0, 300));
    res.status(502).json({ error: "Não foi possível resetar a senha agora." });
    return;
  }

  // A função devolve a senha padrão. O painel precisa dela para repassar ao
  // funcionário — é o mesmo valor que a tela de cadastro já mostra, e chega aqui
  // só depois de o chamador provar que é superadmin.
  const senha = (await resposta.json().catch(() => null)) as string | null;

  console.warn("[reset-senha] senha resetada:", { por: auth.userId, alvo: userId });
  res.status(200).json({ ok: true, senha: typeof senha === "string" ? senha : "" });
}
