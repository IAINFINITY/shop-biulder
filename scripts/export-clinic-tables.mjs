import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const PROJECT_REF = "fjnjktrsiydrfmrzzhhm";
const TABLES = [
  "clinic+b2b_clinic_catalogo_front_b2b",
  "clinic+b2b_admin_users",
  "clinic+b2b_catalog_banners",
  "clinic+b2b_catalog_notification_reads",
  "clinic+b2b_catalog_notifications",
  "clinic+b2b_customer_addresses",
  "clinic+b2b_customer_price_overrides",
  "clinic+b2b_customer_profiles",
  "clinic+b2b_customer_type_overrides",
  "clinic+b2b_customer_types",
  "clinic+b2b_orders",
  "clinic+b2b_price_tables",
  "clinic+b2b_product_brands",
  "clinic+b2b_product_families",
  "clinic+b2b_product_reviews",
  "clinic+b2b_product_types",
  "clinic+b2b_support_conversations",
  "clinic+b2b_support_messages",
  "clinic+b2b_user_roles",
];

function parseEnv(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([^#][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function safeFileName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function runQuery(accessToken, query) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase query failed (${response.status}): ${await response.text()}`);
  }

  return response.json();
}

const env = parseEnv(await readFile(resolve(".env"), "utf8"));
const accessToken = env.SUPABASE_ACCESS_TOKEN;
if (!accessToken) {
  throw new Error("SUPABASE_ACCESS_TOKEN is missing from .env");
}

const generatedAt = new Date();
const stamp = generatedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const outputDir = resolve("local-exports", `clinic-supabase-${stamp}`);
await mkdir(outputDir, { recursive: true });

const exportedTables = {};
const manifestTables = [];

for (const table of TABLES) {
  const identifier = quoteIdentifier(table);
  const [rows, columns] = await Promise.all([
    runQuery(accessToken, `select * from public.${identifier};`),
    runQuery(
      accessToken,
      `select column_name, data_type, udt_name, is_nullable, column_default
         from information_schema.columns
        where table_schema = 'public'
          and table_name = '${table.replaceAll("'", "''")}'
        order by ordinal_position;`,
    ),
  ]);

  const tableExport = {
    schema: "public",
    table,
    rowCount: rows.length,
    columns,
    rows,
  };
  exportedTables[table] = tableExport;
  manifestTables.push({ table, rowCount: rows.length, columnCount: columns.length });

  await writeFile(
    resolve(outputDir, `${safeFileName(table)}.json`),
    `${JSON.stringify(tableExport, null, 2)}\n`,
    "utf8",
  );
}

const manifest = {
  formatVersion: 1,
  sourceProjectRef: PROJECT_REF,
  generatedAt: generatedAt.toISOString(),
  scope: "Clinic+ public tables only; Auth and secrets are intentionally excluded",
  tableCount: manifestTables.length,
  totalRows: manifestTables.reduce((sum, table) => sum + table.rowCount, 0),
  tables: manifestTables,
};

await Promise.all([
  writeFile(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
  writeFile(
    resolve(outputDir, "clinic-tables.json"),
    `${JSON.stringify({ manifest, tables: exportedTables }, null, 2)}\n`,
    "utf8",
  ),
]);

console.log(JSON.stringify({ outputDir, ...manifest }, null, 2));
