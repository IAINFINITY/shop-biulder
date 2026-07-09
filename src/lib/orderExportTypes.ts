import type { OrderEnrichmentMaps } from "@/lib/products";

export type OrderExportInput = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_company: string;
  customer_phone: string;
  customer_cnpj: string;
  status: string;
  items: unknown;
  proxis_import_id: number | null;
  enrichmentMaps: OrderEnrichmentMaps;
};
