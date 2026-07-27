import type { VercelRequest, VercelResponse } from "@vercel/node";

const PROXSIS_BASE_URL = process.env.PROXSIS_BASE_URL || "";
const PROXSIS_USER = process.env.PROXSIS_USER || "";
const PROXSIS_PASSWORD = process.env.PROXSIS_PASSWORD || "";
const PROXSIS_FILIAL = (process.env.PROXSIS_FILIAL || "5").trim();
const configuredDefaultTprId = Number(process.env.PROXSIS_TPR_ID_DEFAULT);
const DEFAULT_PROXSIS_TPR_ID = Number.isFinite(configuredDefaultTprId) && configuredDefaultTprId > 0
  ? Math.trunc(configuredDefaultTprId)
  : 8729;

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
  const user = PROXSIS_USER.trim();
  const password = PROXSIS_PASSWORD.trim();
  return "Basic " + Buffer.from(`${user}:${password}`).toString("base64");
}

function baseHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: buildAuthHeader(),
    "x-proManager-filial": PROXSIS_FILIAL,
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

function cnpjFromRecord(record: Record<string, unknown>): string {
  const candidates = [
    record.pes_cpf_cnpj,
    record.cpf_cnpj,
    record.pes_cnpj,
    record.cnpj,
    record.documento,
  ];

  for (const value of candidates) {
    const digits = onlyDigits(String(value ?? ""));
    if (digits.length === 14) return digits;
  }

  return "";
}

async function buscarClientePorCnpj(cnpj: string): Promise<Record<string, unknown> | null> {
  const digits = onlyDigits(cnpj);
  const filters = [formatCnpj(cnpj), digits].filter((value, index, list) => value && list.indexOf(value) === index);
  const candidates: Record<string, unknown>[] = [];

  for (const filterValue of filters) {
    const result = await proxsisRequest("GET", "ObterParticipantes", {
      extraHeaders: {
        "X-ProManager-Pagina-Inicio": "0",
        "X-ProManager-Pagina-Quant": "10",
        "X-Promanager-Busca-Filtro": `pes_cpf_cnpj = '${filterValue}'`,
      },
    });

    const rows = Array.isArray(result) ? result : result ? [result as Record<string, unknown>] : [];
    for (const row of rows) {
      if (row && typeof row === "object") candidates.push(row as Record<string, unknown>);
    }
  }

  const match = candidates.find((item) => cnpjFromRecord(item) === digits);
  if (match) return match;

  if (candidates.length > 0) {
    console.log("[proxis-customer] Participantes recebidos sem match exato:", candidates.slice(0, 3).map((item) => ({
      pes_id: item.pes_id ?? null,
      pes_nome: item.pes_nome ?? null,
      pes_fantasia: item.pes_fantasia ?? null,
      pes_cpf_cnpj: item.pes_cpf_cnpj ?? null,
      cpf_cnpj: item.cpf_cnpj ?? null,
      pes_cnpj: item.pes_cnpj ?? null,
      cnpj: item.cnpj ?? null,
      documento: item.documento ?? null,
    })));
  }

  return null;
}

function resolveTprId(cliente: Record<string, unknown> | null): number | null {
  if (!cliente) return null;
  const tabelas = cliente?.tabelapreco as Array<{ tpr_id: number }> | undefined;
  const tprId = tabelas?.[0]?.tpr_id;
  return Number.isFinite(tprId) && Number(tprId) > 0 ? Math.trunc(Number(tprId)) : DEFAULT_PROXSIS_TPR_ID;
}

function firstRelationRow(cliente: Record<string, unknown> | null, relationName: string): Record<string, unknown> | null {
  if (!cliente) return null;
  const rows = cliente[relationName];
  if (!Array.isArray(rows)) return null;
  const row = rows.find((value) => value && typeof value === "object");
  return row ? row as Record<string, unknown> : null;
}

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

async function buscarUltimaConfiguracaoPedido(
  pesId: number,
  tprId: number | null,
): Promise<{ fil_id: number | null; oin_id: number; cpa_id: number | null; tti_id: number | null; por_id: number | null } | null> {
  const result = await proxsisRequest("GET", "ObterPedidos", {
    extraHeaders: {
      "X-ProManager-Pagina-Inicio": "0",
      "X-ProManager-Pagina-Quant": "20",
      "X-Promanager-Busca-Filtro": `pes_id_cli = ${pesId}`,
    },
  });
  const rows = Array.isArray(result) ? result : [result].filter(Boolean);
  const matching = rows.find((row) => (
    row
    && typeof row === "object"
    && positiveId((row as Record<string, unknown>).tpr_id) === tprId
  ));
  const row = matching ?? rows[0];
  if (!row || typeof row !== "object") return null;
  const order = row as Record<string, unknown>;
  const filId = positiveId(order.fil_id);
  const oinId = positiveId(order.oin_id);
  return oinId
    ? {
        fil_id: filId,
        oin_id: oinId,
        cpa_id: positiveId(order.cpa_id),
        tti_id: positiveId(order.tti_id),
        por_id: positiveId(order.por_id),
      }
    : null;
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
    const tpr = firstRelationRow(cliente, "tabelapreco");
    const paymentCondition = firstRelationRow(cliente, "condicaopagamento");
    const paymentMethod = firstRelationRow(cliente, "formapagamento");
    let previousOrderConfig: { fil_id: number | null; oin_id: number; cpa_id: number | null; tti_id: number | null; por_id: number | null } | null = null;

    if (found) {
      try {
        previousOrderConfig = await buscarUltimaConfiguracaoPedido(Math.trunc(pesId), tprId);
      } catch (error) {
        console.warn("[proxis-customer] Falha ao consultar configuracao de pedido anterior:", error);
      }
    }

    const isB2bTable = tprId === 8728 || tprId === 8729;
    const oinId = previousOrderConfig?.oin_id ?? (isB2bTable ? 47 : null);
    const operationSource = previousOrderConfig ? "customer_order" : isB2bTable ? "price_table_default" : null;
    const filId = previousOrderConfig?.fil_id ?? (found ? Number(PROXSIS_FILIAL) : null);
    const cpaId = positiveId(paymentCondition?.cpa_id) ?? previousOrderConfig?.cpa_id;
    const ttiId = positiveId(paymentMethod?.tti_id) ?? previousOrderConfig?.tti_id;
    const porId = previousOrderConfig?.por_id ?? (found ? 1 : null);

    console.log("[proxis-customer] Resultado:", {
      found,
      pes_id: found ? Math.trunc(pesId) : null,
      tpr_id: tprId,
      fil_id: filId,
      cpa_id: cpaId,
      tti_id: ttiId,
      oin_id: oinId,
      por_id: porId,
    });

    return res.status(200).json({
      found,
      pes_id: found ? Math.trunc(pesId) : null,
      tpr_id: tprId,
      tpr_description: typeof tpr?.tpr_descricao === "string" ? tpr.tpr_descricao : null,
      fil_id: filId,
      cpa_id: cpaId,
      cpa_description: typeof paymentCondition?.cpa_descricao === "string" ? paymentCondition.cpa_descricao : null,
      tti_id: ttiId,
      tti_description: typeof paymentMethod?.tti_descricao === "string" ? paymentMethod.tti_descricao : null,
      oin_id: oinId,
      por_id: porId,
      operation_source: operationSource,
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
