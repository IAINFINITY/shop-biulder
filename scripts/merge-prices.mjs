import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function parseUserPrices(raw) {
  const entries = [];
  const lines = raw.split(/\r?\n/);
  let pending = null;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/^valor\s*:?/i.test(t)) {
      if (!pending) continue;
      const low = t.toLowerCase();
      let price = 0;
      if (!low.includes("sem preço") && !low.includes("sem preco")) {
        const m = t.replace(/\s/g, " ").match(/R\$\s*([\d.]+(?:,\d+)?)/i);
        if (m) {
          const num = m[1].includes(",")
            ? parseFloat(m[1].replace(/\./g, "").replace(",", "."))
            : parseFloat(m[1]);
          if (Number.isFinite(num)) price = num;
        }
      }
      entries.push({ name: pending, price });
      pending = null;
    } else if (t.startsWith("-")) {
      pending = t.replace(/^-\s*/, "").trim();
    }
  }
  return entries;
}

function words(s) {
  return new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/i)
      .filter((w) => w.length > 1)
  );
}

function jaccard(a, b) {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const uni = a.size + b.size - inter;
  return uni ? inter / uni : 0;
}

function bestUserPrice(catalogName, userEntries) {
  const cw = words(catalogName);
  let best = { score: 0, price: 0, userName: "" };
  for (const { name, price } of userEntries) {
    const uw = words(name);
    const sc = jaccard(cw, uw);
    if (sc > best.score) best = { score: sc, price, userName: name };
  }
  if (best.score >= 0.25) return best;
  const exact = userEntries.find((e) => e.name === catalogName);
  if (exact) return { score: 1, price: exact.price, userName: exact.name };
  return { score: 0, price: 0, userName: "" };
}

function sqlEscape(str) {
  return str.replace(/'/g, "''");
}

const userRaw = fs.readFileSync(path.join(__dirname, "user_prices.txt"), "utf8");
const userEntries = parseUserPrices(userRaw);
const catalog = JSON.parse(fs.readFileSync(path.join(root, "catalog_products.json"), "utf8"));
const uniqueNames = [...new Set(catalog.map((p) => p.name))];

const manual = {
  "Artimag Mais Colágeno Tipo II sabor Neutro": 47.99,
  "Chá Sublime Noite e Melatonina em cápsulas": 4.07,
  "Acetilcisteína com Vitamina C e Zinco sabor Laranja": 26.99,
};

const updates = [];
const lowConfidence = [];

for (const name of uniqueNames) {
  let price = null;
  if (Object.prototype.hasOwnProperty.call(manual, name)) {
    price = manual[name];
  } else {
    const b = bestUserPrice(name, userEntries);
    if (b.score >= 0.25) price = b.price;
    else lowConfidence.push(name);
  }
  if (price === null) price = 0;
  updates.push({ name, price });
}

const outPath = path.join(root, "supabase", "migrations", "20260511120000_add_product_price_and_seed.sql");
const lines = [
  `alter table public."Clinic+ - Catálogo Front B2B"`,
  `  add column if not exists price numeric(12,2) not null default 0;`,
  ``,
];

for (const { name, price } of updates) {
  lines.push(
    `update public."Clinic+ - Catálogo Front B2B" set price = ${price.toFixed(2)} where name = '${sqlEscape(name)}';`
  );
}

fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
console.log("Wrote", outPath);
console.log("Products:", updates.length);
console.log("Low confidence (left at 0 if no manual):", lowConfidence);
