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

/**
 * A divisão de venda, que é a única coisa que separa os dois arquivos.
 *
 * ## Por que dois
 *
 * O mesmo item não pode ficar na divisão de venda 1 nas duas empresas dentro do
 * FOCCO. A Hilê ficou com a 1, que já existia; a Net Nature precisou da 2. Do
 * pedido para cá não muda mais nada — mesmo CNPJ, mesmos itens, mesma tabela,
 * mesma data. Só esta coluna.
 *
 * Por isso são dois botões e não um seletor: quem exporta sabe para qual
 * empresa está mandando, e um seletor errado só se descobre no FOCCO.
 */
export const DIVISAO_DE_VENDA = {
  hile: "1",
  net: "2",
} as const;

export type EmpresaDoFocco = keyof typeof DIVISAO_DE_VENDA;

/** Como cada empresa se chama na tela e no nome do arquivo. */
export const NOME_DA_EMPRESA: Record<EmpresaDoFocco, string> = {
  hile: "HILE",
  net: "NET",
};

/** @deprecated Use `DIVISAO_DE_VENDA`. Mantido para não quebrar import antigo. */
export const PROXIS_IMPORT_DIV_VENDA = DIVISAO_DE_VENDA.hile;

// FOCCO usa 356 para venda à vista.
export const PROXIS_IMPORT_COND_PAG_A_VISTA = "356";

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
  empresa: EmpresaDoFocco,
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
    DIVISAO_DE_VENDA[empresa],
    String(tabVenda),
    PROXIS_IMPORT_COND_PAG_A_VISTA,
    "",
  ];
}

export function buildProxisImportLines(
  order: ProxisImportOrderInput,
  // Padrão `ile`: é o arquivo que já existia e já está funcionando, então
  // nenhuma chamada antiga muda de comportamento ao ganhar o parâmetro.
  empresa: EmpresaDoFocco = "hile",
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
      buildLineFields(order.proxisImportId, cnpjDigits, order.customerTprId, line, emissionDate, empresa),
    ),
  );
}

export function buildProxisImportFileContent(
  orders: ProxisImportOrderInput[],
  empresa: EmpresaDoFocco = "hile",
): string {
  const allLines: string[] = [];

  for (let index = 0; index < orders.length; index++) {
    const order = orders[index];
    allLines.push(...buildProxisImportLines(order, empresa));
  }

  return `${allLines.join("\n")}\n`;
}

/**
 * ⚠️ A empresa entra no nome do arquivo.
 *
 * Os dois arquivos do mesmo pedido são idênticos exceto por uma coluna. Com o
 * nome antigo, o segundo download viraria "pedido-focco-25-2026-09-02 (1).txt"
 * na pasta de downloads — e ninguém saberia qual é o da Hilê.
 */
export function foccoImportFileName(
  proxisImportId: number,
  createdAt: string,
  empresa: EmpresaDoFocco = "hile",
): string {
  const date = new Date(createdAt).toISOString().slice(0, 10);
  return `pedido-focco-${empresa}-${proxisImportId}-${date}.txt`;
}
