import type { VercelRequest, VercelResponse } from "@vercel/node";

const PROXSIS_BASE_URL = process.env.PROXSIS_BASE_URL || "";
const PROXSIS_USER = process.env.PROXSIS_USER || "";
const PROXSIS_PASSWORD = process.env.PROXSIS_PASSWORD || "";
const PROXSIS_FILIAL = process.env.PROXSIS_FILIAL || "5";
const DEFAULT_PROXSIS_TPR_ID = 8728;

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function formatCnpj(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return value.trim();
}

function buildAuthHeader(): string {
  return "Basic " + Buffer.from(`${PROXSIS_USER}:${PROXSIS_PASSWORD}`).toString("base64");
}

function baseHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: buildAuthHeader(),
    "x-promanager-filial": PROXSIS_FILIAL,
  };
}

function proxsisEndpoint(name: string): string {
  const clean = name.replace(/^"+|"+$/g, "");
  return `"${clean}"`;
}

async function proxsisRequest(
  method: string,
  endpointName: string,
  options: { extraHeaders: Record<string, string> },
): Promise<unknown> {
  const n8nProxy = (process.env.N8N_WEBHOOK_BASE_URL || "").trim();

  if (n8nProxy) {
    const proxyUrl = `${n8nProxy.replace(/\/$/, "")}/proxis-proxy`;
    const allHeaders: Record<string, string> = { ...baseHeaders(), ...(options.extraHeaders || {}) };

    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: endpointName,
        method,
        headers: allHeaders,
        body: null,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`n8n Proxy error (${res.status}): ${text}`);
    }

    const result = await res.json();

    if (result?.status && result.status >= 400) {
      const detail = result.body || result.error || "Unknown error";
      throw new Error(`Proxsis API error via n8n (${result.status}): ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
    }

    if (result.body === null || result.body === undefined || result.body === "") return null;
    return result.body;
  }

  const url = `${PROXSIS_BASE_URL.replace(/\/$/, "")}/${proxsisEndpoint(endpointName)}`;
  const headers: Record<string, string> = { ...baseHeaders(), ...(options.extraHeaders || {}) };

  const res = await fetch(url, { method, headers });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json.error || text;
    } catch {
      // Mantem o texto cru quando a API nao responde em JSON.
    }
    throw new Error(`Proxsis API error (${res.status}): ${detail}`);
  }

  const text = await res.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

async function buscarClientePorCnpj(cnpj: string): Promise<Record<string, unknown> | null> {
  const formatted = formatCnpj(cnpj);
  const filtro = `pes_cpf_cnpj = '${formatted}'`;

  const result = await proxsisRequest("GET", "ObterParticipantes", {
    extraHeaders: {
      "X-ProManager-Pagina-Inicio": "0",
      "X-ProManager-Pagina-Quant": "5",
      "X-Promanager-Busca-Filtro": filtro,
    },
  });

  if (!result) return null;

  if (Array.isArray(result)) {
    const digits = onlyDigits(cnpj);
    const match = result.find(
      (item: Record<string, unknown>) => onlyDigits(String(item.pes_cpf_cnpj || "")) === digits,
    );
    return (match || result[0] || null) as Record<string, unknown> | null;
  }

  return result as Record<string, unknown>;
}

function resolveTprId(cliente: Record<string, unknown> | null): number | null {
  if (!cliente) return null;
  const tabelas = cliente?.tabelapreco as Array<{ tpr_id: number }> | undefined;
  const tprId = tabelas?.[0]?.tpr_id;
  return Number.isFinite(tprId) && Number(tprId) > 0 ? Math.trunc(Number(tprId)) : DEFAULT_PROXSIS_TPR_ID;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!PROXSIS_BASE_URL || !PROXSIS_USER || !PROXSIS_PASSWORD) {
    return res.status(500).json({ error: "Proxsis API not configured on server" });
  }

  const rawCnpj = String((req.body as { cnpj: unknown } | null)?.cnpj ?? "");
  const cnpj = onlyDigits(rawCnpj);

  if (cnpj.length !== 14) {
    return res.status(400).json({ error: "CNPJ invalido" });
  }

  try {
    console.log("[proxis-customer] Buscando cliente CNPJ:", cnpj);
    const cliente = await buscarClientePorCnpj(cnpj);
    const pesId = Number(cliente?.pes_id);
    const found = !!cliente && Number.isFinite(pesId) && pesId > 0;
    const tprId = resolveTprId(cliente);

    console.log("[proxis-customer] Resultado:", { found, pes_id: found ? Math.trunc(pesId) : null, tpr_id: tprId });

    return res.status(200).json({
      found,
      pes_id: found ? Math.trunc(pesId) : null,
      tpr_id: tprId,
      customer_name: found ? String(cliente.pes_nome ?? "") : null,
      customer_company: found ? String(cliente.pes_fantasia ?? cliente.pes_nome ?? "") : null,
    });
  } catch (error) {
    console.error("[proxis-customer] Proxsis customer lookup error:", error);
    return res.status(500).json({
      error: "Proxsis customer lookup failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
