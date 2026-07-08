import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env manually
const envPath = path.resolve(__dirname, "..", ".env");
const envRaw = fs.readFileSync(envPath, "utf-8");
const env = Object.fromEntries(
  envRaw
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => {
      const eq = l.indexOf("=");
      return [l.slice(0, eq).trim(), l.slice(eq + 1).trim().replace(/^"/, "").replace(/"$/, "")];
    }),
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "product-images";
const WEBP_QUALITY = 80;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function listAllObjects() {
  const all = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list("", {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    offset += limit;
    console.log(`  Listed ${all.length} files...`);
  }
  return all;
}

function isConvertible(name) {
  return /\.(jpg|jpeg|png)$/i.test(name);
}

function isWebP(name) {
  return /\.webp$/i.test(name);
}

async function main() {
  console.log("=== WebP Migration Script ===");
  console.log(`Bucket: ${BUCKET}`);
  console.log(`WebP quality: ${WEBP_QUALITY}`);
  console.log("Strategy: overwrite same path with WebP content + correct Content-Type");
  console.log("No database changes needed — URLs stay the same.");
  console.log("");

  // 1. List all objects
  console.log("Step 1: Listing all objects...");
  const all = await listAllObjects();
  const toConvert = all.filter((f) => isConvertible(f.name));
  const alreadyWebP = all.filter((f) => isWebP(f.name));

  console.log(`\nTotal objects: ${all.length}`);
  console.log(`Already WebP: ${alreadyWebP.length}`);
  console.log(`To convert (jpg/png → webp): ${toConvert.length}`);
  console.log("");

  if (toConvert.length === 0) {
    console.log("Nothing to convert. All images already WebP.");
    return;
  }

  // Ask confirmation
  console.log(`⚠️  This will overwrite ${toConvert.length} files in the bucket.`);
  console.log("   Originals will be lost (converted to WebP at same path).");
  console.log("");

  // 2. Convert and upload
  let success = 0;
  let errors = 0;
  let totalBytesBefore = 0;
  let totalBytesAfter = 0;

  for (const file of toConvert) {
    const { name } = file;
    try {
      process.stdout.write(`  [${success + errors + 1}/${toConvert.length}] ${name} ... `);

      // Download
      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(name);
      if (dlErr) throw dlErr;

      const buffer = Buffer.from(await blob.arrayBuffer());
      totalBytesBefore += buffer.length;

      // Convert to WebP
      const webpBuffer = await sharp(buffer)
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      totalBytesAfter += webpBuffer.length;

      // Upload back to SAME path with new Content-Type + cache
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(name, webpBuffer, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true,
      });
      if (upErr) throw upErr;

      const savedPct = ((1 - webpBuffer.length / buffer.length) * 100).toFixed(1);
      console.log(`OK (${(buffer.length / 1024).toFixed(0)}KB → ${(webpBuffer.length / 1024).toFixed(0)}KB, -${savedPct}%)`);
      success++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      errors++;
    }
  }

  // Summary
  const totalSavedPct = ((1 - totalBytesAfter / totalBytesBefore) * 100).toFixed(1);
  console.log(`\n=== Summary ===`);
  console.log(`Converted: ${success}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total size: ${(totalBytesBefore / 1024 / 1024).toFixed(1)}MB → ${(totalBytesAfter / 1024 / 1024).toFixed(1)}MB (-${totalSavedPct}%)`);
  console.log(`Cache-Control: max-age=31536000 (1 year)`);
  console.log(`\n✅ Done! No database changes needed.`);
}

main().catch(console.error);
