import type { OrderEnrichmentMaps } from "@/lib/products";

export type OrderExportInput = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_company: string;
  customer_phone: string;
  customer_cnpj: string;
  customer_tpr_id: number | null;
  status: string;
  items: unknown;
  proxis_import_id: number | null;
  enrichmentMaps: OrderEnrichmentMaps;

  /**
   * O numero que a lista mostra, para o PDF falar do mesmo pedido que a tela.
   *
   * Opcional porque o TXT e o XLSX nao usam — eles identificam o pedido pelo
   * `proxis_import_id` e pelo `id`.
   */
  numeroDoPedido?: number;

  /**
   * O endereco **gravado no pedido**, e nao o do cadastro de hoje.
   *
   * Quem separa a caixa le este PDF; sem o endereco ele responde "o que" e
   * nunca "para onde". Opcionais porque pedido antigo pode nao ter todos.
   */
  customer_observation?: string | null;
  customer_address_cep?: string | null;
  customer_address_street?: string | null;
  customer_address_number?: string | null;
  customer_address_complement?: string | null;
  customer_address_neighborhood?: string | null;
  customer_address_city?: string | null;
  customer_address_state?: string | null;
};
