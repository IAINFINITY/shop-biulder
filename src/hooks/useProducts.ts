import { subcategoriasDoProduto } from "@/lib/subcategorias";
import { useQuery } from "@tanstack/react-query";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import {
  type Product,
  PRODUCTS_TABLE,
  PRODUCT_OPTIONAL_COLUMNS,
  buildProductSelectColumns,
  detectMissingProductColumn,
  normalizeProductFromSupabaseRow,
} from "@/lib/products";

export type UseProductsOptions = {
  includeInactive: boolean;
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
      const supabase = await loadSupabaseClient();
      const runQuery = (columns: string) => {
        let q = supabase.from(PRODUCTS_TABLE).select(columns).order("name");
        if (!includeInactive) {
          q = q.eq("active", true);
        }
        return q;
      };

      // Pede tudo e vai derrubando a coluna que o banco nao tiver ainda, uma por
      // tentativa. Cobre qualquer combinacao de migrations pendentes sem
      // precisar enumerar as variacoes na mao.
      const omitted: string[] = [];
      let data: unknown[] | null = null;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= PRODUCT_OPTIONAL_COLUMNS.length; attempt++) {
        const result = await runQuery(buildProductSelectColumns(omitted));
        if (!result.error) {
          data = result.data ?? [];
          break;
        }

        lastError = result.error;
        const missingColumn = detectMissingProductColumn(result.error.message);
        if (!missingColumn || omitted.includes(missingColumn)) throw result.error;
        omitted.push(missingColumn);
      }

      if (!data) throw lastError ?? new Error("Não foi possível carregar produtos.");
      const products = data.map((row) => normalizeProductFromSupabaseRow(row));
      writeCachedProducts(includeInactive, products);
      return products;
    },
  });
}

export function useProductFamilies() {
  const { data: products } = useProducts();
  if (!products) return [];
  // Achata as listas: subcategoria que so aparece como secundaria tambem
  // precisa existir no seletor e na arvore.
  return [...new Set(products.flatMap(subcategoriasDoProduto))].sort();
}

export function useProductTypes() {
  const { data: products } = useProducts();
  if (!products) return [];
  return [...new Set(products.map((p) => p.type))].sort();
}
