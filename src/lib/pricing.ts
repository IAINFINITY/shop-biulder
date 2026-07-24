import type { CartItem, Product } from "@/lib/products";
import { getProductUnitPrice } from "@/lib/products";

export const CUSTOMER_TYPES = ["cliente", "lojista", "distribuidor", "funcionario"];

export const DEFAULT_CUSTOMER_TYPE = "cliente";

export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  cliente: "Cliente",
  lojista: "Lojista",
  distribuidor: "Distribuidor",
  funcionario: "Funcionário",
};

export function customerTypeLabel(value: string): string {
  if (CUSTOMER_TYPE_LABELS[value]) return CUSTOMER_TYPE_LABELS[value];
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export const CUSTOMER_PRICE_OVERRIDES_TABLE = "customer_price_overrides";

export type CustomerPriceOverride = {
  customer_type: string;
  proxis_tpr_id: number | null;
  product_code: string;
  price: number;
  active: boolean;
};

export function normalizeCustomerType(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim().toLowerCase();
  return DEFAULT_CUSTOMER_TYPE;
}

export function getCustomerTypeLabel(value: unknown): string {
  return customerTypeLabel(normalizeCustomerType(value));
}

function normalizeProductCode(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function buildCustomerPriceMap(overrides: Pick<CustomerPriceOverride, "product_code" | "price">[]) {
  const map = new Map<string, number>();
  for (const override of overrides) {
    const code = normalizeProductCode(override.product_code);
    if (!code) continue;
    const price = Number(override.price);
    if (!Number.isFinite(price) || price < 0) continue;
    map.set(code, Math.round(price * 100) / 100);
  }
  return map;
}

export function resolveProductPrice(
  product: Pick<Product, "price" | "product_code">,
  priceOverrides: Map<string, number>,
): number {
  const code = normalizeProductCode(product.product_code);
  if (code && priceOverrides.has(code)) {
    return priceOverrides.get(code)!;
  }
  return getProductUnitPrice(product);
}

export function calculateCartSubtotal(
  cart: CartItem[],
  priceOverrides: Map<string, number>,
): number {
  return Math.round(
    cart.reduce((sum, item) => sum + resolveProductPrice(item.product, priceOverrides) * item.quantity, 0) * 100,
  ) / 100;
}
