import { parseOrderTableLines, type OrderTableLine } from "@/lib/orders";
import { DEFAULT_PROXSIS_TPR_ID, normalizeProxisTprId } from "@/lib/proxisTpr";

export const PROXIS_IMPORT_COLUMN_COUNT = 13;

export type ProxisImportField =
  | "id"
  | "cnpjCpf"
  | "codItem"
  | "qtde"
  | "precoUnitario"
  | "dtEmissao"
  | "dtEntrega"
  | "tipoNota"
  | "rep"
  | "divVenda"
  | "tabVenda"
  | "condPag"
  | "portador";

export const PROXIS_IMPORT_DIV_VENDA = "1";

// FOCCO usa 356 para venda à vista.
export const PROXIS_IMPORT_COND_PAG_A_VISTA = "356";

export const PROXIS_IMPORT_REP_DEFAULT =
  "2871,3216,2880,7798,7057,6437,7318,2365,2370";

export const PROXIS_IMPORT_TPR_DEFAULT = DEFAULT_PROXSIS_TPR_ID;

export type ProxisImportOrderInput = {
  proxisImportId: number;
  customerCnpj: string;
  customerTprId: number | null;
  createdAt: string;
  items: unknown;
  enrichmentMaps?: Parameters<typeof parseOrderTableLines>[1];
};

const onlyDigits = (value: string) => value.replace(/\D/g, "");

export function formatProxisImportDate(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatProxisImportCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null") return "";
  return text;
}

export function formatProxisImportLine(fields: string[]): string {
  if (fields.length !== PROXIS_IMPORT_COLUMN_COUNT) {
    throw new Error(
      `Linha Proxis deve ter ${PROXIS_IMPORT_COLUMN_COUNT} colunas, recebeu ${fields.length}`,
    );
  }
  return fields.map(formatProxisImportCell).join(";");
}

function buildLineFields(
  proxisImportId: number,
  cnpjDigits: string,
  customerTprId: number | null,
  line: OrderTableLine,
  emissionDate: string,
): string[] {
  const tabVenda = normalizeProxisTprId(customerTprId) ?? PROXIS_IMPORT_TPR_DEFAULT;

  return [
    String(proxisImportId),
    cnpjDigits,
    line.code,
    String(line.quantity),
    "",
    emissionDate,
    emissionDate,
    "",
    "",
    PROXIS_IMPORT_DIV_VENDA,
    String(tabVenda),
    PROXIS_IMPORT_COND_PAG_A_VISTA,
    "",
  ];
}

export function getProxisImportRep(seed = 0): string {
  const fromEnv = import.meta.env.VITE_PROXIS_IMPORT_REP?.trim();
  const raw = fromEnv || PROXIS_IMPORT_REP_DEFAULT;
  const reps = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (reps.length === 0) return "2871";
  if (reps.length === 1) return reps[0];

  const index = Math.abs(Math.trunc(seed)) % reps.length;
  return reps[index];
}

export function buildProxisImportLines(
  order: ProxisImportOrderInput,
): string[] {
  const cnpjDigits = onlyDigits(order.customerCnpj);
  if (!cnpjDigits) {
    throw new Error("CNPJ/CPF do pedido está vazio.");
  }

  const lines = parseOrderTableLines(order.items, order.enrichmentMaps);
  if (lines.length === 0) {
    throw new Error("Pedido sem itens para exportar.");
  }

  const invalidCodes = lines.filter(
    (line) => !line.code || line.code === "—" || /^[0-9A-F]{8}$/i.test(line.code),
  );
  if (invalidCodes.length > 0) {
    const names = invalidCodes.map((l) => l.name).join(", ");
    throw new Error(
      `Produto(s) sem código Proxis válido: ${names}. Cadastre o código no admin e tente novamente.`,
    );
  }

  const emissionDate = formatProxisImportDate(order.createdAt);

  return lines.map((line) =>
    formatProxisImportLine(buildLineFields(order.proxisImportId, cnpjDigits, order.customerTprId, line, emissionDate)),
  );
}

export function buildProxisImportFileContent(
  orders: ProxisImportOrderInput[],
): string {
  const allLines: string[] = [];

  for (let index = 0; index < orders.length; index++) {
    const order = orders[index];
    allLines.push(...buildProxisImportLines(order));
  }

  return `${allLines.join("\n")}\n`;
}

export function foccoImportFileName(proxisImportId: number, createdAt: string): string {
  const date = new Date(createdAt).toISOString().slice(0, 10);
  return `pedido-focco-${proxisImportId}-${date}.txt`;
}
