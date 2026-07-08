import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const PUBLIC_URL_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

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

function toWebpName(name) {
  return name.replace(/\.(jpg|jpeg|png)$/i, ".webp");
}

async function renameFile(oldName) {
  const newName = toWebpName(oldName);

  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(oldName);
  if (dlErr) throw new Error(`download failed: ${dlErr.message}`);

  const buffer = Buffer.from(await blob.arrayBuffer());

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(newName, buffer, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (upErr) throw new Error(`upload failed: ${upErr.message}`);

  const { error: delErr } = await supabase.storage.from(BUCKET).remove([oldName]);
  if (delErr) throw new Error(`delete failed: ${delErr.message}`);

  return { oldName, newName };
}

async function main() {
  console.log("=== WebP Rename Script ===");
  console.log(`Bucket: ${BUCKET}`);
  console.log(`URL prefix: ${PUBLIC_URL_PREFIX}`);
  console.log("");

  console.log("Step 1: Listing all objects...");
  const all = await listAllObjects();
  const toRename = all.filter((f) => isConvertible(f.name));
  const alreadyWebP = all.filter((f) => isWebP(f.name));

  console.log(`\nTotal objects: ${all.length}`);
  console.log(`Already .webp: ${alreadyWebP.length}`);
  console.log(`To rename (→ .webp): ${toRename.length}`);
  console.log("");

  if (toRename.length === 0) {
    console.log("Nothing to rename. All files already have .webp extension.");
    return;
  }

  console.log(`⚠️  This will rename ${toRename.length} files:`);
  for (const f of toRename) {
    console.log(`     ${f.name} → ${toWebpName(f.name)}`);
  }
  console.log("");

  // Step 2: Rename files
  console.log("Step 2: Renaming files...");
  const renamed = [];
  for (const file of toRename) {
    const { name } = file;
    try {
      process.stdout.write(`  [${renamed.length + 1}/${toRename.length}] ${name} → ${toWebpName(name)} ... `);
      const result = await renameFile(name);
      renamed.push(result);
      console.log(`OK`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  console.log(`\nRenamed: ${renamed.length} / ${toRename.length}`);
  if (renamed.length === 0) {
    console.log("No files renamed. Skipping database updates.");
    return;
  }

  // Step 3: Build URL mapping
  const urlMap = renamed.map(({ oldName, newName }) => ({
    oldUrl: PUBLIC_URL_PREFIX + oldName,
    newUrl: PUBLIC_URL_PREFIX + newName,
  }));

  // Step 4: Update simple image_url columns
  console.log("\nStep 3: Updating database URLs...");
  const simpleTables = [
    { table: "Clinic+ - Catálogo Front B2B", column: "image_url", label: "products" },
    { table: "catalog_notifications", column: "image_url", label: "notifications" },
    { table: "catalog_banners", column: "image_url", label: "banners" },
  ];

  let totalDbUpdates = 0;
  for (const { table, column, label } of simpleTables) {
    let tableCount = 0;
    for (const { oldUrl, newUrl } of urlMap) {
      const { error, count } = await supabase
        .from(table)
        .update({ [column]: newUrl })
        .eq(column, oldUrl)
        .select("id", { count: "exact", head: false });

      if (error) {
        console.error(`  ⚠️  ${label}: error updating ${oldName}: ${error.message}`);
      } else {
        const matched = Array.isArray(count) ? count.length : (count ?? 0);
        tableCount += matched;
      }
    }
    if (tableCount > 0) {
      console.log(`  ✅ ${label}: ${tableCount} URL(s) updated`);
    } else {
      console.log(`  ℹ️  ${label}: no matching URLs found`);
    }
    totalDbUpdates += tableCount;
  }

  // Step 5: Update image_urls array in products table
  console.log("\nStep 4: Updating image_urls arrays in products...");
  const { data: products, error: prodErr } = await supabase
    .from("Clinic+ - Catálogo Front B2B")
    .select("id, image_urls");

  if (prodErr) {
    console.error(`  ⚠️  Failed to fetch products: ${prodErr.message}`);
  } else {
    let arrayUpdates = 0;
    for (const product of products) {
      if (!product.image_urls || product.image_urls.length === 0) continue;

      let changed = false;
      const updatedUrls = product.image_urls.map((url) => {
        const match = urlMap.find((m) => url === m.oldUrl);
        if (match) {
          changed = true;
          return match.newUrl;
        }
        return url;
      });

      if (changed) {
        const { error: upErr } = await supabase
          .from("Clinic+ - Catálogo Front B2B")
          .update({ image_urls: updatedUrls })
          .eq("id", product.id);

        if (upErr) {
          console.error(`  ⚠️  Product ${product.id}: array update failed: ${upErr.message}`);
        } else {
          arrayUpdates++;
        }
      }
    }
    if (arrayUpdates > 0) {
      console.log(`  ✅ ${arrayUpdates} product(s) had image_urls updated`);
    } else {
      console.log(`  ℹ️  No products had matching URLs in image_urls`);
    }
    totalDbUpdates += arrayUpdates;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Files renamed: ${renamed.length}`);
  console.log(`Database URLs updated: ${totalDbUpdates}`);
  console.log(`\n✅ Done!`);
}

main().catch(console.error);
