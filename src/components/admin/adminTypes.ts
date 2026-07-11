import type { Product } from "@/lib/products";
import type { Json } from "@/integrations/supabase/types";

export type AdminSection =
  | "dashboard"
  | "banners"
  | "notificacoes"
  | "produtos"
  | "precos"
  | "pedidos"
  | "clientes"
  | "mensagens"
  | "usuarios"
  | "configuracoes";

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
  customer_observation?: string | null | undefined;
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
  customer_observation?: string | null | undefined;
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
  is_promotion: boolean;
  priceInput: string;
  productCode: string;
  visible_to: string[];
};

export type AdminCustomerSummary = {
  userId: string | null;
  name: string;
  company: string | null | undefined;
  phone: string | null | undefined;
  cnpj: string | null | undefined;
  customerType: string | null;
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
  customer_observation?: string | null | undefined;
  status: string;
  total_items: number;
  proxis_import_id: number | null | undefined;
  items: Array<{
    unitPrice: number;
    quantity: number;
  }>;
};

export type AdminProduct = Product;

export type AdminBanner = {
  id: string;
  label: string;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  active: boolean;
  visible_to: string[] | null;
  created_at: string;
  updated_at: string;
};
