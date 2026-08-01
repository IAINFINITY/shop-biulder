/**
 * Passa as fotos que ja estao no storage pelo mesmo tratamento que o upload faz
 * hoje: entrega em 4:5, com o entorno preenchido pela propria borda da foto.
 *
 * Trata a galeria inteira (`image_urls`), nao so a capa. Uma versao anterior
 * mexia so em `image_url` e deixava `image_urls` intacta — como a vitrine
 * monta a lista juntando as duas, a capa tratada entrava como item novo e a
 * original continuava na lista: 6 fotos onde havia 5, a primeira repetida. Aqui
 * as duas colunas saem sempre coerentes, e `image_url` e a primeira da galeria.
 *
 * Existe para as fotos subidas antes desse tratamento — sem ele, seria preciso
 * reenviar as 143 uma a uma pelo admin.
 *
 * O arquivo original NAO e apagado: a versao tratada sobe com sufixo `-4x5` e o
 * produto passa a apontar para ela. Para desfazer, basta devolver o `image_url`
 * anterior (o script imprime o de-para).
 *
 * Simulacao por padrao. Para gravar:
 *   node scripts/normalize-stored-images.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { fillToFrame, TARGET_WIDTH, TARGET_HEIGHT } from "./lib/fillImageToFrame.mjs";
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

const TABLE = "Clinic+ - Catálogo Front B2B";
const BUCKET = "product-images";
// Mesma tolerancia do admin: diferenca menor que isso nao se percebe na moldura.
const TOLERANCE = 0.08;

const apply = process.argv.includes("--apply");
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const parseImages = (value) => {
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string" && item.trim()) : [];
    } catch {
      return [];
    }
  }
  return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
};

const publicPrefix = `${env.VITE_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

const { data: products, error } = await supabase
  .from(TABLE)
  .select("id, name, image_url, image_urls, active")
  .eq("active", true);

if (error) {
  console.error("Falha ao ler produtos:", error.message);
  process.exit(1);
}

const asList = (value) => {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string" && item.trim());
  return parseImages(value);
};

/** Junta capa e galeria do mesmo jeito que a vitrine faz, sem repetir. */
const gatherImages = (product) => {
  const urls = [];
  const seen = new Set();
  for (const url of [...parseImages(product.image_url), ...asList(product.image_urls)]) {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    urls.push(trimmed);
  }
  return urls;
};

/** Caminho da versao tratada de um original — e o que permite reconhecer o par. */
const treatedPathOf = (objectPath) => `${objectPath.replace(/\.[^./]+$/, "")}-4x5.webp`;
const objectPathOf = (url) =>
  url.startsWith(publicPrefix) ? decodeURIComponent(url.slice(publicPrefix.length).split("?")[0]) : null;

let alreadyFine = 0;
let converted = 0;
let skipped = 0;
let deduped = 0;

for (const product of products ?? []) {
  const images = gatherImages(product);
  if (images.length === 0) continue;

  const rewritten = [];
  const seen = new Set();
  let changed = false;

  for (const url of images) {
    const objectPath = objectPathOf(url);

    // Original cuja versao tratada ja esta na lista: some, e a duplicata que a
    // rodada anterior criou.
    if (objectPath && seen.has(treatedPathOf(objectPath))) {
      deduped += 1;
      changed = true;
      continue;
    }

    if (!objectPath || url.includes("-4x5.webp")) {
      if (url.includes("-4x5.webp")) alreadyFine += 1;
      else skipped += 1;
      if (objectPath) seen.add(objectPath);
      rewritten.push(url);
      continue;
    }

    const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(objectPath);
    if (downloadError || !file) {
      console.error(`  nao baixou ${objectPath}: ${downloadError?.message ?? "sem corpo"}`);
      rewritten.push(url);
      skipped += 1;
      continue;
    }

    const source = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(source).metadata();
    const ratio = meta.width && meta.height ? meta.width / meta.height : null;
    const inFrame =
      ratio !== null && Math.abs(ratio - TARGET_WIDTH / TARGET_HEIGHT) <= (TARGET_WIDTH / TARGET_HEIGHT) * TOLERANCE;

    if (inFrame && meta.width === TARGET_WIDTH && meta.height === TARGET_HEIGHT) {
      rewritten.push(url);
      seen.add(objectPath);
      alreadyFine += 1;
      continue;
    }

    const targetPath = treatedPathOf(objectPath);
    console.log(`  ${product.name}\n    ${meta.width}x${meta.height} -> ${TARGET_WIDTH}x${TARGET_HEIGHT}  ${targetPath}`);
    converted += 1;

    if (!apply) {
      rewritten.push(url);
      continue;
    }

    const output = await fillToFrame(source);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(targetPath, output, { contentType: "image/webp", upsert: true });
    if (uploadError) {
      console.error(`    falhou no upload: ${uploadError.message}`);
      rewritten.push(url);
      continue;
    }
    rewritten.push(`${publicPrefix}${encodeURIComponent(targetPath)}`);
    seen.add(targetPath);
    changed = true;
  }

  if (apply && changed) {
    const { error: updateError } = await supabase
      .from(TABLE)
      .update({
        image_url: rewritten[0] ?? null,
        image_urls: rewritten,
        image_fit: "cover",
        image_width: TARGET_WIDTH,
        image_height: TARGET_HEIGHT,
      })
      .eq("id", product.id);
    if (updateError) console.error(`    nao atualizou o produto: ${updateError.message}`);
  }
}

console.log(`\nJa no quadro: ${alreadyFine}`);
console.log(`A converter:  ${converted}`);
if (deduped) console.log(`Duplicatas removidas da galeria: ${deduped}`);
if (skipped) console.log(`Fora do storage do projeto (nao mexido): ${skipped}`);
if (!apply) console.log("\nSimulacao — nada foi gravado. Use --apply para gravar.");
