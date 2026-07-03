import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CUSTOMER_PROFILES_TABLE, type CustomerProfile } from "@/lib/customerProfile";

export function useAdminCustomerProfiles(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-customer-profiles"],
    enabled,
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(CUSTOMER_PROFILES_TABLE)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as CustomerProfile[];
    },
    initialData: [] as CustomerProfile[],
  });
}
