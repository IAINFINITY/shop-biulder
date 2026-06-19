import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CUSTOMER_PRICE_OVERRIDES_TABLE,
  buildCustomerPriceMap,
  normalizeCustomerType,
  type CustomerPriceOverride,
} from "@/lib/pricing";

export function useCustomerPricing(customerType?: string | null) {
  const normalizedType = normalizeCustomerType(customerType);

  return useQuery({
    queryKey: ["customer-pricing", normalizedType],
    enabled: Boolean(customerType),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(CUSTOMER_PRICE_OVERRIDES_TABLE)
        .select("customer_type, product_code, price")
        .eq("customer_type", normalizedType)
        .eq("active", true);

      if (error) throw error;
      return buildCustomerPriceMap((data ?? []) as CustomerPriceOverride[]);
    },
    initialData: new Map<string, number>(),
  });
}
