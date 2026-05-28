import { parseOrderTableLines, type OrderTableLine } from "@/lib/orders";

/** Colunas do layout Proxis (planilha / pedido teste.txt). */
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

/** Divisão de venda fixa no layout Proxis (sempre 1). */
export const PROXIS_IMPORT_DIV_VENDA = "1";

/**
 * Representante (coluna Rep). Provisório até definirem quem importa no Proxis.
 * Atualize VITE_PROXIS_IMPORT_REP no .env quando tiverem o ID definitivo.
 */
export const PROXIS_IMPORT_REP_DEFAULT = "14";

export type ProxisImportOrderInput = {
  proxisImportId: number;
  customerCnpj: string;
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

/** Campo vazio permanece vazio (nunca escreve "NULL"). */
export function formatProxisImportCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null") return "";
  return text;
}

/** Uma linha do arquivo .txt com exatamente 13 colunas separadas por `;`. */
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
  line: OrderTableLine,
  emissionDate: string,
  rep: string,
): string[] {
  return [
    String(proxisImportId),
    cnpjDigits,
    line.code,
    String(line.quantity),
    "",
    emissionDate,
    emissionDate,
    "",
    rep,
    PROXIS_IMPORT_DIV_VENDA,
    "",
    "",
    "",
  ];
}

/** Código do representante para o .txt (env ou valor padrão provisório). */
export function getProxisImportRep(): string {
  const fromEnv = import.meta.env.VITE_PROXIS_IMPORT_REP?.trim();
  return fromEnv || PROXIS_IMPORT_REP_DEFAULT;
}

export function buildProxisImportLines(
  order: ProxisImportOrderInput,
  rep: string = getProxisImportRep(),
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
    formatProxisImportLine(
      buildLineFields(order.proxisImportId, cnpjDigits, line, emissionDate, rep),
    ),
  );
}

export function buildProxisImportFileContent(
  orders: ProxisImportOrderInput[],
  rep: string = getProxisImportRep(),
): string {
  const allLines: string[] = [];

  for (const order of orders) {
    allLines.push(...buildProxisImportLines(order, rep));
  }

  return `${allLines.join("\n")}\n`;
}

export function proxisImportFileName(proxisImportId: number, createdAt: string): string {
  const date = new Date(createdAt).toISOString().slice(0, 10);
  return `pedido-proxis-${proxisImportId}-${date}.txt`;
}
