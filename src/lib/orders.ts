import { coercePrice } from "@/lib/formatMoney";
import {
  type OrderEnrichmentMaps,
  type Product,
  getProductCode,
  normalizeProductNameKey,
} from "@/lib/products";
import { resolveProductPrice } from "@/lib/pricing";

export const ORDERS_TABLE = "orders";

export interface OrderItem {
  product_id: string;
  product_code?: string;
  name: string;
  type: string;
  family: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  notes?: string;
}

export type SubmittedCartLine = {
  name: string;
  type: string;
  family: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  notes?: string;
};

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_company: string;
  customer_cnpj: string;
  items: OrderItem[];
  total_items: number;
  status: string;
  created_at: string;
  proxis_import_id?: number | null;
}

export type OrderTableLine = {
  code: string;
  name: string;
  type: string;
  family: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
};

export function formatOrderLineProductLabel(line: Pick<OrderTableLine, "name" | "type" | "family">): string {
  const meta = [line.type, line.family].filter(Boolean).join(" · ");
  return meta ? `${line.name} (${meta})` : line.name;
}

function isUuidFragmentCode(code: string): boolean {
  return /^[0-9A-F]{8}$/i.test(code.trim());
}

function isStaleAutoProductCode(code: string, productId: string): boolean {
  const normalized = code.replace(/-/g, "").toUpperCase();
  if (!normalized) return false;
  if (isUuidFragmentCode(normalized)) return true;
  if (productId) {
    const idPrefix = productId.replace(/-/g, "").toUpperCase().slice(0, 8);
    if (normalized === idPrefix) return true;
  }
  return false;
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function resolveOrderLineCode(raw: Record<string, unknown>, maps?: OrderEnrichmentMaps): string {
  const productId = typeof raw.product_id === "string" ? raw.product_id.trim() : "";
  const nameKey = normalizeProductNameKey(String(raw.name ?? ""));

  if (productId && maps?.codeByProductId.has(productId)) {
    return maps.codeByProductId.get(productId)!;
  }
  if (nameKey && maps?.codeByProductName.has(nameKey)) {
    return maps.codeByProductName.get(nameKey)!;
  }

  const fromItem = String(raw.product_code ?? "").trim();
  if (fromItem && !isStaleAutoProductCode(fromItem, productId)) {
    return fromItem;
  }

  if (productId) return productId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return "—";
}

function resolveLinePricing(
  raw: Record<string, unknown>,
  maps?: OrderEnrichmentMaps,
): { quantity: number; unitPrice: number; subtotal: number } {
  const quantity = typeof raw.quantity === "number" ? raw.quantity : Number(raw.quantity) || 0;

  const savedUnit = typeof raw.unit_price === "number" ? raw.unit_price : coercePrice(raw.unit_price);
  const savedLineTotal = typeof raw.line_total === "number" ? raw.line_total : coercePrice(raw.line_total);

  const productId = typeof raw.product_id === "string" ? raw.product_id.trim() : "";
  const nameKey = normalizeProductNameKey(String(raw.name ?? ""));

  let catalogUnit = productId && maps?.priceByProductId.has(productId) ? maps.priceByProductId.get(productId)! : 0;
  if (catalogUnit === 0 && nameKey && maps?.priceByProductName.has(nameKey)) {
    catalogUnit = maps.priceByProductName.get(nameKey)!;
  }

  let unitPrice = savedUnit > 0 ? savedUnit : catalogUnit;

  if (unitPrice === 0 && savedLineTotal > 0 && quantity > 0) {
    unitPrice = Math.round((savedLineTotal / quantity) * 100) / 100;
  }

  let subtotal = savedLineTotal > 0 ? savedLineTotal : Math.round(unitPrice * quantity * 100) / 100;

  if (quantity > 0 && unitPrice > 0) {
    subtotal = Math.round(unitPrice * quantity * 100) / 100;
  }

  return { quantity, unitPrice, subtotal };
}

export function parseOrderItemRow(
  raw: Record<string, unknown>,
  maps?: OrderEnrichmentMaps,
): OrderTableLine {
  const { quantity, unitPrice, subtotal } = resolveLinePricing(raw, maps);
  const name = String(raw.name ?? "").trim() || "—";
  const type = String(raw.type ?? "").trim();
  const family = String(raw.family ?? "").trim();

  return {
    code: resolveOrderLineCode(raw, maps),
    name,
    type,
    family,
    quantity,
    unitPrice,
    subtotal,
    notes: String(raw.notes ?? "").trim() || undefined,
  };
}

export function parseOrderTableLines(items: unknown, maps?: OrderEnrichmentMaps): OrderTableLine[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => parseOrderItemRow(toRecord(item), maps));
}

export function getOrderLinesGrandTotal(lines: OrderTableLine[]): number {
  return Math.round(lines.reduce((sum, line) => sum + line.subtotal, 0) * 100) / 100;
}

export function getOrderLinesQuantityTotal(lines: OrderTableLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function toOrderItems(
  cart: { product: Product; quantity: number; notes?: string }[],
  resolvePrice: (product: Product) => number = (product) => resolveProductPrice(product),
): OrderItem[] {
  return cart.map((item) => {
    const unit = resolvePrice(item.product);
    const qty = item.quantity;
    return {
      product_id: item.product.id,
      product_code: getProductCode(item.product),
      name: item.product.name,
      type: item.product.type,
      family: item.product.family,
      quantity: qty,
      unit_price: unit,
      line_total: Math.round(unit * qty * 100) / 100,
      notes: item.notes,
    };
  });
}
