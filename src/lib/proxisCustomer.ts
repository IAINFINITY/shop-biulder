import { loadSupabaseClient } from "@/lib/loadSupabaseClient";

export type ProxisCustomerLookupResult = {
  found: boolean;
  pes_id: number | null;
  tpr_id: number | null;
  tpr_description: string | null;
  cpa_id: number | null;
  cpa_description: string | null;
  tti_id: number | null;
  tti_description: string | null;
  oin_id: number | null;
  por_id: number | null;
  operation_source: "customer_order" | "price_table_default" | null;
  customer_name: string | null;
  customer_company: string | null;
};

const EMPTY_LOOKUP_RESULT: ProxisCustomerLookupResult = {
  found: false,
  pes_id: null,
  tpr_id: null,
  tpr_description: null,
  cpa_id: null,
  cpa_description: null,
  tti_id: null,
  tti_description: null,
  oin_id: null,
  por_id: null,
  operation_source: null,
  customer_name: null,
  customer_company: null,
};

export async function lookupProxisCustomerByCnpj(cnpj: string): Promise<ProxisCustomerLookupResult> {
  const response = await fetch("/api/proxis-customer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cnpj }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error((errBody as { error: string }).error || `Proxsis lookup failed (${response.status})`);
  }

  const data = (await response.json().catch(() => null)) as Partial<ProxisCustomerLookupResult> | null;
  return {
    found: Boolean(data.found),
    pes_id: typeof data.pes_id === "number" && Number.isFinite(data.pes_id) ? Math.trunc(data.pes_id) : null,
    tpr_id: typeof data.tpr_id === "number" && Number.isFinite(data.tpr_id) ? Math.trunc(data.tpr_id) : null,
    tpr_description: typeof data.tpr_description === "string" ? data.tpr_description : null,
    cpa_id: typeof data.cpa_id === "number" && Number.isFinite(data.cpa_id) ? Math.trunc(data.cpa_id) : null,
    cpa_description: typeof data.cpa_description === "string" ? data.cpa_description : null,
    tti_id: typeof data.tti_id === "number" && Number.isFinite(data.tti_id) ? Math.trunc(data.tti_id) : null,
    tti_description: typeof data.tti_description === "string" ? data.tti_description : null,
    oin_id: typeof data.oin_id === "number" && Number.isFinite(data.oin_id) ? Math.trunc(data.oin_id) : null,
    por_id: typeof data.por_id === "number" && Number.isFinite(data.por_id) ? Math.trunc(data.por_id) : null,
    operation_source: data.operation_source === "customer_order" || data.operation_source === "price_table_default"
      ? data.operation_source
      : null,
    customer_name: typeof data.customer_name === "string" ? data.customer_name : null,
    customer_company: typeof data.customer_company === "string" ? data.customer_company : null,
  };
}

export async function syncCustomerProxisLink(cnpj: string, userId?: string | null) {
  const lookup = await lookupProxisCustomerByCnpj(cnpj).catch((err) => {
    console.error("[proxisCustomer] lookupProxisCustomerByCnpj failed:", err);
    return EMPTY_LOOKUP_RESULT;
  });
  const supabase = await loadSupabaseClient();
  const rpcParams: Record<string, unknown> = {
    p_proxis_pes_id: lookup.pes_id,
    p_proxis_tpr_id: lookup.tpr_id,
    p_proxis_found: lookup.found,
  };
  if (userId) {
    rpcParams.p_user_id = userId;
  }
  console.log("[proxisCustomer] Chamando sync_customer_proxis_link com params:", rpcParams);
  const { data, error } = await supabase.rpc("sync_customer_proxis_link", rpcParams);

  if (error) {
    console.error("[proxisCustomer] sync_customer_proxis_link RPC error:", error);
    throw new Error(error.message || JSON.stringify(error));
  }
  console.log("[proxisCustomer] sync_customer_proxis_link sucesso:", data);
  return lookup;
}
