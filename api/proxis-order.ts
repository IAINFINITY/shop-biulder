import type { VercelRequest, VercelResponse } from "@vercel/node";
import { canActForCnpj } from "../src/lib/apiAuth.js";
import { mapearComLimite } from "../src/lib/concorrencia.js";
import { escolherRepresentante } from "../src/lib/rodizioDeRepresentante.js";
import { mascararCnpj } from "../src/lib/pii.js";
import { requireAuth } from "./_auth.js";
import { aplicarRateLimit } from "./_rateLimit.js";
import { isServerPriceEnforced, resolveServerPrices } from "./_pricing.js";
import {
  diffPrices,
  isValidQuantity,
  normalizeProductCode,
  type PriceCheck,
} from "../src/lib/serverPricing.js";
import { safeItemNumber, safeNumericFilter, safeQuotedLiteral } from "../src/lib/proxisFilter.js";
import {
  isB2bProxisTprId,
  resolveConfiguredProxisTprId,
  resolveCustomerProxisTpr,
} from "../src/lib/proxisTpr.js";
import {
  PROXIS_SYNC_ERROR,
  PROXIS_SYNC_PENDING,
  PROXIS_SYNC_SENT,
  buildProxisDocPedWeb,
} from "../src/lib/proxisOrderStatus.js";
import {
  recordProxisOrderSync,
  resolveProxisSyncCredentials,
} from "../src/lib/proxisOrderStatusStore.js";

const PROXSIS_BASE_URL = (process.env.PROXSIS_BASE_URL || "").trim();
const PROXSIS_USER = process.env.PROXSIS_USER || "";
const PROXSIS_PASSWORD = process.env.PROXSIS_PASSWORD || "";
const PROXSIS_FILIAL = (process.env.PROXSIS_FILIAL || "5").trim();

function proxisEnvId(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

const PROXSIS_OIN_ID = proxisEnvId("PROXSIS_OIN_ID", 48);
const PROXSIS_CPA_ID = proxisEnvId("PROXSIS_CPA_ID", 3);
const PROXSIS_TTI_ID = proxisEnvId("PROXSIS_TTI_ID", 7);
const PROXSIS_TPR_ID_DEFAULT = resolveConfiguredProxisTprId(process.env.PROXSIS_TPR_ID_DEFAULT);
const PROXSIS_POR_ID = proxisEnvId("PROXSIS_POR_ID", 1);
const PROXSIS_DEFAULT_MUN_ID = proxisEnvId("PROXSIS_DEFAULT_MUN_ID", 5555);
const PROXSIS_DEFAULT_CEP = (process.env.PROXSIS_DEFAULT_CEP ?? "").trim() || "89820000";
const PROXSIS_DEFAULT_EST_SIGLA = (process.env.PROXSIS_DEFAULT_EST_SIGLA ?? "").trim() || "SC";
const PROXSIS_DOC_MARCADOR = (process.env.PROXSIS_DOC_MARCADOR ?? "").trim() || "PEDIDO B2B";

const SYNC_CREDENTIALS = resolveProxisSyncCredentials(process.env);

// Falhas de rede e 5xx do ProManager sao quase sempre passageiras; uma segunda
// tentativa poucos segundos depois resolve a maioria delas sem que o cliente
// perceba. Os limites sao baixos de proposito: o checkout esta esperando esta
// resposta, e o que nao resolver aqui cai na fila de pendentes do painel.
const TRANSIENT_RETRY_DELAYS_MS = [400, 1200];

/**
 * Quantos produtos buscar ao mesmo tempo no ProManager.
 *
 * Cinco e um meio-termo deliberado: corta o tempo de um carrinho grande sem
 * transformar o checkout numa rajada contra um ERP de terceiro. Subir isto sem
 * saber o limite do fornecedor troca timeout por recusa.
 */
const BUSCA_DE_PRODUTO_SIMULTANEA = 5;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isTransientFailure(error: unknown): boolean {
  if (error instanceof ProxisRequestError) return isTransientHttpStatus(error.status);
  // Sem status HTTP a falha foi de conexao (DNS, recusa, timeout): vale repetir.
  return error instanceof Error;
}

class ProxisRequestError extends Error {
  status: number;
  upstream: {
    endpoint: string;
    method: string;
    proxy_http_status: number;
    status: number;
    body: unknown;
    error: string | null;
    debug: Record<string, unknown> | null;
  };

  constructor(
    status: number,
    upstream: {
      endpoint: string;
      method: string;
      proxy_http_status: number;
      status: number;
      body: unknown;
      error: string | null;
      debug: Record<string, unknown> | null;
    },
    message: string
  ) {
    super(message);
    this.name = "ProxisRequestError";
    this.status = status;
    this.upstream = upstream;
  }
}

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
  /**
   * Chave de idempotencia do pedido (coluna orders.submission_key). Define o
   * doc_ped_web e identifica a linha onde o desfecho do envio e registrado.
   * Ausente em clientes antigos em cache: o envio segue sem essas garantias.
   */
  submission_key?: string | null;
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
  options: { body: unknown; extraHeaders: Record<string, string> }
): Promise<unknown> {
  // The proxy path is intentionally disabled while the direct Proxis route is in use.
  // eslint-disable-next-line prefer-const
  let n8nProxy = "";

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
        body: options.body ?? null,
      }),
    });

    const responseText = await res.text();
    let result: Record<string, unknown> | null = null;
    if (responseText.trim()) {
      try {
        const parsed = JSON.parse(responseText);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          result = parsed as Record<string, unknown>;
        }
      } catch {
        // Preserve non-JSON proxy responses below.
      }
    }

    const reportedStatus = Number(result?.status);
    const upstreamStatus = Number.isFinite(reportedStatus) && reportedStatus >= 100
      ? Math.trunc(reportedStatus)
      : res.status;
    const resultDebug = result?.debug && typeof result.debug === "object" && !Array.isArray(result.debug)
      ? result.debug as Record<string, unknown>
      : null;

    if (!res.ok || upstreamStatus >= 400) {
      const upstreamBody = (result?.body ?? responseText) || null;
      const proxyError = typeof result?.error === "string" ? result.error : null;
      const detail = upstreamBody || proxyError || `Proxy returned HTTP ${res.status}`;
      throw new ProxisRequestError(
        upstreamStatus,
        {
          endpoint: endpointName,
          method,
          proxy_http_status: res.status,
          status: upstreamStatus,
          body: upstreamBody,
          error: proxyError,
          debug: resultDebug,
        },
        `Proxsis API error via n8n (${upstreamStatus}): ${typeof detail === "string" ? detail : JSON.stringify(detail)}`
      );
    }

    if (!result) return responseText.trim() ? responseText : null;
    if (result.body === null || result.body === undefined || result.body === "") return null;
    return result.body;
  }

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
    throw new ProxisRequestError(
      res.status,
      {
        endpoint: endpointName,
        method,
        proxy_http_status: res.status,
        status: res.status,
        body: text || null,
        error: null,
        debug: null,
      },
      `Proxsis API error (${res.status}): ${detail}`,
    );
  }

  const text = await res.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

/**
 * Repete leituras que falharam por motivo passageiro.
 *
 * Restrito a GET de proposito: sao as unicas chamadas seguras de repetir as
 * cegas. Escritas como SalvarParticipante e SalvarPedidoVenda podem ter sido
 * aplicadas mesmo quando a resposta se perde, entao a repeticao delas passa pela
 * verificacao de existencia em criarPedidoIdempotente.
 */
async function proxsisGetComRetry(
  endpointName: string,
  options: { body: unknown; extraHeaders: Record<string, string> },
): Promise<unknown> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      console.warn(
        `[proxis-order] Repetindo ${endpointName} (tentativa ${attempt + 1}) apos falha passageira.`,
      );
      await delay(TRANSIENT_RETRY_DELAYS_MS[attempt - 1]);
    }

    try {
      return await proxsisRequest("GET", endpointName, options);
    } catch (error) {
      lastError = error;
      if (!isTransientFailure(error)) throw error;
    }
  }

  throw lastError;
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

function positiveId(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null;
}

function firstRelationRow(cliente: Record<string, unknown> | null, relationName: string): Record<string, unknown> | null {
  if (!cliente) return null;
  const rows = cliente[relationName];
  if (!Array.isArray(rows)) return null;
  const row = rows.find((value) => value && typeof value === "object");
  return row ? row as Record<string, unknown> : null;
}

async function buscarUltimaConfiguracaoPedido(
  pesId: number,
  tprId: number | null,
): Promise<{ fil_id: number | null; oin_id: number; cpa_id: number | null; tti_id: number | null; por_id: number | null } | null> {
  const safePesId = safeNumericFilter(pesId);
  if (!safePesId) return null;

  // Sem retry de proposito: a configuracao anterior e opcional (o chamador
  // trata a falha) e nao vale gastar o orcamento de tempo do checkout com ela.
  const result = await proxsisRequest("GET", "ObterPedidos", {
    body: null,
    extraHeaders: {
      "X-ProManager-Pagina-Inicio": "0",
      "X-ProManager-Pagina-Quant": "20",
      "X-ProManager-Busca-Filtro": `pes_id_cli = ${safePesId}`,
    },
  });

  const rows = Array.isArray(result) ? result : result ? [result as Record<string, unknown>] : [];
  const matching = rows.find(
    (row) => row && typeof row === "object" && positiveId((row as Record<string, unknown>).tpr_id) === tprId,
  );
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

async function buscarClientePorCnpj(cnpj: string): Promise<Record<string, unknown> | null> {
  const digits = onlyDigits(cnpj);
  const filters = [formatCnpj(cnpj), digits].filter((value, index, list) => value && list.indexOf(value) === index);
  const candidates: Record<string, unknown>[] = [];

  for (const filterValue of filters) {
    const safeFilterValue = safeQuotedLiteral(filterValue);
    if (!safeFilterValue) continue;

    const result = await proxsisGetComRetry("ObterParticipantes", {
      body: null,
      extraHeaders: {
        "X-ProManager-Pagina-Inicio": "0",
        "X-ProManager-Pagina-Quant": "10",
        "X-ProManager-Busca-Filtro": `pes_cpf_cnpj = '${safeFilterValue}'`,
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
    console.log("[proxis-order] Participantes recebidos sem match exato:", candidates.slice(0, 3).map((item) => ({
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

  const safeIbge = safeNumericFilter(ibgeDigits);
  if (!safeIbge) return PROXSIS_DEFAULT_MUN_ID;

  const result = await proxsisGetComRetry("ObterMunicipios", {
    body: null,
    extraHeaders: {
      "X-ProManager-Pagina-Inicio": "0",
      "X-ProManager-Pagina-Quant": "5",
      "X-ProManager-Busca-Filtro": `mun_cod_ibge = ${safeIbge}`,
    },
  });

  if (!result) return PROXSIS_DEFAULT_MUN_ID;
  const row = Array.isArray(result) ? result[0] : result;
  const munId = Number((row as Record<string, unknown>).mun_id);
  return Number.isFinite(munId) && munId > 0 ? munId : PROXSIS_DEFAULT_MUN_ID;
}

async function buildEnderecoProxis(address: CustomerAddressInput) {
  const munId = await buscarMunIdPorIbge(address.ibge);
  const endereco: Record<string, unknown> = {
    pen_tipo_endereco: 1,
    pen_cep: onlyDigits(address.cep),
    pen_endereco: address.street.toUpperCase(),
    pen_num_endereco: address.number || "S/N",
    pen_bairro: address.neighborhood.toUpperCase(),
    mun_id: munId,
    est_sigla: address.state.toUpperCase(),
    pen_ie: "ISENTO",
    pen_contribuinte: 2,
  };

  const complement = String(address.complement || "").trim();
  if (complement) {
    endereco.pen_complemento = complement;
  }

  return endereco;
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
  address: CustomerAddressInput
): Promise<void> {
  if (clienteTemEndereco(cliente)) return;

  const endereco = await buildEnderecoProxis(address);
  await salvarEnderecoCliente(cliente, endereco);
}

async function criarCliente(
  nome: string,
  cnpj: string,
  address: CustomerAddressInput
): Promise<Record<string, unknown>> {
  const endereco = await buildEnderecoProxis(address);

  const payload = {
    pes_tipo_pessoa: "J",
    pes_nome: nome.toUpperCase(),
    pes_cpf_cnpj: formatCnpj(cnpj),
    endereco: [endereco],
  };

  const result = await proxsisRequest("POST", "SalvarParticipante", { body: payload, extraHeaders: {} });

  const created = result as Record<string, unknown>;
  const createdPesId = parsePesId(created.pes_id);
  if (createdPesId) {
    await salvarEnderecoCliente({ pes_id: createdPesId }, endereco);
    return { ...created, pes_id: createdPesId };
  }

  return result as Record<string, unknown>;
}

async function buscarProdutoPorNumero(numero: string): Promise<Record<string, unknown> | null> {
  const safeNumero = safeItemNumber(numero);
  if (!safeNumero) {
    console.warn("[proxis-order] Codigo de produto recusado pela sanitizacao do filtro");
    return null;
  }

  const filtro = `item.ite_numero = '${safeNumero}'`;

  const result = await proxsisGetComRetry("ObterItens", {
    body: null,
    extraHeaders: {
      "X-ProManager-Pagina-Inicio": "0",
      "X-ProManager-Pagina-Quant": "5",
      "X-ProManager-Busca-Filtro": filtro,
    },
  });

  if (!result) return null;
  if (Array.isArray(result)) return result[0] || null;
  return result as Record<string, unknown>;
}

function firstLinkedId(
  cliente: Record<string, unknown>,
  relationName: string,
  idField: string
): number | null {
  const rows = cliente[relationName];
  if (!Array.isArray(rows)) return null;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const id = parsePesId((row as Record<string, unknown>)[idField]);
    if (id) return id;
  }

  return null;
}

async function criarPedido(pedido: Record<string, unknown>): Promise<unknown> {
  return proxsisRequest("POST", "SalvarPedidoVenda", { body: pedido, extraHeaders: {} });
}

/**
 * Procura no ERP um pedido ja gravado com este doc_ped_web.
 *
 * Best effort: se a consulta falhar devolve null, e o fluxo segue como se o
 * pedido nao existisse. O filtro do ProManager nem sempre e exato (o mesmo vale
 * para a busca de participantes), entao o valor e conferido na resposta.
 */
async function buscarPedidoPorDocPedWeb(docPedWeb: string): Promise<Record<string, unknown> | null> {
  try {
    const result = await proxsisGetComRetry("ObterPedidos", {
      body: null,
      extraHeaders: {
        "X-ProManager-Pagina-Inicio": "0",
        "X-ProManager-Pagina-Quant": "5",
        "X-ProManager-Busca-Filtro": `doc_ped_web = '${docPedWeb}'`,
      },
    });

    const rows = Array.isArray(result) ? result : result ? [result as Record<string, unknown>] : [];
    const alvo = docPedWeb.trim().toUpperCase();
    const match = rows.find((row) => {
      if (!row || typeof row !== "object") return false;
      const value = String((row as Record<string, unknown>).doc_ped_web ?? "").trim().toUpperCase();
      return value === alvo;
    });

    return (match as Record<string, unknown>) ?? null;
  } catch (error) {
    console.warn("[proxis-order] Nao foi possivel consultar pedido por doc_ped_web:", error);
    return null;
  }
}

/**
 * Grava o pedido no ERP sem risco de duplicar.
 *
 * O `doc_ped_web` e derivado do submission_key do pedido, entao e o mesmo em
 * toda tentativa. Isso permite tres protecoes:
 *  1. antes de gravar, verifica se o documento ja existe (caso do reenvio pelo
 *     painel de um pedido que na verdade tinha chegado);
 *  2. se a gravacao falhar, verifica de novo — um POST pode ter sido aplicado
 *     mesmo quando a resposta se perde no caminho;
 *  3. so entao repete, e apenas para falhas passageiras.
 */
async function criarPedidoIdempotente(
  pedido: Record<string, unknown>,
  docPedWeb: string,
  podeVerificarDuplicidade: boolean,
): Promise<{ resultado: unknown; jaExistia: boolean }> {
  if (podeVerificarDuplicidade) {
    const existente = await buscarPedidoPorDocPedWeb(docPedWeb);
    if (existente) {
      console.log("[proxis-order] Pedido ja existe no ERP, envio ignorado:", docPedWeb);
      return { resultado: existente, jaExistia: true };
    }
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await delay(TRANSIENT_RETRY_DELAYS_MS[attempt - 1]);

    try {
      return { resultado: await criarPedido(pedido), jaExistia: false };
    } catch (error) {
      lastError = error;

      if (podeVerificarDuplicidade) {
        const aposFalha = await buscarPedidoPorDocPedWeb(docPedWeb);
        if (aposFalha) {
          console.warn(
            "[proxis-order] SalvarPedidoVenda falhou, mas o pedido consta no ERP:",
            docPedWeb,
          );
          return { resultado: aposFalha, jaExistia: true };
        }
      }

      // Sem confirmacao de que chegou, repetir so e seguro quando o documento
      // pode ser verificado; caso contrario a repeticao poderia duplicar.
      if (!podeVerificarDuplicidade || !isTransientFailure(error)) throw error;

      console.warn(
        `[proxis-order] Repetindo SalvarPedidoVenda (tentativa ${attempt + 2}) apos falha passageira.`,
      );
    }
  }

  throw lastError;
}

function parseRepresentativeId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.trunc(numeric);
}

function parsePesId(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.trunc(numeric);
}

/**
 * A chave que decide o representante.
 *
 * `submission_key` primeiro, porque muda a cada pedido — e o que espalha entre
 * pedidos, que era a intencao do rodizio original. Sem ela (cliente antigo em
 * cache), o CNPJ: espalha entre clientes, mas o mesmo cliente passa a cair
 * sempre no mesmo representante.
 */
function representativeRotationKey(body: OrderRequestBody): string {
  return String(body.submission_key ?? "").trim() || onlyDigits(String(body.customer_cnpj ?? ""));
}

function resolveRepresentativeId(body: OrderRequestBody): number {
  const escolhido = escolherRepresentante(
    REPRESENTATIVE_ROTATION,
    representativeRotationKey(body),
    parseRepresentativeId(body.pes_id_ven ?? body.representative_id),
  );
  // A lista nunca fica vazia — `parseRepPesIdsFromEnv` tem padrao embutido —
  // mas o tipo permite, e cair aqui em silencio mandaria o pedido sem vendedor.
  if (escolhido === null) {
    throw new Error("Nenhum representante configurado (PROXIS_REP_PES_IDS).");
  }
  return escolhido;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  // Limite de uso por conta (§21). Depois do guard de propósito: sem saber quem
  // é, não há dimensão melhor que IP — e a §21 diz que IP isolado não serve como
  // controle principal.
  if (!(await aplicarRateLimit(req, res, "proxis-order", auth.userId))) return;

  const body = (req.body ?? {}) as OrderRequestBody;

  // O doc_ped_web sai do submission_key do pedido, entao e identico em toda
  // tentativa e permite reconhecer um envio que ja chegou ao ERP. Sem a chave
  // (cliente antigo em cache) volta o formato por timestamp: funciona, mas sem
  // protecao contra duplicidade e sem registro de status.
  const submissionKey = typeof body.submission_key === "string" ? body.submission_key.trim() : null;
  const docPedWebIdempotente = buildProxisDocPedWeb(submissionKey);
  const podeVerificarDuplicidade = docPedWebIdempotente !== null;
  const docPedWeb = docPedWebIdempotente ?? `INFINITY-${Date.now().toString(36).toUpperCase()}`;

  if (!podeVerificarDuplicidade) {
    console.warn("[proxis-order] Envio sem submission_key: sem protecao contra duplicidade no ERP.");
  }

  const registrarDesfecho = (status: typeof PROXIS_SYNC_SENT | typeof PROXIS_SYNC_PENDING | typeof PROXIS_SYNC_ERROR, error?: string | null) =>
    recordProxisOrderSync(SYNC_CREDENTIALS, {
      submissionKey,
      status,
      error: error ?? null,
      docPedWeb: podeVerificarDuplicidade ? docPedWeb : null,
    });

  if (!PROXSIS_BASE_URL || !PROXSIS_USER || !PROXSIS_PASSWORD) {
    await registrarDesfecho(PROXIS_SYNC_PENDING, "Proxsis API not configured on server");
    return res.status(500).json({ error: "Proxsis API not configured on server" });
  }

  console.log("[proxis-order] POST recebido", {
    customer_cnpj: body.customer_cnpj,
    customer_name: body.customer_name,
    items_count: body.items?.length,
    doc_ped_web: docPedWeb,
  });

  if (!body.customer_cnpj || !body.customer_name || !body.items?.length) {
    const detail = "Missing required fields: customer_cnpj, customer_name, items";
    await registrarDesfecho(PROXIS_SYNC_ERROR, detail);
    return res.status(400).json({ error: detail });
  }

  const customerCnpjDigits = onlyDigits(body.customer_cnpj);
  if (customerCnpjDigits.length !== 14) {
    await registrarDesfecho(PROXIS_SYNC_ERROR, "CNPJ inválido: o fluxo B2B só aceita compras com CNPJ cadastrado.");
    return res.status(400).json({
      error: "CNPJ obrigatório para finalizar o pedido",
      detail: "O fluxo B2B só aceita compras com CNPJ cadastrado.",
    });
  }

  // Cliente só lança pedido no próprio CNPJ (ou no da empresa vinculada).
  // Admin segue livre: é ele quem reenvia pedido de terceiro pelo painel.
  if (!canActForCnpj(auth, customerCnpjDigits)) {
    console.warn("[proxis-order] CNPJ fora do escopo do usuário", { user_id: auth.userId });
    return res.status(403).json({
      error: "CNPJ não corresponde ao cadastro da conta",
      detail: "Só é possível enviar pedidos para o CNPJ vinculado ao seu cadastro.",
    });
  }

  const normalizedAddress = normalizeAddressInput(body.address ?? null);
  if (!normalizedAddress) {
    const detail = "Endereço incompleto: preencha CEP, rua, número, bairro, cidade, UF e IBGE.";
    await registrarDesfecho(PROXIS_SYNC_ERROR, detail);
    return res.status(400).json({
      error: "Endereço obrigatório para finalizar o pedido",
      detail: "Preencha CEP, rua, número, bairro, cidade, UF e IBGE antes de enviar ao Proxsys.",
    });
  }

  const diagnostic: {
    customer_cnpj: string;
    items_attempted: number;
    items_resolved: number;
    pes_id: number | null;
    tpr_id: number | null;
    customer_tpr_id: number | null;
    fil_id: number | null;
    pes_id_ven: number | null;
    oin_id: number | null;
    cpa_id: number | null;
    tti_id: number | null;
    por_id: number | null;
    operation_source: string | null;
  } = {
    customer_cnpj: customerCnpjDigits,
    items_attempted: body.items.length,
    items_resolved: 0,
    pes_id: null,
    tpr_id: null,
    customer_tpr_id: null,
    fil_id: null,
    pes_id_ven: null,
    oin_id: null,
    cpa_id: null,
    tti_id: null,
    por_id: null,
    operation_source: null,
  };

  try {
    console.log("[proxis-order] Buscando cliente por CNPJ:", mascararCnpj(body.customer_cnpj));
    let cliente = await buscarClientePorCnpj(body.customer_cnpj);
    console.log("[proxis-order] Resultado da busca de cliente:", cliente ? "encontrado" : "nao encontrado", cliente);
    let pesId: number | null = null;
    let selectedTprId = PROXSIS_TPR_ID_DEFAULT;
    let customerTableIds: number[] = [];

    if (cliente?.pes_id) {
      const existingPesId = parsePesId(cliente.pes_id);
      if (!existingPesId) {
        console.log("[proxis-order] Cliente encontrado mas pes_id invalido, refazendo busca");
        cliente = await buscarClientePorCnpj(body.customer_cnpj);
      } else {
        pesId = existingPesId;
        console.log("[proxis-order] Cliente existente encontrado, pes_id:", pesId);
      }
    } else {
      const nomeCliente = body.customer_company || body.customer_name;
      console.log("[proxis-order] Cliente nao encontrado, criando novo:", nomeCliente);
      const novoCliente = await criarCliente(nomeCliente, body.customer_cnpj, normalizedAddress);
      const novoPesId = parsePesId(novoCliente.pes_id);
      if (novoPesId) {
        pesId = novoPesId;
        cliente = novoCliente;
        console.log("[proxis-order] Cliente criado com sucesso, pes_id:", pesId);
      } else {
        console.log("[proxis-order] Criacao retornou sem pes_id, tentando buscar novamente");
        cliente = await buscarClientePorCnpj(body.customer_cnpj);
        const clientePesId = parsePesId(cliente?.pes_id);
        if (!clientePesId) {
          const detail = "Proxsis returned a create response without pes_id and the follow-up lookup also failed.";
          await registrarDesfecho(PROXIS_SYNC_PENDING, `Falha ao criar cliente no Proxis: ${detail}`);
          return res.status(500).json({
            error: "Failed to create customer in Proxsis",
            detail,
          });
        }
        pesId = clientePesId;
      }
    }

    if (!pesId) {
      const detail = "Proxsis customer lookup did not return a valid pes_id.";
      await registrarDesfecho(PROXIS_SYNC_PENDING, `Falha ao identificar cliente no Proxis: ${detail}`);
      return res.status(500).json({
        error: "Failed to resolve customer in Proxsis",
        detail,
      });
    }

    if (!cliente) {
      const detail = "Proxsis customer lookup did not return customer data.";
      await registrarDesfecho(PROXIS_SYNC_PENDING, `Falha ao identificar cliente no Proxis: ${detail}`);
      return res.status(500).json({
        error: "Failed to resolve customer in Proxsis",
        detail,
      });
    }

    diagnostic.pes_id = pesId;

    console.log("[proxis-order] Garantindo endereço do cliente");
    await garantirEnderecoCliente(cliente, normalizedAddress);

    const resolvedCustomerTpr = resolveCustomerProxisTpr(cliente.tabelapreco);
    customerTableIds = resolvedCustomerTpr.customerTableIds;
    selectedTprId = customerTableIds.length > 0
      ? resolvedCustomerTpr.tprId
      : PROXSIS_TPR_ID_DEFAULT;
    diagnostic.customer_tpr_id = selectedTprId;
    diagnostic.tpr_id = selectedTprId;

    const paymentCondition = firstRelationRow(cliente, "condicaopagamento");
    const paymentMethod = firstRelationRow(cliente, "formapagamento");

    let previousOrderConfig: { fil_id: number | null; oin_id: number; cpa_id: number | null; tti_id: number | null; por_id: number | null } | null = null;
    if (pesId) {
      try {
        previousOrderConfig = await buscarUltimaConfiguracaoPedido(pesId, selectedTprId);
      } catch (error) {
        console.warn("[proxis-order] Falha ao consultar configuracao de pedido anterior:", error);
      }
    }

    const orderConfig = {
      fil_id: previousOrderConfig?.fil_id ?? Number(PROXSIS_FILIAL),
      oin_id: previousOrderConfig?.oin_id ?? (isB2bProxisTprId(selectedTprId) ? 47 : PROXSIS_OIN_ID),
      cpa_id: positiveId(paymentCondition?.cpa_id) ?? previousOrderConfig?.cpa_id ?? PROXSIS_CPA_ID,
      tti_id: positiveId(paymentMethod?.tti_id) ?? previousOrderConfig?.tti_id ?? PROXSIS_TTI_ID,
      por_id: previousOrderConfig?.por_id ?? PROXSIS_POR_ID,
    };

    diagnostic.oin_id = orderConfig.oin_id;
    diagnostic.cpa_id = orderConfig.cpa_id;
    diagnostic.tti_id = orderConfig.tti_id;
    diagnostic.por_id = orderConfig.por_id;
    diagnostic.fil_id = orderConfig.fil_id;
    diagnostic.operation_source = previousOrderConfig ? "customer_order" : "b2b_default";

    console.log("[proxis-order] Tabela selecionada:", {
      selectedTprId,
      orderTprId: selectedTprId,
      customerTableIds,
      pesId,
      orderConfig,
    });

    const documentoItens: Array<{
      ite_id: number;
      dit_quantidade: number;
      dit_vlr_unitario: number;
      lotes: unknown[];
    }> = [];

    const failedProducts: string[] = [];

    // O preco do corpo da requisicao foi calculado pelo navegador. Refaz a conta
    // a partir do banco; a flag decide se o resultado ja vale no pedido.
    const enforceServerPrice = isServerPriceEnforced();
    const priceChecks: PriceCheck[] = [];
    let serverPrices = new Map<string, number>();

    try {
      serverPrices = await resolveServerPrices(body.items.map((item) => item.product_code), auth);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error("[proxis-order] Falha ao resolver precos no servidor:", detail);
      if (enforceServerPrice) {
        await registrarDesfecho(PROXIS_SYNC_ERROR, `Falha ao validar os preços do pedido: ${detail}`);
        return res.status(500).json({ error: "Não foi possível validar os preços do pedido", detail });
      }
    }

    console.log("[proxis-order] Buscando produtos no Proxis, total de itens:", body.items.length);

    // A busca de cada item e uma ida ao ERP. Em serie, um carrinho de 20 itens
    // eram 20 idas enfileiradas com o checkout esperando — o caminho mais curto
    // para estourar o tempo da funcao. O teto e baixo de proposito: o ProManager
    // e servico de terceiro, e trocar "lento" por "recusado por excesso" nao e
    // ganho. A ordem da entrada e preservada (ver `mapearComLimite`), entao o
    // laco abaixo continua igual — so nao espera mais.
    const produtosPorItem = await mapearComLimite(
      body.items,
      BUSCA_DE_PRODUTO_SIMULTANEA,
      async (item) => {
        if (!item.product_code || !isValidQuantity(item.quantity)) return null;
        console.log("[proxis-order] Buscando produto:", item.product_code, item.name);
        return buscarProdutoPorNumero(item.product_code);
      },
    );

    for (const [indice, item] of body.items.entries()) {
      if (!item.product_code) {
        failedProducts.push(item.name || "Unknown product");
        continue;
      }

      if (!isValidQuantity(item.quantity)) {
        failedProducts.push(`${item.name} (quantidade inválida: ${item.quantity})`);
        continue;
      }

      const produto = produtosPorItem[indice];
      if (!produto || !produto.ite_id) {
        console.log("[proxis-order] Produto NAO encontrado:", item.product_code, item.name);
        failedProducts.push(`${item.name} (code: ${item.product_code})`);
        continue;
      }

      const clientPrice = Number(item.unit_price) || 0;
      const serverPrice = serverPrices.get(normalizeProductCode(item.product_code)) ?? null;
      priceChecks.push({
        code: normalizeProductCode(item.product_code),
        name: item.name,
        client_price: clientPrice,
        server_price: serverPrice,
      });

      let unitPrice = clientPrice;
      if (enforceServerPrice) {
        if (serverPrice === null) {
          failedProducts.push(`${item.name} (sem preço válido no catálogo: ${item.product_code})`);
          continue;
        }
        unitPrice = serverPrice;
      }

      console.log("[proxis-order] Produto encontrado:", item.product_code, "ite_id:", produto.ite_id);
      documentoItens.push({
        ite_id: Number(produto.ite_id),
        dit_quantidade: Number(item.quantity),
        dit_vlr_unitario: unitPrice,
        lotes: [],
      });
    }

    const priceDivergences = diffPrices(priceChecks);
    if (priceDivergences.length > 0) {
      console.warn("[proxis-order] Preço do navegador diferente do servidor:", {
        user_id: auth.userId,
        enforced: enforceServerPrice,
        items: priceDivergences,
      });
    }

    console.log("[proxis-order] Produtos resolvidos:", documentoItens.length, "falhas:", failedProducts.length);
    diagnostic.items_resolved = documentoItens.length;

    // Falha parcial: o pedido segue, e o descarte vai junto do status final.
    //
    // Antes o item sem cadastro no ERP era pulado em silencio: quem pediu cinco
    // produtos via "pedido enviado" e o Proxis recebia tres. A diferenca so
    // aparecia no `failed_products` da resposta, que so o reenvio manual do
    // admin chegava a ler — no envio feito pelo cliente ninguem via nada.
    //
    // O aviso nao pode virar status "pendente": isso jogaria o pedido na fila de
    // reenvio e ele seria enviado de novo, duplicado. Vai como observacao no
    // proprio registro de enviado.
    //
    // Recusar o pedido inteiro por causa de um item foi descartado: trava a
    // venda dos outros quatro por um problema de cadastro. A checagem que evita
    // isso na origem esta no admin, ao salvar o produto.
    const avisoItensDescartados =
      failedProducts.length > 0
        ? `Enviado sem ${failedProducts.length} item(ns) sem cadastro no Proxis: ${failedProducts.join(", ")}`
        : null;

    if (documentoItens.length === 0) {
      // Produto sem cadastro no ERP nao se resolve com nova tentativa: e dado
      // a corrigir no catalogo, entao o pedido fica marcado como recusado.
      await registrarDesfecho(
        PROXIS_SYNC_ERROR,
        `Nenhum produto do pedido existe no Proxis: ${failedProducts.join(", ")}`,
      );
      return res.status(400).json({
        error: "No valid products found in Proxsis",
        failed_products: failedProducts,
      });
    }

    const now = new Date();
    const docDtEmissao = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    const representativeId = resolveRepresentativeId(body);
    diagnostic.pes_id_ven = representativeId;

    const pedido = {
      doc_tipo: 2,
      doc_tipo_documento: 1,
      doc_tipopgto: 2,
      doc_oper_estoque: "S",
      fil_id: orderConfig.fil_id,
      oin_id: orderConfig.oin_id,
      tpr_id: selectedTprId,
      cpa_id: orderConfig.cpa_id,
      tti_id: orderConfig.tti_id,
      por_id: orderConfig.por_id,
      pes_id_cli: pesId,
      pes_id_ven: representativeId,
      doc_dt_emissao: docDtEmissao,
      doc_ped_web: docPedWeb,
      doc_marcador: PROXSIS_DOC_MARCADOR,
      DocumentoItens: documentoItens,
    };

    console.log("[proxis-order] Enviando pedido para SalvarPedidoVenda", {
      doc_ped_web: docPedWeb,
      pes_id_cli: pesId,
      pes_id_ven: pedido.pes_id_ven,
      tpr_id: selectedTprId,
      customer_tpr_id: selectedTprId,
      fil_id: orderConfig.fil_id,
      oin_id: orderConfig.oin_id,
      cpa_id: orderConfig.cpa_id,
      tti_id: orderConfig.tti_id,
      por_id: orderConfig.por_id,
      total_itens: documentoItens.length,
    });

    const { resultado, jaExistia } = await criarPedidoIdempotente(
      pedido,
      docPedWeb,
      podeVerificarDuplicidade,
    );

    console.log("[proxis-order] Resposta do SalvarPedidoVenda:", JSON.stringify(resultado));

    await registrarDesfecho(PROXIS_SYNC_SENT, avisoItensDescartados);

    return res.status(200).json({
      success: true,
      doc_ped_web: docPedWeb,
      already_sent: jaExistia,
      pes_id: pesId,
      items_count: documentoItens.length,
      failed_products: failedProducts.length > 0 ? failedProducts : undefined,
      proxsis_response: resultado,
      debug: {
        tpr_id: selectedTprId,
        customer_tpr_id: selectedTprId,
        customer_table_ids: customerTableIds,
        pes_id_ven: pedido.pes_id_ven,
        fil_id: orderConfig.fil_id,
        oin_id: orderConfig.oin_id,
        cpa_id: orderConfig.cpa_id,
        tti_id: orderConfig.tti_id,
        por_id: orderConfig.por_id,
        items_attempted: body.items.length,
      },
    });
  } catch (error) {
    console.error("[proxis-order] Proxsis integration error:", error);
    const upstream = error instanceof ProxisRequestError ? error.upstream : null;
    const detail = error instanceof Error ? error.message : String(error);
    // Falha de integracao fica pendente, nao recusada: o pedido continua valido
    // e o reenvio pelo painel tende a resolver assim que o ERP normalizar.
    await registrarDesfecho(PROXIS_SYNC_PENDING, detail);
    return res.status(500).json({
      error: "Proxsis integration failed",
      detail,
      upstream: upstream ?? undefined,
      debug: diagnostic,
    });
  }
}
