import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  type Product,
  PRODUCTS_TABLE,
  PRODUCT_SELECT_COLUMNS,
  PRODUCT_SELECT_COLUMNS_LEGACY,
  PRODUCT_SELECT_COLUMNS_NO_CODE,
  PRODUCT_SELECT_COLUMNS_NO_GALLERY,
  normalizeProductFromSupabaseRow,
  isMissingImageUrlsColumnError,
  isMissingProductCodeColumnError,
} from "@/lib/products";

export type UseProductsOptions = {
  includeInactive?: boolean;
};

const PRODUCTS_CACHE_PREFIX = "clinicplus_products_cache";

function getProductsCacheKey(includeInactive: boolean) {
  return `${PRODUCTS_CACHE_PREFIX}_${includeInactive ? "all" : "active"}`;
}

function readCachedProducts(includeInactive: boolean): Product[] | undefined {
  try {
    if (typeof window === "undefined") return undefined;

    const raw = window.localStorage.getItem(getProductsCacheKey(includeInactive));
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return parsed.map((row) => normalizeProductFromSupabaseRow(row));
  } catch {
    return undefined;
  }
}

function writeCachedProducts(includeInactive: boolean, products: Product[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(getProductsCacheKey(includeInactive), JSON.stringify(products));
  } catch {
    // Ignore cache write failures and keep the live query as the source of truth
  }
}

export function useProducts(options?: UseProductsOptions) {
  const includeInactive = options?.includeInactive === true;
  return useQuery({
    queryKey: ["products", includeInactive ? "all" : "active"],
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: 1,
    initialData: () => readCachedProducts(includeInactive),
    queryFn: async () => {
      const runQuery = (columns: string) => {
        let q = supabase.from(PRODUCTS_TABLE).select(columns).order("name");
        if (!includeInactive) {
          q = q.eq("active", true);
        }
        return q;
      };

      const columnSets = [
        PRODUCT_SELECT_COLUMNS,
        PRODUCT_SELECT_COLUMNS_NO_GALLERY,
        PRODUCT_SELECT_COLUMNS_NO_CODE,
        PRODUCT_SELECT_COLUMNS_LEGACY,
      ] as const;

      let data: unknown[] | null = null;
      let lastError: Error | null = null;

      for (const columns of columnSets) {
        const result = await runQuery(columns);
        if (!result.error) {
          data = result.data ?? [];
          break;
        }
        lastError = result.error;
        const missingColumn =
          isMissingImageUrlsColumnError(result.error.message) ||
          isMissingProductCodeColumnError(result.error.message);
        if (!missingColumn) throw result.error;
      }

      if (!data) throw lastError ?? new Error("Nao foi possivel carregar produtos.");
      const products = data.map((row) => normalizeProductFromSupabaseRow(row));
      writeCachedProducts(includeInactive, products);
      return products;
    },
  });
}

export function useProductFamilies() {
  const { data: products } = useProducts();
  if (!products) return [];
  return [...new Set(products.map((p) => p.family))].sort();
}

export function useProductTypes() {
  const { data: products } = useProducts();
  if (!products) return [];
  return [...new Set(products.map((p) => p.type))].sort();
}
