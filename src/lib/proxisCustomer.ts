import { loadSupabaseClient } from "@/lib/loadSupabaseClient";

export type ProxisCustomerLookupResult = {
  found: boolean;
  pes_id: number | null;
  tpr_id: number | null;
  customer_name: string | null;
  customer_company: string | null;
};

const EMPTY_LOOKUP_RESULT: ProxisCustomerLookupResult = {
  found: false,
  pes_id: null,
  tpr_id: null,
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
