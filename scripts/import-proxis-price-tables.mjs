/**
 * Importa as tabelas de preco do Proxis para `customer_price_overrides`.
 *
 * Ate aqui essa tabela era alimentada por fora, e sem conferencia. O resultado,
 * medido em 31/07/2026:
 *
 *   - tabela 8728: 143 dos 156 itens com preco ZERO no nosso banco, contra 165
 *     itens e nenhum zero na origem;
 *   - tabela 8729: nunca importada, apesar de existir com 170 itens e de haver
 *     tres clientes apontando para ela;
 *   - tabelas 8744 e 8745 importadas, mas sem cliente nenhum usando.
 *
 * Simulacao por padrao. Para gravar:
 *   node scripts/import-proxis-price-tables.mjs --apply
 *   node scripts/import-proxis-price-tables.mjs --apply --tpr 8728,8729
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envRaw = fs.readFileSync(path.resolve(__dirname, "..", ".env"), "utf-8");
const env = Object.fromEntries(
  envRaw
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => {
      const eq = line.indexOf("=");
      return [line.slice(0, eq).trim(), line.slice(eq + 1).trim().replace(/^"/, "").replace(/"$/, "")];
    }),
);

const TABLE = "clinic+b2b_customer_price_overrides";
const CATALOG = "clinic+b2b_clinic_catalogo_front_b2b";
/** Todas as tabelas do Proxis sao de cliente; o tipo separa so o fallback. */
const CUSTOMER_TYPE = "cliente";

const apply = process.argv.includes("--apply");
const tprArg = process.argv.find((arg) => arg.startsWith("--tpr"));
const onlyTprs = tprArg
  ? new Set(
      (tprArg.includes("=") ? tprArg.split("=")[1] : process.argv[process.argv.indexOf(tprArg) + 1] ?? "")
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter(Number.isFinite),
    )
  : null;

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const proxisHeaders = {
  "Content-Type": "application/json",
  Authorization:
    "Basic " + Buffer.from(`${(env.PROXSIS_USER ?? "").trim()}:${(env.PROXSIS_PASSWORD ?? "").trim()}`).toString("base64"),
  "x-proManager-filial": (env.PROXSIS_FILIAL || "5").trim(),
};
const proxisBase = (env.PROXSIS_BASE_URL ?? "").replace(/\/$/, "");

async function fetchPage(start, size) {
  const res = await fetch(`${proxisBase}/"ObterTabelasPreco"`, {
    method: "GET",
    headers: {
      ...proxisHeaders,
      "X-ProManager-Pagina-Inicio": String(start),
      "X-ProManager-Pagina-Quant": String(size),
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Proxis respondeu ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

const toCode = (value) => String(value ?? "").trim().toUpperCase();

/** Espelha `normalizeProxisPriceTable`; preco que nao seja positivo fica fora. */
function normalize(raw) {
  const tprId = Number(raw.tpr_id);
  if (!Number.isFinite(tprId) || tprId <= 0) return null;
  const items = new Map();
  for (const row of Array.isArray(raw.tabelapreco) ? raw.tabelapreco : []) {
    if (!row || typeof row !== "object") continue;
    const code = toCode(row.ite_numero);
    const price = Number(row.tit_preco);
    if (!code || !Number.isFinite(price) || price <= 0) continue;
    items.set(code, Math.round(price * 100) / 100);
  }
  return {
    tprId: Math.trunc(tprId),
    description: String(raw.tpr_descricao ?? "").trim(),
    active: raw.ativo !== false,
    items,
  };
}

const { data: produtos, error: erroCatalogo } = await supabase.from(CATALOG).select("product_code").eq("active", true);
if (erroCatalogo) {
  console.error("Falha ao ler o catalogo:", erroCatalogo.message);
  process.exit(1);
}
const codigosDoCatalogo = new Set((produtos ?? []).map((p) => toCode(p.product_code)).filter(Boolean));

// Quais tabelas realmente interessam: as que algum cliente usa.
const { data: perfis } = await supabase.from("clinic+b2b_customer_profiles").select("proxis_tpr_id");
const tprsEmUso = new Set((perfis ?? []).map((p) => p.proxis_tpr_id).filter((v) => typeof v === "number"));

let brutas = [];
for (let start = 0; ; start += 50) {
  const payload = await fetchPage(start, 50);
  const rows = Array.isArray(payload) ? payload : [payload].filter(Boolean);
  if (rows.length === 0) break;
  brutas.push(...rows);
  if (rows.length < 50) break;
}

const tabelas = brutas.map(normalize).filter(Boolean);
const alvo = tabelas.filter((t) => (onlyTprs ? onlyTprs.has(t.tprId) : tprsEmUso.has(t.tprId)));

console.log(`tabelas no Proxis: ${tabelas.length}`);
console.log(`em uso por algum cliente: ${[...tprsEmUso].sort().join(", ") || "nenhuma"}`);
console.log(`selecionadas para importar: ${alvo.map((t) => t.tprId).join(", ") || "nenhuma"}\n`);

for (const tabela of alvo) {
  const doCatalogo = [...tabela.items].filter(([code]) => codigosDoCatalogo.has(code));
  const foraDoCatalogo = tabela.items.size - doCatalogo.length;
  const semPreco = codigosDoCatalogo.size - doCatalogo.length;

  const { data: atual } = await supabase
    .from(TABLE)
    .select("product_code, price")
    .eq("proxis_tpr_id", tabela.tprId);
  const zerosAtuais = (atual ?? []).filter((r) => Number(r.price) === 0).length;

  console.log(`tpr ${tabela.tprId} - ${tabela.description}`);
  console.log(`  no Proxis: ${tabela.items.size} itens  |  batem com o catalogo: ${doCatalogo.length}`);
  console.log(`  itens que o site nao vende: ${foraDoCatalogo} (descartados)`);
  console.log(`  produtos do catalogo sem preco nesta tabela: ${semPreco} (caem no fallback)`);
  console.log(`  no nosso banco hoje: ${(atual ?? []).length} linhas, ${zerosAtuais} com preco zero`);

  if (!apply) continue;

  const linhas = doCatalogo.map(([product_code, price]) => ({
    customer_type: CUSTOMER_TYPE,
    proxis_tpr_id: tabela.tprId,
    product_code,
    price,
    active: tabela.active,
  }));

  // Troca completa: a tabela do Proxis e a verdade. Atualizar linha a linha
  // deixaria para tras o item que saiu da tabela na origem.
  const { error: erroDelete } = await supabase.from(TABLE).delete().eq("proxis_tpr_id", tabela.tprId);
  if (erroDelete) {
    console.error(`  falhou ao limpar: ${erroDelete.message}`);
    continue;
  }
  const { error: erroInsert } = await supabase.from(TABLE).insert(linhas);
  if (erroInsert) {
    console.error(`  falhou ao gravar: ${erroInsert.message}`);
    continue;
  }
  console.log(`  gravado: ${linhas.length} linhas`);
}

if (!apply) console.log("\nSimulacao - nada foi gravado. Use --apply para gravar.");
