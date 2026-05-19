import { coercePrice } from "@/lib/formatMoney";
import { type Product, getProductUnitPrice } from "@/lib/products";

export const ORDERS_TABLE = "orders";

export interface OrderItem {
  product_id: string;
  name: string;
  type: string;
  family: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  notes?: string;
}

/** Resumo somente leitura do carrinho enviado (página de obrigado). */
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
}

export type OrderTableLine = {
  code: string;
  product: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
};

export function formatProductCode(productId: unknown): string {
  if (typeof productId !== "string" || !productId.trim()) return "—";
  return productId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function parseOrderItemRow(raw: Record<string, unknown>): OrderTableLine {
  const qty = typeof raw.quantity === "number" ? raw.quantity : Number(raw.quantity) || 0;
  const unit = typeof raw.unit_price === "number" ? raw.unit_price : coercePrice(raw.unit_price);
  const subtotal =
    typeof raw.line_total === "number" ? raw.line_total : Math.round(unit * qty * 100) / 100;
  const name = String(raw.name ?? "").trim() || "—";
  const type = String(raw.type ?? "").trim();
  const family = String(raw.family ?? "").trim();
  const meta = [type, family].filter(Boolean).join(" · ");
  const product = meta ? `${name} (${meta})` : name;

  return {
    code: formatProductCode(raw.product_id),
    product,
    quantity: qty,
    unitPrice: unit,
    subtotal,
    notes: String(raw.notes ?? "").trim() || undefined,
  };
}

export function parseOrderTableLines(items: unknown): OrderTableLine[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) =>
    parseOrderItemRow(typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {}),
  );
}

export function getOrderLinesGrandTotal(lines: OrderTableLine[]): number {
  return Math.round(lines.reduce((sum, line) => sum + line.subtotal, 0) * 100) / 100;
}

export function toOrderItems(cart: { product: Product; quantity: number; notes?: string }[]): OrderItem[] {
  return cart.map((item) => {
    const unit = getProductUnitPrice(item.product);
    const qty = item.quantity;
    return {
      product_id: item.product.id,
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
