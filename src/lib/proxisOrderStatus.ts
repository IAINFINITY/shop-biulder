// Vocabulario compartilhado entre o checkout, a rota /api/proxis-order e o painel
// para descrever se um pedido chegou ou nao ao ERP.
//
// Este modulo e importado tanto pelo bundle do navegador quanto pelas funcoes
// serverless, entao ele nao pode importar nada: as rotas em `api/` resolvem estes
// arquivos por caminho relativo, sem o alias `@/`.

export const PROXIS_SYNC_PENDING = "pendente";
export const PROXIS_SYNC_SENT = "enviado";
export const PROXIS_SYNC_ERROR = "erro";
export const PROXIS_SYNC_LEGACY = "legado";

export type ProxisSyncStatus =
  | typeof PROXIS_SYNC_PENDING
  | typeof PROXIS_SYNC_SENT
  | typeof PROXIS_SYNC_ERROR
  | typeof PROXIS_SYNC_LEGACY;

const KNOWN_STATUSES: ProxisSyncStatus[] = [
  PROXIS_SYNC_PENDING,
  PROXIS_SYNC_SENT,
  PROXIS_SYNC_ERROR,
  PROXIS_SYNC_LEGACY,
];

export function normalizeProxisSyncStatus(value: unknown): ProxisSyncStatus {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (KNOWN_STATUSES as string[]).includes(normalized)
    ? (normalized as ProxisSyncStatus)
    : PROXIS_SYNC_PENDING;
}

/** Pedidos que ainda precisam de reconciliacao com o ERP. */
export function needsProxisReconciliation(value: unknown): boolean {
  const status = normalizeProxisSyncStatus(value);
  return status === PROXIS_SYNC_PENDING || status === PROXIS_SYNC_ERROR;
}

export const PROXIS_SYNC_LABELS: Record<ProxisSyncStatus, string> = {
  [PROXIS_SYNC_PENDING]: "Pendente no ERP",
  [PROXIS_SYNC_SENT]: "No Proxis",
  [PROXIS_SYNC_ERROR]: "Recusado pelo ERP",
  [PROXIS_SYNC_LEGACY]: "Sem registro",
};

const DOC_PED_WEB_PREFIX = "INFINITY-";
// Mesmo comprimento total do formato anterior (INFINITY- + 8), para nao esbarrar
// em limite de coluna do ERP ja validado em producao.
const DOC_PED_WEB_SUFFIX_LENGTH = 8;

/**
 * Deriva o `doc_ped_web` do pedido a partir do `submission_key`.
 *
 * O ponto central da idempotencia: como o valor e uma funcao pura da chave do
 * pedido, tentar de novo reivindica o mesmo documento no ERP em vez de criar um
 * segundo. O formato anterior usava `Date.now()`, e por isso cada reenvio corria
 * o risco de duplicar o pedido no Proxis.
 *
 * Retorna null quando a chave nao tem entropia suficiente para gerar um
 * identificador estavel — nesse caso o chamador cai no formato antigo.
 */
export function buildProxisDocPedWeb(submissionKey: string | null | undefined): string | null {
  const hex = String(submissionKey ?? "").replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  if (hex.length < 16) return null;

  const encoded = BigInt(`0x${hex}`).toString(36).toUpperCase();
  const suffix = encoded.slice(-DOC_PED_WEB_SUFFIX_LENGTH).padStart(DOC_PED_WEB_SUFFIX_LENGTH, "0");
  return `${DOC_PED_WEB_PREFIX}${suffix}`;
}

function randomHexBytes(length: number): string {
  const bytes = new Uint8Array(length);
  const webCrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < length; index++) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** UUID v4 usado como chave de idempotencia do pedido. */
export function newSubmissionKey(): string {
  const webCrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (webCrypto?.randomUUID) return webCrypto.randomUUID();

  // randomUUID exige contexto seguro; o fallback mantem o formato UUID v4.
  const hex = randomHexBytes(16).split("");
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20, 32),
  ].join("-");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSubmissionKey(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}
