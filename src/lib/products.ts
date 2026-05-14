import { coercePrice } from "./formatMoney";

export const PRODUCTS_TABLE = "Clinic+ - Catálogo Front B2B";
export const PRODUCT_TYPES_TABLE = "product_types";

export interface Product {
  id: string;
  name: string;
  description: string;
  type: string;
  family: string;
  image_url: string | null;
  /** URLs ordenadas da galeria; vazio no legado usa só `image_url`. */
  image_urls?: string[] | null;
  active: boolean;
  /** Preço unitário em reais; ausente ou null no legado = 0 */
  price?: number | null;
  created_at: string;
  updated_at: string;
}

export function getProductUnitPrice(product: Pick<Product, "price">): number {
  return coercePrice(product.price);
}

/** URLs da galeria na ordem de exibição (principal = primeiro). */
export function getProductImageUrls(product: Pick<Product, "image_url" | "image_urls">): string[] {
  const fromColumn = Array.isArray(product.image_urls)
    ? product.image_urls.filter((u) => typeof u === "string" && u.trim() !== "")
    : [];
  if (fromColumn.length > 0) return fromColumn;
  if (product.image_url && String(product.image_url).trim() !== "") return [String(product.image_url).trim()];
  return [];
}

/** Normaliza linha do Supabase (preço, galeria de imagens). */
export function normalizeProductFromSupabaseRow(row: Record<string, unknown>): Product {
  const rawUrls = row.image_urls;
  const fromDb = Array.isArray(rawUrls)
    ? rawUrls.filter((u): u is string => typeof u === "string" && u.trim() !== "")
    : [];
  const legacyUrl = row.image_url;
  const legacy =
    typeof legacyUrl === "string" && legacyUrl.trim() !== "" ? [legacyUrl.trim()] : [];
  const gallery = fromDb.length > 0 ? fromDb : legacy;

  return {
    ...(row as Product),
    price: coercePrice(row.price),
    image_url: gallery[0] ?? null,
    image_urls: gallery.length > 0 ? gallery : null,
  };
}

export function getCartSubtotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + getProductUnitPrice(item.product) * item.quantity, 0);
}

export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
}

const CART_KEY = "clinicplus_cart";

export function getCart(): CartItem[] {
  const stored = localStorage.getItem(CART_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveCart(cart: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function getProductTypes(): string[] {
  return ["Chá", "Cápsula", "Solúvel"];
}
