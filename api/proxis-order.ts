import type { VercelRequest, VercelResponse } from "@vercel/node";

const PROXSIS_BASE_URL = process.env.PROXSIS_BASE_URL || "";
const PROXSIS_USER = process.env.PROXSIS_USER || "";
const PROXSIS_PASSWORD = process.env.PROXSIS_PASSWORD || "";
const PROXSIS_FILIAL = process.env.PROXSIS_FILIAL || "5";

/** Valores padrão observados em pedidos reais (ObterPedidos). Conferir IDs ao trocar filial. */
function proxisEnvId(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

/** Filial 5 (ObterPedidos): oin 48, cpa 3, tti 7, tpr 40 — conferir se mudar filial. */
const PROXSIS_OIN_ID = proxisEnvId("PROXSIS_OIN_ID", 48);
const PROXSIS_CPA_ID = proxisEnvId("PROXSIS_CPA_ID", 3);
const PROXSIS_TTI_ID = proxisEnvId("PROXSIS_TTI_ID", 7);
const PROXSIS_TPR_ID_DEFAULT = proxisEnvId("PROXSIS_TPR_ID_DEFAULT", 40);
/** Portador (aba Financeiro): 1 = Bradesco */
const PROXSIS_POR_ID = proxisEnvId("PROXSIS_POR_ID", 1);

interface OrderRequestBody {
  customer_name: string;
  customer_cnpj: string;
  customer_company: string;
  pes_id_ven?: number | string | null;
  representative_id?: number | string | null;
  items: Array<{
    product_code: string;
    quantity: number;
    unit_price: number;
    name: string;
  }>;
}

/** pes_id_ven = ID na tabela pessoa (vendedor). Rodízio entre os representantes configurados. */
function parseRepPesIdsFromEnv(): number[] {
  const raw = process.env.PROXIS_REP_PES_IDS?.trim();
  if (raw) {
    const ids = raw
      .split(",")
      .map((value) => Math.trunc(Number(value.trim())))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (ids.length > 0) return ids;
  }
  return [2871, 3216, 2880, 7798, 7057, 6437, 7318, 2365, 2370];
}

const REPRESENTATIVE_ROTATION = parseRepPesIdsFromEnv();
const REPRESENTATIVE_SET = new Set<number>(REPRESENTATIVE_ROTATION);
let representativeRotationIndex = 0;

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

/** DataSnap REST: endpoint entre aspas, ex. .../TSMApi/"ObterItens" */
function proxsisEndpoint(name: string): string {
  const clean = name.replace(/^"+|"+$/g, "");
  return `"${clean}"`;
}

async function proxsisRequest(
  method: string,
  endpointName: string,
  options?: { body?: unknown; extraHeaders?: Record<string, string> }
): Promise<unknown> {
  const url = `${PROXSIS_BASE_URL.replace(/\/$/, "")}/${proxsisEndpoint(endpointName)}`;
  const headers: Record<string, string> = { ...baseHeaders(), ...(options?.extraHeaders || {}) };

  const res = await fetch(url, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json.error || text;
    } catch {
      // Response body may be non-JSON; keep raw message.
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
      (item: Record<string, unknown>) => onlyDigits(String(item.pes_cpf_cnpj || "")) === digits
    );
    return (match || result[0] || null) as Record<string, unknown> | null;
  }

  return result as Record<string, unknown>;
}

async function criarCliente(nome: string, cnpj: string): Promise<Record<string, unknown>> {
  const payload = {
    pes_tipo_pessoa: "J",
    pes_nome: nome.toUpperCase(),
    pes_fantasia: nome.toUpperCase(),
    pes_cpf_cnpj: formatCnpj(cnpj),
    pes_tipo_cliente: true,
    endereco: [
      {
        pen_cep: "00000000",
        pen_endereco: "A DEFINIR",
        pen_num_endereco: "S/N",
        pen_bairro: "CENTRO",
        municipio: "A DEFINIR",
        estado: "SC",
        pen_ie: "ISENTO",
        pen_contribuinte: 2,
      },
    ],
  };

  const result = await proxsisRequest("POST", "SalvarParticipante", { body: payload });
  return result as Record<string, unknown>;
}

/** Busca cliente; se não existir, cria e busca de novo antes de montar o pedido. */
async function resolverCliente(
  cnpj: string,
  customerName: string,
  customerCompany: string
): Promise<{ pesId: number; cliente: Record<string, unknown> }> {
  let cliente = await buscarClientePorCnpj(cnpj);

  if (!cliente?.pes_id) {
    const nomeCliente = customerCompany || customerName;
    await criarCliente(nomeCliente, cnpj);
    cliente = await buscarClientePorCnpj(cnpj);
    if (!cliente?.pes_id) {
      throw new Error("Failed to create/find customer in Proxsis after SalvarParticipante");
    }
  }

  return { pesId: Number(cliente.pes_id), cliente };
}

function resolveTprId(cliente: Record<string, unknown>): number {
  const tabelas = cliente.tabelapreco as Array<{ tpr_id?: number }> | undefined;
  if (tabelas?.length && tabelas[0].tpr_id) {
    return tabelas[0].tpr_id;
  }
  return PROXSIS_TPR_ID_DEFAULT;
}

async function buscarProdutoPorNumero(numero: string): Promise<Record<string, unknown> | null> {
  const filtro = `item.ite_numero = '${numero}'`;

  const result = await proxsisRequest("GET", "ObterItens", {
    extraHeaders: {
      "X-ProManager-Pagina-Inicio": "0",
      "X-ProManager-Pagina-Quant": "5",
      "X-Promanager-Busca-Filtro": filtro,
    },
  });

  if (!result) return null;
  if (Array.isArray(result)) return result[0] || null;
  return result as Record<string, unknown>;
}

async function criarPedido(pedido: Record<string, unknown>): Promise<unknown> {
  return proxsisRequest("POST", "SalvarPedidoVenda", { body: pedido });
}

function parseRepresentativeId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.trunc(numeric);
}

function nextRepresentativeId(): number {
  const index = representativeRotationIndex % REPRESENTATIVE_ROTATION.length;
  const repId = REPRESENTATIVE_ROTATION[index];
  representativeRotationIndex = (representativeRotationIndex + 1) % REPRESENTATIVE_ROTATION.length;
  return repId;
}

function resolveRepresentativeId(body: OrderRequestBody): number {
  const explicitRepId = parseRepresentativeId(body.pes_id_ven ?? body.representative_id);
  if (explicitRepId && REPRESENTATIVE_SET.has(explicitRepId)) return explicitRepId;
  return nextRepresentativeId();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!PROXSIS_BASE_URL || !PROXSIS_USER || !PROXSIS_PASSWORD) {
    return res.status(500).json({ error: "Proxsis API not configured on server" });
  }

  const body = req.body as OrderRequestBody;

  if (!body.customer_cnpj || !body.customer_name || !body.items?.length) {
    return res.status(400).json({ error: "Missing required fields: customer_cnpj, customer_name, items" });
  }

  try {
    // 1. Busca cliente; se não existir, cria e busca de novo com dados completos
    const { pesId, cliente } = await resolverCliente(
      body.customer_cnpj,
      body.customer_name,
      body.customer_company
    );
    const tprId = resolveTprId(cliente);

    // 3. Resolve product IDs (ite_id) from product_code (ite_numero)
    const documentoItens: Array<{
      ite_id: number;
      dit_quantidade: number;
      dit_vlr_unitario: number;
      lotes: unknown[];
    }> = [];

    const failedProducts: string[] = [];

    for (const item of body.items) {
      if (!item.product_code) {
        failedProducts.push(item.name || "Unknown product");
        continue;
      }

      const produto = await buscarProdutoPorNumero(item.product_code);
      if (!produto || !produto.ite_id) {
        failedProducts.push(`${item.name} (code: ${item.product_code})`);
        continue;
      }

      documentoItens.push({
        ite_id: Number(produto.ite_id),
        dit_quantidade: item.quantity,
        dit_vlr_unitario: item.unit_price || 0,
        lotes: [],
      });
    }

    if (documentoItens.length === 0) {
      return res.status(400).json({
        error: "No valid products found in Proxsis",
        failed_products: failedProducts,
      });
    }

    // 4. Create the order
    const now = new Date();
    const docDtEmissao = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    const docPedWeb = `INFINITY-${Date.now().toString(36).toUpperCase()}`;

    const pedido = {
      doc_tipo: 2,
      oin_id: PROXSIS_OIN_ID,
      tpr_id: tprId,
      cpa_id: PROXSIS_CPA_ID,
      tti_id: PROXSIS_TTI_ID,
      por_id: PROXSIS_POR_ID,
      pes_id_cli: pesId,
      pes_id_ven: resolveRepresentativeId(body),
      doc_dt_emissao: docDtEmissao,
      doc_ped_web: docPedWeb,
      DocumentoItens: documentoItens,
    };

    const resultado = await criarPedido(pedido);

    return res.status(200).json({
      success: true,
      doc_ped_web: docPedWeb,
      pes_id: pesId,
      items_count: documentoItens.length,
      failed_products: failedProducts.length > 0 ? failedProducts : undefined,
      proxsis_response: resultado,
    });
  } catch (error) {
    console.error("Proxsis integration error:", error);
    return res.status(500).json({
      error: "Proxsis integration failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
