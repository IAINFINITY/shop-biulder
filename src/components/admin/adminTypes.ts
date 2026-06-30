import type { Product } from "@/lib/products";
import type { Json } from "@/integrations/supabase/types";
import type { CustomerType } from "@/lib/pricing";

export type AdminSection = "dashboard" | "produtos" | "precos" | "pedidos" | "clientes";

export type AdminOrderSummaryLine = {
  unitPrice: number;
  quantity: number;
};

export type AdminDashboardOrder = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_company: string | null | undefined;
  customer_phone: string | null | undefined;
  customer_cnpj: string | null | undefined;
  status: string;
  total_items: number;
  proxis_import_id: number | null | undefined;
  items: AdminOrderSummaryLine[];
};

export type AdminOrderRow = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_company: string | null | undefined;
  customer_phone: string | null | undefined;
  customer_cnpj: string | null | undefined;
  status: string;
  total_items: number;
  proxis_import_id: number | null;
  items: Json;
};

export type AdminProductFormState = {
  id?: string;
  name: string;
  description: string;
  type: string;
  family: string;
  image_urls: string[];
  active: boolean;
  priceInput: string;
  productCode: string;
};

export type AdminCustomerSummary = {
  userId: string | null;
  name: string;
  company: string | null | undefined;
  phone: string | null | undefined;
  cnpj: string | null | undefined;
  customerType: CustomerType | null;
  total: number;
  orders: number;
};

export type AdminRecentOrder = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_company: string | null | undefined;
  customer_phone: string | null | undefined;
  customer_cnpj: string | null | undefined;
  status: string;
  total_items: number;
  proxis_import_id: string | null | undefined;
  items: Array<{
    unitPrice: number;
    quantity: number;
  }>;
};

export type AdminProduct = Product;
