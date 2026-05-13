export function formatBRL(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function coercePrice(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const s = String(value).trim().replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Accepts "12,34" or "12.34" from admin input */
export function parsePriceInput(raw: string): number {
  const t = raw.trim().replace(/\s/g, "");
  if (!t) return 0;
  const normalized = t.includes(",") && !t.includes(".") ? t.replace(",", ".") : t.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
