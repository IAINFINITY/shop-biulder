import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Confere se um codigo de produto existe no Proxis.
 *
 * Serve ao admin, na hora de salvar o produto: se o codigo nao tem cadastro no
 * ERP, o produto nao pode ficar ativo no catalogo. Sem essa checagem o problema
 * so aparecia la na frente, no pedido — e de um jeito ruim, porque o item sem
 * cadastro era descartado em silencio e o cliente recebia "pedido enviado" com
 * menos itens do que pediu.
 *
 * O filtro usa `item.ite_numero`, com o prefixo `item.`. Sem ele o ProManager
 * devolve vazio para qualquer codigo — e a busca passa a "nao achar" tudo.
 */

const PROXSIS_BASE_URL = (process.env.PROXSIS_BASE_URL || "").trim();
const PROXSIS_USER = process.env.PROXSIS_USER || "";
const PROXSIS_PASSWORD = process.env.PROXSIS_PASSWORD || "";
const PROXSIS_FILIAL = (process.env.PROXSIS_FILIAL || "5").trim();

function buildAuthHeader(): string {
  return "Basic " + Buffer.from(`${PROXSIS_USER.trim()}:${PROXSIS_PASSWORD.trim()}`).toString("base64");
}

async function buscarItem(code: string): Promise<{ ite_id: number; ite_descricao: string } | null> {
  const res = await fetch(`${PROXSIS_BASE_URL.replace(/\/$/, "")}/"ObterItens"`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: buildAuthHeader(),
      "x-proManager-filial": PROXSIS_FILIAL,
      "X-ProManager-Pagina-Inicio": "0",
      "X-ProManager-Pagina-Quant": "5",
      "X-ProManager-Busca-Filtro": `item.ite_numero = '${code.replace(/'/g, "")}'`,
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) throw new Error(`Proxis respondeu ${res.status}`);

  const payload = await res.json();
  const row = Array.isArray(payload) ? payload[0] : payload;
  const iteId = Number((row as Record<string, unknown> | null)?.ite_id);
  if (!Number.isFinite(iteId) || iteId <= 0) return null;

  return { ite_id: iteId, ite_descricao: String((row as Record<string, unknown>).ite_descricao ?? "").trim() };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!PROXSIS_BASE_URL || !PROXSIS_USER || !PROXSIS_PASSWORD) {
    return res.status(500).json({ error: "Integração com o Proxis não configurada." });
  }

  const code = String(
    (req.query?.code ?? (typeof req.body === "object" ? (req.body as { code?: unknown })?.code : "")) ?? "",
  ).trim();

  if (!code) return res.status(400).json({ error: "Informe o código do produto." });

  try {
    const item = await buscarItem(code);
    return res.status(200).json({
      code,
      found: item !== null,
      ite_id: item?.ite_id ?? null,
      description: item?.ite_descricao ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[proxis-item-check]", message);
    // Falha de rede nao pode virar "produto nao existe": isso barraria um
    // cadastro correto so porque o ERP estava fora do ar.
    return res.status(502).json({ error: message, found: null });
  }
}
