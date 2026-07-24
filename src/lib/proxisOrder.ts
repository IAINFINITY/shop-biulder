export type ProxisOrderAddress = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  ibge: string;
};

export type ProxisOrderItem = {
  product_code: string;
  quantity: number;
  unit_price: number;
  name: string;
};

export type ProxisOrderRequest = {
  customer_name: string;
  customer_cnpj: string;
  customer_company: string;
  customer_observation?: string | null;
  address: ProxisOrderAddress;
  items: ProxisOrderItem[];
  note?: string | null;
  pes_id_ven?: number | string | null;
  representative_id?: number | string | null;
};

export type ProxisOrderResponse = {
  success?: boolean;
  doc_ped_web?: string;
  pes_id?: number;
  items_count?: number;
  failed_products?: string[];
  proxsis_response?: unknown;
  error?: string;
  detail?: string;
};

export async function sendProxisOrder(payload: ProxisOrderRequest): Promise<ProxisOrderResponse> {
  const response = await fetch("/api/proxis-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as ProxisOrderResponse;

  if (!response.ok) {
    throw new Error(data.error || data.detail || `Proxis send failed (${response.status})`);
  }

  return data;
}
