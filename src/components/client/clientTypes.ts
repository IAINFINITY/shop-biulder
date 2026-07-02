import type { Json } from "@/integrations/supabase/types";

export type ClientSection = "resumo" | "empresa" | "pedidos" | "seguranca" | "mensagens";

export type ClientOrderRow = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_company: string;
  customer_phone: string;
  customer_cnpj: string;
  status: string;
  total_items: number;
  items: Json;
};
