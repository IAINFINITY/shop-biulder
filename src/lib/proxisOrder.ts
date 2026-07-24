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
  upstream?: {
    endpoint: string;
    method: string;
    proxy_http_status: number;
    status: number;
    body: unknown;
    error: string | null;
    debug: Record<string, unknown> | null;
  };
  debug?: Record<string, unknown>;
};

export class ProxisSendError extends Error {
  status: number;
  response: ProxisOrderResponse;

  constructor(status: number, response: ProxisOrderResponse, message?: string) {
    super(message || response.detail || response.error || `Proxis send failed (${status})`);
    this.name = "ProxisSendError";
    this.status = status;
    this.response = response;
  }
}

export async function sendProxisOrder(payload: ProxisOrderRequest): Promise<ProxisOrderResponse> {
  const response = await fetch("/api/proxis-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as ProxisOrderResponse;

  if (!response.ok) {
    throw new ProxisSendError(response.status, data);
  }

  return data;
}
