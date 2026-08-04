/**
 * Marca `image_fit = 'cover'` nos produtos cuja foto ja esta na proporcao da
 * moldura (4:5).
 *
 * Quando a foto tem a proporcao da moldura, `cover` preenche o quadro inteiro
 * sem cortar nada de relevante — e o resultado ideal, sem desfoque de apoio.
 * Fora dessa faixa, `cover` cortaria parte do produto, entao esses ficam em
 * `contain` e a moldura e preenchida pelo fundo desfocado.
 *
 * Roda em modo simulacao por padrao. Para gravar:
 *   node scripts/set-image-fit-cover.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import process from "node:process";

const TABLE = "clinic+b2b_clinic_catalogo_front_b2b";
const TARGET_RATIO = 4 / 5;
// Tolerancia de ~8%: o suficiente para absorver diferenca de recorte sem deixar
// passar foto que perderia parte do rotulo.
const TOLERANCE = 0.08;
const MIN_RATIO = TARGET_RATIO * (1 - TOLERANCE);
const MAX_RATIO = TARGET_RATIO * (1 + TOLERANCE);

const apply = process.argv.includes("--apply");
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Faltam VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase
  .from(TABLE)
  .select("id, name, image_url, image_fit, active")
  .eq("active", true);

if (error) {
  console.error("Falha ao ler produtos:", error.message);
  process.exit(1);
}

const firstImage = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? (parsed.find((item) => typeof item === "string" && item.trim()) ?? null) : null;
    } catch {
      return null;
    }
  }
  return trimmed.split(",")[0]?.trim() || null;
};

const toCover = [];
const keepContain = [];
const unreadable = [];

for (const product of data ?? []) {
  const src = firstImage(product.image_url);
  if (!src) continue;

  let ratio = null;
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    if (meta.width && meta.height) ratio = meta.width / meta.height;
  } catch (cause) {
    unreadable.push({ name: product.name, reason: String(cause?.message ?? cause) });
    continue;
  }

  if (ratio === null) continue;
  const record = { id: product.id, name: product.name, ratio: ratio.toFixed(3), current: product.image_fit };
  if (ratio >= MIN_RATIO && ratio <= MAX_RATIO) toCover.push(record);
  else keepContain.push(record);
}

console.log(`\nNa proporcao da moldura (cover): ${toCover.length}`);
console.log(`Fora da proporcao (contain + fundo desfocado): ${keepContain.length}`);
if (unreadable.length) console.log(`Imagem ilegivel: ${unreadable.length}`);

const pending = toCover.filter((item) => item.current !== "cover");
console.log(`\nProdutos a atualizar para cover: ${pending.length}`);
for (const item of pending) console.log(`  ${item.ratio}  ${item.name}`);

if (!apply) {
  console.log("\nSimulacao — nada foi gravado. Use --apply para gravar.");
  process.exit(0);
}

for (const item of pending) {
  const { error: updateError } = await supabase.from(TABLE).update({ image_fit: "cover" }).eq("id", item.id);
  if (updateError) console.error(`  falhou ${item.name}: ${updateError.message}`);
}
console.log(`\n${pending.length} produto(s) atualizado(s).`);
