import { createHash } from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import { avaliarDispositivo } from "../src/lib/dispositivoConfiavel.js";

/**
 * O cookie de aparelho confiavel, compartilhado entre `_auth.ts` e a rota.
 *
 * Existe para que os dois lados leiam o **mesmo** cookie e apliquem a **mesma**
 * regra. Duplicar isso era o caminho curto para o front dispensar o desafio e o
 * servidor continuar recusando — a incoerencia que ja mordeu este projeto no
 * `MfaGate` orfao.
 */

/**
 * Dois nomes, e nao um afrouxamento.
 *
 * `__Host-` **exige** `Secure`, e o navegador descarta em silencio o cookie que
 * nao cumpre. Em `http://` local isso significa cookie que nunca existe: medido
 * em 08/08, a caixinha marcava, o login passava, e o proximo login pedia o
 * codigo de novo sem nenhum erro em lugar nenhum.
 *
 * Producao mantem a garantia estrita (o navegador recusa qualquer subdominio
 * tentando plantar este cookie); o dev local para de mentir sobre o
 * comportamento.
 */
const COOKIE_SEGURO = "__Host-clinic_dispositivo";
const COOKIE_LOCAL = "clinic_dispositivo";

export function ehHttps(req: VercelRequest): boolean {
  const encaminhado = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(encaminhado) ? encaminhado[0] : encaminhado;
  return (proto ?? "").split(",")[0].trim() === "https";
}

export function nomeDoCookie(req: VercelRequest): string {
  return ehHttps(req) ? COOKIE_SEGURO : COOKIE_LOCAL;
}

export function lerCookieDeDispositivo(req: VercelRequest): string | null {
  const bruto = req.headers.cookie ?? "";
  const alvo = nomeDoCookie(req);
  for (const parte of bruto.split(";")) {
    const [nome, ...resto] = parte.trim().split("=");
    if (nome === alvo) return resto.join("=") || null;
  }
  return null;
}

export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const TABELA_DISPOSITIVOS = "clinic+b2b_dispositivos_confiaveis";

function url(): string {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
}

/**
 * Este pedido vem de um aparelho confiavel deste usuario?
 *
 * ## Le, e NAO rotaciona — a diferenca importa
 *
 * A rotacao da §14 acontece uma vez por login, na rota `dispositivo-confiavel`.
 * Aqui, nao: esta funcao roda em **toda** chamada administrativa, e o painel
 * dispara varias em paralelo. Rotacionar aqui faria dois pedidos simultaneos
 * queimarem o mesmo token, e o segundo seria lido como replay — o sistema
 * revogaria os aparelhos da pessoa por ela ter aberto uma tela.
 *
 * Detectar replay exige um ponto unico e serializado de troca. Ler em paralelo e
 * seguro; trocar em paralelo nao e.
 *
 * ## Falha de leitura recusa
 *
 * Sem resposta do banco, devolve `false` e a rota cai na exigencia normal de
 * `aal2`. Nao saber se o aparelho e confiavel tem de valer o mesmo que ele nao
 * ser — o contrario transformaria instabilidade do banco em porta aberta.
 */
export async function dispositivoConfiavel(req: VercelRequest, userId: string): Promise<boolean> {
  const token = lerCookieDeDispositivo(req);
  if (!token) return false;

  const chave = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!chave || !url()) return false;

  try {
    const resposta = await fetch(
      `${url()}/rest/v1/${encodeURIComponent(TABELA_DISPOSITIVOS)}` +
        `?token_hash=eq.${hashDoToken(token)}&user_id=eq.${userId}&select=expira_em,revogado_em,rotacionado_em`,
      { headers: { apikey: chave, Authorization: `Bearer ${chave}` } },
    );
    if (!resposta.ok) return false;

    const linhas = (await resposta.json()) as Array<{
      expira_em: string;
      revogado_em: string | null;
      rotacionado_em: string | null;
    }>;
    const linha = linhas[0];
    if (!linha) return false;

    return avaliarDispositivo(
      {
        tokenHash: hashDoToken(token),
        expiraEm: linha.expira_em,
        revogadoEm: linha.revogado_em,
        rotacionadoEm: linha.rotacionado_em,
      },
      new Date(),
    ).valido;
  } catch (erro) {
    console.error("[dispositivo] falha ao consultar:", erro);
    return false;
  }
}
