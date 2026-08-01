// Mede a foto de capa de cada produto e grava as dimensoes no banco.
//
// As imagens antigas foram enviadas antes de existir qualquer registro de
// tamanho, entao a fila de pendencias do admin nasceria vazia sem este backfill.
// Roda quantas vezes precisar: so escreve quando o valor muda.
//
// Uso: node scripts/backfill-image-dimensions.mjs [--dry]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { config as loadDotenv } from "dotenv";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotenv({ path: path.join(rootDir, ".env") });

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const PRODUCTS_TABLE = "Clinic+ - Catálogo Front B2B";
const DRY_RUN = process.argv.includes("--dry");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}

const restHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function fetchProducts() {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(PRODUCTS_TABLE)}`);
  url.searchParams.set("select", "id,name,image_url,image_width,image_height");
  url.searchParams.set("image_url", "not.is.null");

  const response = await fetch(url, { headers: restHeaders });
  if (!response.ok) throw new Error(`Falha ao listar produtos (${response.status}): ${await response.text()}`);
  return response.json();
}

async function saveDimensions(id, width, height) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(PRODUCTS_TABLE)}`);
  url.searchParams.set("id", `eq.${id}`);

  const response = await fetch(url, {
    method: "PATCH",
    headers: { ...restHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ image_width: width, image_height: height }),
  });

  if (!response.ok) throw new Error(`Falha ao gravar ${id} (${response.status}): ${await response.text()}`);
}

const products = await fetchProducts();
console.log(`${products.length} produto(s) com imagem.${DRY_RUN ? " (simulacao)" : ""}\n`);

const buckets = { "<300": 0, "300-999": 0, ">=1000": 0 };
let atualizados = 0;
let iguais = 0;
let falhas = 0;

for (const product of products) {
  try {
    const response = await fetch(product.image_url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    const { width, height } = await sharp(buffer).metadata();
    if (!width || !height) throw new Error("sem metadata");

    const menorLado = Math.min(width, height);
    if (menorLado < 300) buckets["<300"] += 1;
    else if (menorLado < 1000) buckets["300-999"] += 1;
    else buckets[">=1000"] += 1;

    if (product.image_width === width && product.image_height === height) {
      iguais += 1;
      continue;
    }

    if (!DRY_RUN) await saveDimensions(product.id, width, height);
    atualizados += 1;
    console.log(`${String(width).padStart(5)}x${String(height).padEnd(6)} ${product.name}`);
  } catch (error) {
    falhas += 1;
    console.warn(`falhou: ${product.name} — ${error.message}`);
  }
}

console.log("\n--- resumo ---");
console.log("atualizados:", atualizados, "| ja corretos:", iguais, "| falhas:", falhas);
console.log("menor lado <300px:", buckets["<300"]);
console.log("menor lado 300-999px:", buckets["300-999"]);
console.log("menor lado >=1000px:", buckets[">=1000"]);
