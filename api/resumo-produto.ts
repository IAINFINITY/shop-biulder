import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_auth.js";
import { aplicarRateLimit } from "./_rateLimit.js";
import {
  construirPromptDeResumo,
  normalizarResumo,
  validarResumo,
} from "../src/lib/resumoDeProduto.js";

/**
 * Gera o resumo de um produto — so para o painel.
 *
 * `adminOnly`: a rota gasta credito da OpenAI a cada chamada. Aberta a qualquer
 * cliente logado, viraria torneira de custo para quem descobrisse o endereco.
 *
 * Fala com a OpenAI por `fetch` em vez do SDK, pela mesma razao que `_auth.ts`
 * fala com o Supabase assim: e uma chamada HTTP so, e o pacote inteiro dentro de
 * uma funcao serverless custa tempo de partida a frio em toda invocacao.
 *
 * O corpo enviado e deliberadamente minimo — `model` e `messages`. Cada
 * parametro extra (`temperature`, `max_tokens`, `response_format`) e um jeito de
 * a chamada quebrar quando a familia de modelo mudar, e nenhum deles e
 * necessario aqui: o formato de saida esta no prompt e a resposta e curta por
 * construcao.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODELO_PADRAO = "gpt-5.4-mini";
const TIMEOUT_PADRAO_MS = 60_000;
/**
 * Teto de descricao enviada.
 *
 * A maior do catalogo tem ~8 mil caracteres. O corte existe para uma descricao
 * colada errado — um catalogo inteiro num campo so — nao virar uma chamada de
 * centenas de milhares de tokens sem ninguem perceber.
 */
const MAX_DESCRICAO = 12_000;

type CorpoDaRequisicao = {
  name?: unknown;
  description?: unknown;
  type?: unknown;
  brand?: unknown;
};

function textoLimpo(valor: unknown, maximo: number): string {
  if (typeof valor !== "string") return "";
  return valor
    // A descricao e HTML rico no banco; o modelo nao ganha nada com as tags.
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximo);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const auth = await requireAuth(req, res, { adminOnly: true });
  if (!auth) return;

  // Limite de uso por conta (§21). Depois do guard de propósito: sem saber quem
  // é, não há dimensão melhor que IP — e a §21 diz que IP isolado não serve como
  // controle principal.
  if (!(await aplicarRateLimit(req, res, "resumo-produto", auth.userId))) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[resumo-produto] OPENAI_API_KEY ausente: rota indisponivel.");
    res.status(503).json({ error: "Geração de resumo indisponível no servidor." });
    return;
  }

  const body = (req.body ?? {}) as CorpoDaRequisicao;
  const name = textoLimpo(body.name, 200);
  const description = textoLimpo(body.description, MAX_DESCRICAO);

  if (!name || description.length < 80) {
    res.status(400).json({
      error: "Preencha o nome e uma descrição com pelo menos 80 caracteres antes de gerar o resumo.",
    });
    return;
  }

  const { sistema, usuario } = construirPromptDeResumo({
    name,
    description,
    type: textoLimpo(body.type, 80) || null,
    brand: textoLimpo(body.brand, 80) || null,
  });

  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_SECONDS) * 1000 || TIMEOUT_PADRAO_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resposta = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_RESUMO_MODEL || process.env.MODEL_NAME || MODELO_PADRAO,
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: usuario },
        ],
      }),
      signal: controller.signal,
    });

    if (!resposta.ok) {
      // O corpo do erro da OpenAI diz qual e o problema (modelo inexistente,
      // credito acabado, chave revogada). Sem ele no log, todo defeito vira
      // "nao deu certo" e alguem vai depurar no escuro.
      const detalhe = await resposta.text().catch(() => "");
      console.error("[resumo-produto] OpenAI respondeu", resposta.status, detalhe.slice(0, 500));
      res.status(502).json({ error: "A geração do resumo falhou. Tente de novo em instantes." });
      return;
    }

    const dados = (await resposta.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const bruto = dados.choices?.[0]?.message?.content ?? "";
    const itens = normalizarResumo(bruto);

    const validacao = validarResumo(itens);
    if (!validacao.ok) {
      console.warn("[resumo-produto] resumo recusado:", validacao.motivo);
      res.status(422).json({ error: validacao.motivo });
      return;
    }

    res.status(200).json({ itens });
  } catch (error) {
    const abortado = error instanceof Error && error.name === "AbortError";
    console.error("[resumo-produto] falha ao chamar a OpenAI:", error);
    res.status(abortado ? 504 : 502).json({
      error: abortado
        ? "A geração do resumo demorou demais. Tente de novo."
        : "A geração do resumo falhou. Tente de novo em instantes.",
    });
  } finally {
    clearTimeout(timer);
  }
}
