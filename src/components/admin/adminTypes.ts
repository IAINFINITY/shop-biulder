import type { Product, ProductImageFit } from "@/lib/products";
import type { Json } from "@/integrations/supabase/types";

export type AdminSection =
  | "dashboard"
  | "banners"
  | "notificacoes"
  | "produtos"
  | "imagens"
  | "precos"
  | "pedidos"
  | "clientes"
  | "mensagens"
  | "usuarios"
  | "funcionarios"
  | "configuracoes";

export type AdminOrderSummaryLine = {
  unitPrice: number;
  quantity: number;
};

export type AdminDashboardOrder = {
  id: string;
  created_at: string;
  customer_user_id?: string | null;
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
  submission_key?: string | null;
  proxis_status?: string | null;
  proxis_error?: string | null;
  proxis_doc_ped_web?: string | null;
  proxis_attempts?: number | null;
  proxis_last_attempt_at?: string | null;
  proxis_synced_at?: string | null;
  customer_user_id?: string | null;
  customer_name: string;
  customer_company: string | null | undefined;
  customer_phone: string | null | undefined;
  customer_cnpj: string | null | undefined;
  customer_address_cep?: string | null;
  customer_address_street?: string | null;
  customer_address_number?: string | null;
  customer_address_complement?: string | null;
  customer_address_neighborhood?: string | null;
  customer_address_city?: string | null;
  customer_address_state?: string | null;
  customer_address_ibge?: string | null;
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
  /** Marca (Chá Mais, Clinic Mais). Vazio = sem marca definida. */
  brand: string;
  type: string;
  family: string;
  image_urls: string[];
  /** Descricao de cada foto, alinhada por indice com image_urls. */
  image_alts: string[];
  image_fit: ProductImageFit;
  active: boolean;
  is_promotion: boolean;
  is_featured: boolean;
  priceInput: string;
  /** Preco "de" exibido riscado. Vazio = sem promocao com desconto. */
  compareAtPriceInput: string;
  stockInput: string;
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
  customer_user_id?: string | null;
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
  /** Versao AVIF, servida antes do WebP. Nulo = banner so com WebP. */
  image_url_avif?: string | null;
  /** Arte 800x320 para telas pequenas. Nulo = usa a de desktop, cortada. */
  image_url_mobile?: string | null;
  image_url_mobile_avif?: string | null;
  link_url: string | null;
  sort_order: number;
  active: boolean;
  /** Area do site — ver `bannerSlots.ts`. Linha antiga cai em "topo". */
  slot: string;
  visible_to: string[] | null;
  created_at: string;
  updated_at: string;
};
