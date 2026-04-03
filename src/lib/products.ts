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
  created_at: string;
  updated_at: string;
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
