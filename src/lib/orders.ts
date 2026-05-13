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
