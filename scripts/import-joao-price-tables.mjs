import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as XLSXModule from "xlsx";

const XLSX = XLSXModule.default ?? XLSXModule;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const catalogDir = path.join(root, "documentation", "catalogo");
const outputPaths = [
  path.join(root, "supabase", "migrations", "20260628124000_joao_price_tables_seed.sql"),
  path.join(root, "supabase", "APLICAR_NO_SUPABASE_joao_price_tables_seed.sql"),
];

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

function normalizeCode(value) {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  const text = String(value).trim();
  if (!text) return "";

  if (/^\d+(\.0+)$/.test(text)) {
    return String(Math.trunc(Number(text)));
  }

  return text.toUpperCase();
}

function parsePrice(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return Number.NaN;

  const cleaned = value
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function getMetaValue(row, pattern) {
  for (const cell of [row[3], row[4], row[2]]) {
    const raw = String(cell ?? "");
    const match = raw.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function readWorkbook(pathname) {
  const workbook = XLSX.readFile(pathname, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });

  if (!rows.length) {
    throw new Error(`Planilha vazia: ${path.basename(pathname)}`);
  }

  const tprId = Number(getMetaValue(rows[0], /Código Focco:\s*(\d+)/i));
  if (!Number.isFinite(tprId) || tprId <= 0) {
    throw new Error(`Nao foi possivel identificar o Codigo Focco em ${path.basename(pathname)}`);
  }

  const tableLabel = getMetaValue(rows[0], /Tabela:\s*([0-9.,]+)/i) ?? "";
  const title = String(rows[0]?.[2] ?? path.basename(pathname)).trim();
  const entries = [];

  for (const row of rows.slice(2)) {
    const code = normalizeCode(row[0]);
    const name = typeof row[2] === "string" ? row[2].trim() : "";
    const price = parsePrice(row[5]);

    if (!code || !name || !Number.isFinite(price)) continue;

    entries.push({
      code,
      name,
      price: Math.round(price * 100) / 100,
    });
  }

  const deduped = new Map();
  for (const entry of entries) {
    deduped.set(entry.code, entry);
  }

  return {
    fileName: path.basename(pathname),
    title,
    tableLabel,
    tprId,
    entries: [...deduped.values()],
    duplicateCount: entries.length - deduped.size,
  };
}

function buildSql(groups) {
  const lines = [
    "-- Seed gerado a partir das planilhas da pasta documentation/catalogo",
    "-- Execute este arquivo no Supabase para popular as tabelas de preco do ERP.",
    "BEGIN;",
    "",
    `DELETE FROM public.customer_price_overrides WHERE proxis_tpr_id IN (${groups.map((group) => group.tprId).join(", ")});`,
    "",
  ];

  for (const group of groups) {
    lines.push(`-- ${group.fileName}`);
    lines.push(`-- ${group.title} | Codigo Focco: ${group.tprId} | Tabela: ${group.tableLabel}`);
    lines.push("INSERT INTO public.customer_price_overrides (customer_type, proxis_tpr_id, product_code, price, active) VALUES");

    group.entries.forEach((entry, index) => {
      const suffix = index === group.entries.length - 1 ? ";" : ",";
      lines.push(
        `  ('cliente', ${group.tprId}, '${escapeSql(entry.code)}', ${entry.price.toFixed(2)}, true)${suffix}`,
      );
    });

    lines.push("");
  }

  lines.push("COMMIT;");
  lines.push("");
  return lines.join("\n");
}

const workbookFiles = fs
  .readdirSync(catalogDir)
  .filter((file) => file.toLowerCase().endsWith(".xlsx"))
  .sort((a, b) => a.localeCompare(b, "pt-BR"));

if (workbookFiles.length === 0) {
  throw new Error("Nenhuma planilha .xlsx encontrada em documentation/catalogo");
}

const groups = workbookFiles.map((file) => readWorkbook(path.join(catalogDir, file)));
const sql = buildSql(groups);

for (const outputPath of outputPaths) {
  fs.writeFileSync(outputPath, sql, "utf8");
}

const totalRows = groups.reduce((sum, group) => sum + group.entries.length, 0);
const duplicateRows = groups.reduce((sum, group) => sum + (group.duplicateCount ?? 0), 0);
console.log(`Planilhas lidas: ${groups.length}`);
console.log(`Linhas de preco geradas: ${totalRows}`);
console.log(`Linhas duplicadas descartadas: ${duplicateRows}`);
console.log("Arquivos escritos:");
for (const outputPath of outputPaths) {
  console.log(`- ${path.relative(root, outputPath)}`);
}
