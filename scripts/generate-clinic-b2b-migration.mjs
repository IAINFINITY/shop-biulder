import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const EXPORT_ROOT = resolve("local-exports");
const TARGET_PREFIX = "clinic+b2b_";
const TARGET_SCHEMA = "public";

function safeSlug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function exportFileName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function escapeSqlString(value) {
  return String(value).replaceAll("'", "''");
}

function parseManifestTableName(entry) {
  return entry.table ?? entry.name ?? entry.sourceTable ?? null;
}

function latestExportDir(entries) {
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("clinic-supabase-"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .at(-1)?.name ?? null;
}

function columnSqlType(column) {
  const dataType = String(column.data_type ?? "").toLowerCase();
  const udtName = String(column.udt_name ?? "").toLowerCase();

  if (dataType === "array") {
    const arrayBaseTypes = {
      _text: "text",
      _varchar: "character varying",
      _bpchar: "character",
      _uuid: "uuid",
      _int2: "smallint",
      _int4: "integer",
      _int8: "bigint",
      _numeric: "numeric",
      _float4: "real",
      _float8: "double precision",
      _bool: "boolean",
      _date: "date",
      _timestamp: "timestamp without time zone",
      _timestamptz: "timestamp with time zone",
      _json: "json",
      _jsonb: "jsonb",
    };

    return `${arrayBaseTypes[udtName] ?? "text"}[]`;
  }

  if (dataType === "user-defined") {
    return "text";
  }

  if (!dataType) {
    return "text";
  }

  return dataType;
}

function formatScalar(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return String(value);
  if (typeof value === "string") return `'${escapeSqlString(value)}'`;
  return `'${escapeSqlString(JSON.stringify(value))}'`;
}

function formatArray(value, elementType) {
  if (!Array.isArray(value)) return formatScalar(value);
  if (value.length === 0) {
    return `ARRAY[]::${elementType}[]`;
  }
  const items = value.map((item) => formatLiteral(item, elementType));
  return `ARRAY[${items.join(", ")}]::${elementType}[]`;
}

function formatLiteral(value, sqlType) {
  if (value === null || value === undefined) return "NULL";

  const normalizedType = String(sqlType ?? "").toLowerCase();
  if (normalizedType.endsWith("[]")) {
    return formatArray(value, normalizedType.slice(0, -2));
  }
  if (normalizedType === "json" || normalizedType === "jsonb") {
    return `'${escapeSqlString(JSON.stringify(value))}'::${normalizedType}`;
  }
  if (normalizedType === "boolean") return value ? "TRUE" : "FALSE";
  if (normalizedType === "smallint" || normalizedType === "integer" || normalizedType === "bigint" || normalizedType === "numeric" || normalizedType === "real" || normalizedType === "double precision") {
    return formatScalar(value);
  }
  return formatScalar(value);
}

async function loadLatestExport() {
  const entries = await readdir(EXPORT_ROOT, { withFileTypes: true });
  const dirName = latestExportDir(entries);
  if (!dirName) {
    throw new Error("No clinic-supabase export directory found in local-exports");
  }
  const exportDir = resolve(EXPORT_ROOT, dirName);
  const manifest = JSON.parse(await readFile(resolve(exportDir, "manifest.json"), "utf8"));
  return { exportDir, manifest };
}

const { exportDir, manifest } = await loadLatestExport();

const mappedTables = [];
const statements = [];
statements.push(`BEGIN;`);
statements.push(`SET statement_timeout = 0;`);
statements.push(`SET lock_timeout = 0;`);

for (const entry of manifest.tables ?? []) {
  const sourceTable = parseManifestTableName(entry);
  if (!sourceTable) continue;

  const fileName = `${exportFileName(sourceTable)}.json`;
  const tableExport = JSON.parse(await readFile(resolve(exportDir, fileName), "utf8"));
  const targetTable = `${TARGET_PREFIX}${safeSlug(sourceTable)}`;
  const columns = Array.isArray(tableExport.columns) ? tableExport.columns : [];
  const rows = Array.isArray(tableExport.rows) ? tableExport.rows : [];

  mappedTables.push({
    sourceTable,
    targetTable,
    rowCount: rows.length,
    columnCount: columns.length,
  });

  const columnSql = columns.map((column) => {
    const name = column.column_name;
    const sqlType = columnSqlType(column);
    const nullable = String(column.is_nullable ?? "YES").toUpperCase() === "YES" ? "" : " NOT NULL";
    return `  ${quoteIdentifier(name)} ${sqlType}${nullable}`;
  });

  statements.push(`DROP TABLE IF EXISTS ${TARGET_SCHEMA}.${quoteIdentifier(targetTable)} CASCADE;`);
  statements.push(`CREATE TABLE ${TARGET_SCHEMA}.${quoteIdentifier(targetTable)} (\n${columnSql.join(",\n")}\n);`);

  if (rows.length > 0 && columns.length > 0) {
    const columnNames = columns.map((column) => quoteIdentifier(column.column_name)).join(", ");
    const valuesSql = rows
      .map((row) => {
        const rowValues = columns.map((column) => {
          const sqlType = columnSqlType(column);
          return formatLiteral(row[column.column_name], sqlType);
        });
        return `(${rowValues.join(", ")})`;
      })
      .join(",\n");

    statements.push(`INSERT INTO ${TARGET_SCHEMA}.${quoteIdentifier(targetTable)} (${columnNames}) VALUES\n${valuesSql};`);
  }
}

statements.push(`COMMIT;`);

const outputSql = statements.join("\n\n") + "\n";
const outputMap = {
  generatedAt: new Date().toISOString(),
  sourceExportDir: exportDir,
  targetPrefix: TARGET_PREFIX,
  targetSchema: TARGET_SCHEMA,
  tableCount: mappedTables.length,
  tables: mappedTables,
};

await writeFile(resolve(exportDir, "clinic-b2b-migration.sql"), outputSql, "utf8");
await writeFile(resolve(exportDir, "clinic-b2b-table-map.json"), `${JSON.stringify(outputMap, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      exportDir,
      outputSql: resolve(exportDir, "clinic-b2b-migration.sql"),
      outputMap: resolve(exportDir, "clinic-b2b-table-map.json"),
      tableCount: mappedTables.length,
      totalRows: mappedTables.reduce((sum, table) => sum + table.rowCount, 0),
      targetPrefix: TARGET_PREFIX,
      targetSchema: TARGET_SCHEMA,
    },
    null,
    2,
  ),
);
