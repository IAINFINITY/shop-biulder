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
  active: boolean;
  /** Preço unitário em reais; ausente ou null no legado = 0 */
  price?: number | null;
  created_at: string;
  updated_at: string;
}

export function getProductUnitPrice(product: Pick<Product, "price">): number {
  return coercePrice(product.price);
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
