import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  chaveDeRateLimit,
  decidir,
  decisaoNaFalha,
  politicaDaRota,
  type Decisao,
} from "../src/lib/rateLimit.js";

/**
 * O I/O do limite de uso. A regra esta em `src/lib/rateLimit.ts`.
 *
 * Fala com o Postgres por `fetch` na API REST, como `_auth.ts` — o SDK inteiro
 * dentro de uma funcao serverless custa partida a frio em toda invocacao.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

async function consumir(chave: string, janelaSegundos: number): Promise<
  { contagem: number; segundosNaJanela: number } | null
> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;

  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consumir_rate_limit`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_chave: chave, p_janela_segundos: janelaSegundos }),
  });

  if (!resposta.ok) {
    console.error(
      "[rate-limit] consumir_rate_limit falhou:",
      resposta.status,
      (await resposta.text().catch(() => "")).slice(0, 200),
    );
    return null;
  }

  const dados = (await resposta.json()) as
    | { contagem: number; segundos_na_janela: number }[]
    | null;
  const linha = Array.isArray(dados) ? dados[0] : null;
  if (!linha || typeof linha.contagem !== "number") return null;

  return { contagem: linha.contagem, segundosNaJanela: linha.segundos_na_janela ?? 0 };
}

/**
 * Aplica o limite da rota para uma conta. Devolve `true` quando pode seguir.
 *
 * Ja responde 429 quando barra, com `Retry-After` — a §21 pede o header e diz que
 * a resposta nao deve ser cacheada, dai o `Cache-Control: no-store` junto.
 *
 * Os headers `X-RateLimit-*` vao mesmo quando passa: sem eles, quem integra so
 * descobre o teto batendo nele.
 */
export async function aplicarRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  rota: string,
  userId: string,
): Promise<boolean> {
  const politica = politicaDaRota(rota);
  const chave = chaveDeRateLimit(rota, "conta", userId);

  let decisao: Decisao;
  try {
    const estado = await consumir(chave, politica.janelaSegundos);
    decisao = estado
      ? decidir(estado.contagem, politica, estado.segundosNaJanela)
      : decisaoNaFalha(politica);
    if (!estado) {
      console.warn(
        `[rate-limit] contador indisponivel para ${rota}; politica na falha: ${politica.naFalha}`,
      );
    }
  } catch (erro) {
    console.error("[rate-limit] erro ao consumir:", erro);
    decisao = decisaoNaFalha(politica);
  }

  res.setHeader("X-RateLimit-Limit", String(politica.limite));
  res.setHeader("X-RateLimit-Remaining", String(decisao.restante));

  if (decisao.permitido) return true;

  res.setHeader("Retry-After", String(decisao.retryAfter));
  res.setHeader("Cache-Control", "no-store");
  res.status(429).json({
    error: "Muitas requisições em pouco tempo. Aguarde alguns minutos e tente de novo.",
  });
  return false;
}
