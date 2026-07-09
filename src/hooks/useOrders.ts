import { useQuery } from "@tanstack/react-query";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import type { Order } from "@/lib/orders";
import { ORDERS_TABLE } from "@/lib/orders";

const ORDERS_CACHE_PREFIX = "clinicplus_orders_cache";

function getOrdersCacheKey(queryKeySuffix: string) {
  return `${ORDERS_CACHE_PREFIX}_${queryKeySuffix}`;
}

function readCachedOrders(queryKeySuffix: string): Order[] | undefined {
  try {
    if (typeof window === "undefined") return undefined;

    const raw = window.sessionStorage.getItem(getOrdersCacheKey(queryKeySuffix));
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;

    return parsed as Order[];
  } catch {
    return undefined;
  }
}

function writeCachedOrders(queryKeySuffix: string, orders: Order[]) {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(getOrdersCacheKey(queryKeySuffix), JSON.stringify(orders));
  } catch {
    // Ignore cache failures and keep the live query as the source of truth.
  }
}

export function useOrders(enabled = true, queryKeySuffix = "default") {
  return useQuery<Order[]>({
    queryKey: ["orders", queryKeySuffix],
    enabled,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: () => readCachedOrders(queryKeySuffix),
    queryFn: async (): Promise<Order[]> => {
      const supabase = await loadSupabaseClient();
      const { data, error } = await supabase
        .from(ORDERS_TABLE)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const orders = data ?? [];
      writeCachedOrders(queryKeySuffix, orders);
      return orders;
    },
  });
}
