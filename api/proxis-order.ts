import type { VercelRequest, VercelResponse } from "@vercel/node";

const PROXSIS_BASE_URL = process.env.PROXSIS_BASE_URL || "";
const PROXSIS_USER = process.env.PROXSIS_USER || "";
const PROXSIS_PASSWORD = process.env.PROXSIS_PASSWORD || "";
const PROXSIS_FILIAL = process.env.PROXSIS_FILIAL || "5";

function proxisEnvId(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

const PROXSIS_OIN_ID = proxisEnvId("PROXSIS_OIN_ID", 48);
const PROXSIS_CPA_ID = proxisEnvId("PROXSIS_CPA_ID", 3);
const PROXSIS_TTI_ID = proxisEnvId("PROXSIS_TTI_ID", 7);
const PROXSIS_TPR_ID_DEFAULT = proxisEnvId("PROXSIS_TPR_ID_DEFAULT", 40);
const PROXSIS_POR_ID = proxisEnvId("PROXSIS_POR_ID", 1);
const PROXSIS_DEFAULT_MUN_ID = proxisEnvId("PROXSIS_DEFAULT_MUN_ID", 5555);
const PROXSIS_DEFAULT_CEP = (process.env.PROXSIS_DEFAULT_CEP ?? "").trim() || "89820000";
const PROXSIS_DEFAULT_EST_SIGLA = (process.env.PROXSIS_DEFAULT_EST_SIGLA ?? "").trim() || "SC";
const PROXSIS_DOC_MARCADOR = (process.env.PROXSIS_DOC_MARCADOR ?? "").trim() || "PEDIDO B2B";

interface CustomerAddressInput {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  ibge: string;
}

interface OrderRequestBody {
  customer_name: string;
  customer_cnpj: string;
  customer_company: string;
  address: CustomerAddressInput;
  pes_id_ven: number | string | null;
  representative_id: number | string | null;
  items: Array<{
    product_code: string;
    quantity: number;
    unit_price: number;
    name: string;
  }>;
}

function parseRepPesIdsFromEnv(): number[] {
  const raw = (process.env.PROXIS_REP_PES_IDS ?? "").trim();
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

function proxsisEndpoint(name: string): string {
  const clean = name.replace(/^"+|"+$/g, "");
  return `"${clean}"`;
}

async function proxsisRequest(
  method: string,
  endpointName: string,
  options: { body: unknown; extraHeaders: Record<string, string> }
): Promise<unknown> {
  const url = `${PROXSIS_BASE_URL.replace(/\/$/, "")}/${proxsisEndpoint(endpointName)}`;
  const headers: Record<string, string> = { ...baseHeaders(), ...(options.extraHeaders || {}) };

  const res = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
  try {
    const json = JSON.parse(text);
    detail = json.error || text;
  } catch {
    // Keep the raw response text when Proxis does not return JSON.
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
    body: null,
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

function buildEnderecoPadrao() {
  return {
    pen_tipo_endereco: 1,
    pen_cep: PROXSIS_DEFAULT_CEP,
    pen_endereco: "A DEFINIR",
    pen_num_endereco: "S/N",
    pen_bairro: "CENTRO",
    mun_id: PROXSIS_DEFAULT_MUN_ID,
    est_sigla: PROXSIS_DEFAULT_EST_SIGLA,
    pen_ie: "ISENTO",
    pen_contribuinte: 2,
  };
}

function normalizeAddressInput(address: CustomerAddressInput | null): CustomerAddressInput | null {
  if (!address) return null;
  const cep = onlyDigits(address.cep || "");
  const street = String(address.street || "").trim();
  const number = String(address.number || "").trim();
  const neighborhood = String(address.neighborhood || "").trim();
  const city = String(address.city || "").trim();
  const state = String(address.state || "").trim().toUpperCase();
  const ibge = onlyDigits(address.ibge || "");
  if (cep.length !== 8 || !street || !number || !neighborhood || !city || state.length !== 2 || !ibge) {
    return null;
  }
  return {
    cep,
    street,
    number,
    complement: String(address.complement || "").trim(),
    neighborhood,
    city,
    state,
    ibge,
  };
}

async function buscarMunIdPorIbge(ibge: string): Promise<number> {
  const ibgeDigits = onlyDigits(ibge);
  if (ibgeDigits.length < 7) return PROXSIS_DEFAULT_MUN_ID;

  const result = await proxsisRequest("GET", "ObterMunicipios", {
    body: null,
    extraHeaders: {
      "X-ProManager-Pagina-Inicio": "0",
      "X-ProManager-Pagina-Quant": "5",
      "X-Promanager-Busca-Filtro": `mun_cod_ibge = ${ibgeDigits}`,
    },
  });

  if (!result) return PROXSIS_DEFAULT_MUN_ID;
  const row = Array.isArray(result) ? result[0] : result;
  const munId = Number((row as Record<string, unknown>).mun_id);
  return Number.isFinite(munId) && munId > 0 ? munId : PROXSIS_DEFAULT_MUN_ID;
}

async function buildEnderecoProxis(address: CustomerAddressInput) {
  const munId = await buscarMunIdPorIbge(address.ibge);
  return {
    pen_tipo_endereco: 1,
    pen_cep: onlyDigits(address.cep),
    pen_endereco: address.street.toUpperCase(),
    pen_num_endereco: address.number || "S/N",
    pen_complemento: address.complement || null,
    pen_bairro: address.neighborhood.toUpperCase(),
    mun_id: munId,
    est_sigla: address.state.toUpperCase(),
    pen_ie: "ISENTO",
    pen_contribuinte: 2,
  };
}

async function salvarEnderecoCliente(
  cliente: Record<string, unknown>,
  endereco: Record<string, unknown>
): Promise<void> {
  const pesId = Number(cliente.pes_id);
  if (!pesId) return;

  await proxsisRequest("POST", "SalvarParticipante", {
    body: {
      pes_id: pesId,
      pes_tipo_pessoa: cliente.pes_tipo_pessoa || "J",
      pes_nome: cliente.pes_nome,
      pes_fantasia: cliente.pes_fantasia || cliente.pes_nome,
      pes_cpf_cnpj: cliente.pes_cpf_cnpj,
      pes_tipo_cliente: true,
      endereco: [endereco],
    },
    extraHeaders: {},
  });
}

function clienteTemEndereco(cliente: Record<string, unknown>): boolean {
  const enderecos = cliente.endereco as unknown[] | undefined;
  return Array.isArray(enderecos) && enderecos.length > 0;
}

async function garantirEnderecoCliente(
  cliente: Record<string, unknown>,
  address: CustomerAddressInput | null
): Promise<void> {
  const normalized = normalizeAddressInput(address);
  if (normalized) {
    const endereco = await buildEnderecoProxis(normalized);
    await salvarEnderecoCliente(cliente, endereco);
    return;
  }

  if (clienteTemEndereco(cliente)) return;
  await salvarEnderecoCliente(cliente, buildEnderecoPadrao());
}

async function criarCliente(
  nome: string,
  cnpj: string,
  address: CustomerAddressInput | null
): Promise<Record<string, unknown>> {
  const normalized = normalizeAddressInput(address);
  const endereco = normalized
    ? await buildEnderecoProxis(normalized)
    : buildEnderecoPadrao();

  const payload = {
    pes_tipo_pessoa: "J",
    pes_nome: nome.toUpperCase(),
    pes_fantasia: nome.toUpperCase(),
    pes_cpf_cnpj: formatCnpj(cnpj),
    pes_tipo_cliente: true,
    endereco: [endereco],
  };

  const result = await proxsisRequest("POST", "SalvarParticipante", { body: payload, extraHeaders: {} });
  return result as Record<string, unknown>;
}

async function buscarProdutoPorNumero(numero: string): Promise<Record<string, unknown> | null> {
  const filtro = `item.ite_numero = '${numero}'`;

  const result = await proxsisRequest("GET", "ObterItens", {
    body: null,
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
  return proxsisRequest("POST", "SalvarPedidoVenda", { body: pedido, extraHeaders: {} });
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

  if (!body.customer_cnpj || !body.customer_name || !body.items.length) {
    return res.status(400).json({ error: "Missing required fields: customer_cnpj, customer_name, items" });
  }

  try {
    let cliente = await buscarClientePorCnpj(body.customer_cnpj);
    let pesId: number;

    const normalizedAddress = normalizeAddressInput(body.address ?? null);

    if (cliente?.pes_id) {
      pesId = Number(cliente.pes_id);
    } else {
      const nomeCliente = body.customer_company || body.customer_name;
      const novoCliente = await criarCliente(nomeCliente, body.customer_cnpj, normalizedAddress);
      if (!novoCliente.pes_id) {
        return res.status(500).json({ error: "Failed to create customer in Proxsis" });
      }
      pesId = Number(novoCliente.pes_id);
      cliente = novoCliente;
    }

    if (cliente) await garantirEnderecoCliente(cliente, normalizedAddress);

    let tprId = PROXSIS_TPR_ID_DEFAULT;
    const tabelas = cliente.tabelapreco as Array<{ tpr_id: number }> | undefined;
    if (tabelas?.length && tabelas[0].tpr_id) {
      tprId = tabelas[0].tpr_id;
    }

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
      doc_marcador: PROXSIS_DOC_MARCADOR,
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
