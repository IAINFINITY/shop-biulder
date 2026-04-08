import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ORDERS_TABLE } from "@/lib/orders";

export function useOrders(enabled = true) {
  return useQuery({
    queryKey: ["orders"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(ORDERS_TABLE)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
