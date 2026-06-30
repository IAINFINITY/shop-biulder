import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CUSTOMER_PRICE_OVERRIDES_TABLE,
  buildCustomerPriceMap,
  normalizeCustomerType,
  type CustomerPriceOverride,
} from "@/lib/pricing";

export function useCustomerPricing(customerType: string | null, proxisTprId: number | null) {
  const normalizedType = normalizeCustomerType(customerType);
  const normalizedTprId = typeof proxisTprId === "number" && Number.isFinite(proxisTprId) ? Math.trunc(proxisTprId) : null;

  return useQuery({
    queryKey: ["customer-pricing", normalizedType, normalizedTprId],
    enabled: Boolean(customerType) || normalizedTprId !== null,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (normalizedTprId !== null) {
        const { data, error } = await supabase
          .from(CUSTOMER_PRICE_OVERRIDES_TABLE)
          .select("customer_type, proxis_tpr_id, product_code, price")
          .eq("proxis_tpr_id", normalizedTprId)
          .eq("active", true);

        if (error) throw error;
        if (data && data.length > 0) {
          return buildCustomerPriceMap((data ?? []) as CustomerPriceOverride[]);
        }
      }

      const { data, error } = await supabase
        .from(CUSTOMER_PRICE_OVERRIDES_TABLE)
        .select("customer_type, proxis_tpr_id, product_code, price")
        .eq("customer_type", normalizedType)
        .eq("active", true);

      if (error) throw error;
      return buildCustomerPriceMap((data ?? []) as CustomerPriceOverride[]);
    },
    initialData: new Map<string, number>(),
  });
}
