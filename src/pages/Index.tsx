import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CatalogProductCard } from "@/components/catalogo/CatalogProductCard";
import { CartDrawer } from "@/components/carrinho/CartDrawer";
import { CartTotalBar } from "@/components/carrinho/CartTotalBar";
import { StoreHeader } from "@/components/catalogo/StoreHeader";
import { StoreHeroBanner } from "@/components/catalogo/StoreHeroBanner";
import { CatalogFiltersBarV2 } from "@/components/catalogo/CatalogFiltersBarStickyFilters";
import { Product, CartItem, getCart, getProductImageUrls, saveCart } from "@/lib/products";
import { descriptionIncludesQuery } from "@/lib/richText";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerPricing } from "@/hooks/useCustomerPricing";
import { calculateCartSubtotal, resolveProductPrice } from "@/lib/pricing";

const INITIAL_PRODUCTS_VISIBLE = 12;
const PRODUCTS_VISIBLE_STEP = 12;
const CATALOG_VIEW_STORAGE_KEY = "clinicplus_catalog_view";

type CatalogViewState = {
  search: string;
  selectedType: string | null;
  selectedFamily: string | null;
  visibleProducts: number;
  scrollY: number;
};

function readCatalogViewState(): CatalogViewState | null {
  try {
    const raw = typeof window === "undefined" ? null : window.sessionStorage.getItem(CATALOG_VIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CatalogViewState>;
    return {
      search: typeof parsed.search === "string" ? parsed.search : "",
      selectedType: typeof parsed.selectedType === "string" ? parsed.selectedType : null,
      selectedFamily: typeof parsed.selectedFamily === "string" ? parsed.selectedFamily : null,
      visibleProducts:
        typeof parsed.visibleProducts === "number" && Number.isFinite(parsed.visibleProducts)
          ? Math.max(INITIAL_PRODUCTS_VISIBLE, parsed.visibleProducts)
          : INITIAL_PRODUCTS_VISIBLE,
      scrollY:
        typeof parsed.scrollY === "number" && Number.isFinite(parsed.scrollY) ? Math.max(0, parsed.scrollY) : 0,
    };
  } catch {
    return null;
  }
}

function saveCatalogViewState(state: CatalogViewState) {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(CATALOG_VIEW_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep the catalog usable even when session storage is unavailable.
  }
}

export default function Index() {
  const { data: products = [], isLoading } = useProducts();
  const { customerProfile } = useAuth();
  const { data: customerPriceMap = new Map<string, number>() } = useCustomerPricing(
    customerProfile?.customer_type,
  );
  const [cart, setCart] = useState<CartItem[]>(getCart);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [search, setSearch] = useState(() => readCatalogViewState()?.search ?? "");
  const [selectedType, setSelectedType] = useState<string | null>(() => readCatalogViewState()?.selectedType ?? null);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(
    () => readCatalogViewState()?.selectedFamily ?? null,
  );
  const [visibleProducts, setVisibleProducts] = useState(
    () => readCatalogViewState()?.visibleProducts ?? INITIAL_PRODUCTS_VISIBLE,
  );
  const catalogRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const restoredScrollRef = useRef(false);

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || restoredScrollRef.current) return;

    restoredScrollRef.current = true;
    const savedState = readCatalogViewState();
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: savedState?.scrollY ?? 0, left: 0, behavior: "auto" });

    return () => {
      window.history.scrollRestoration = "auto";
    };
  }, []);

  useEffect(() => {
    setVisibleProducts(INITIAL_PRODUCTS_VISIBLE);
  }, [search, selectedType, selectedFamily]);

  useEffect(() => {
    return () => {
      saveCatalogViewState({
        search,
        selectedType,
        selectedFamily,
        visibleProducts,
        scrollY: typeof window === "undefined" ? 0 : window.scrollY,
      });
    };
  }, [search, selectedType, selectedFamily, visibleProducts]);

  const categoryTypes = useMemo(() => [...new Set(products.map((p) => p.type))].sort(), [products]);
  const categoryFamilies = useMemo(() => [...new Set(products.map((p) => p.family))].sort(), [products]);
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      counts.set(product.type, (counts.get(product.type) ?? 0) + 1);
    }
    return counts;
  }, [products]);
  const familyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      counts.set(product.family, (counts.get(product.family) ?? 0) + 1);
    }
    return counts;
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (
        search &&
        !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !descriptionIncludesQuery(p.description, search)
      ) {
        return false;
      }
      if (selectedType && p.type !== selectedType) return false;
      if (selectedFamily && p.family !== selectedFamily) return false;
      return true;
    });
  }, [products, search, selectedType, selectedFamily]);

  const visibleFiltered = useMemo(() => filtered.slice(0, visibleProducts), [filtered, visibleProducts]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    if (isLoading || visibleProducts >= filtered.length) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisibleProducts((current) => Math.min(current + PRODUCTS_VISIBLE_STEP, filtered.length));
      },
      {
        root: null,
        rootMargin: "360px 0px",
        threshold: 0.05,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filtered.length, isLoading, visibleProducts]);

  const searchSuggestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];

    return filtered
      .map((product) => {
        const normalizedName = product.name.toLowerCase();
        const normalizedCode = product.product_code?.toLowerCase() ?? "";
        const nameStarts = normalizedName.startsWith(query) ? 3 : 0;
        const nameContains = normalizedName.includes(query) ? 2 : 0;
        const codeMatches = normalizedCode.includes(query) ? 2 : 0;
        const descriptionMatches = descriptionIncludesQuery(product.description, search) ? 1 : 0;

        return {
          product,
          score: nameStarts + nameContains + codeMatches + descriptionMatches,
        };
      })
      .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
      .map(({ product }) => ({
        id: product.id,
        name: product.name,
        type: product.type,
        family: product.family,
        imageUrl: getProductImageUrls(product)[0] ?? product.image_url ?? null,
        price: resolveProductPrice(product, customerPriceMap),
      }));
  }, [filtered, search, customerPriceMap]);

  const cartIds = useMemo(() => new Set(cart.map((c) => c.product.id)), [cart]);

  const openCart = useCallback(() => setIsCartOpen(true), []);

  const addToCart = useCallback(
    (product: Product, quantity = 1) => {
      const safeQuantity = Number.isFinite(quantity) ? Math.max(1, quantity) : 1;
      setCart((prev) => {
        const existing = prev.find((c) => c.product.id === product.id);
        if (existing) {
          return prev.map((c) =>
            c.product.id === product.id ? { ...c, quantity: safeQuantity } : c,
          );
        }
        return [...prev, { product, quantity: safeQuantity }];
      });
    },
    [],
  );

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev.map((c) => (c.product.id === id ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c)),
    );
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const cartSubtotal = useMemo(
    () => calculateCartSubtotal(cart, customerPriceMap),
    [cart, customerPriceMap],
  );
  const cartUnitCount = useMemo(() => cart.reduce((s, c) => s + c.quantity, 0), [cart]);

  const showAllProducts = useCallback(() => {
    setSearch("");
    setSelectedType(null);
    setSelectedFamily(null);
    setVisibleProducts(INITIAL_PRODUCTS_VISIBLE);
    catalogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className={`min-h-screen bg-background ${cart.length > 0 ? "pb-28" : ""}`}>
      <StoreHeader
        search={search}
        onSearchChange={setSearch}
        searchSuggestions={searchSuggestions}
        cartSlot={
          <CartDrawer
            cart={cart}
            onUpdateQuantity={updateQuantity}
            onRemove={removeFromCart}
            onClear={clearCart}
            open={isCartOpen}
            onOpenChange={setIsCartOpen}
            resolveUnitPrice={(product) => resolveProductPrice(product, customerPriceMap)}
          />
        }
      />

      <StoreHeroBanner />

      <div
        ref={catalogRef}
        id="catalogo-produtos"
        className="container mx-auto max-w-[1400px] px-4 py-6 scroll-mt-[calc(var(--page-header-shell-height,88px)+var(--catalog-filters-bar-height,132px)+1.5rem)]"
      >
        <CatalogFiltersBarV2
          categoryTypes={categoryTypes}
          categoryFamilies={categoryFamilies}
          typeCounts={typeCounts}
          familyCounts={familyCounts}
          resultCount={filtered.length}
          isLoading={isLoading}
          hasSearch={search.trim().length > 0}
          searchQuery={search.trim()}
          selectedType={selectedType}
          selectedFamily={selectedFamily}
          onTypeChange={setSelectedType}
          onFamilyChange={setSelectedFamily}
          onShowAllProducts={showAllProducts}
        />

        {isLoading ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-[0_12px_32px_rgba(16,24,40,0.04)]"
              >
                <Skeleton className="aspect-[1/1] w-full rounded-none" />
                <div className="space-y-3 p-4">
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-5 w-3/4 rounded-md" />
                  <Skeleton className="h-4 w-5/6 rounded-md" />
                  <Skeleton className="h-4 w-1/3 rounded-md" />
                  <Skeleton className="h-10 w-full rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <p className="text-lg font-medium">Nenhum produto encontrado</p>
            <p className="mt-1 text-sm">Tente ajustar os filtros ou a busca.</p>
          </div>
        ) : (
          <div className="mt-4">
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleFiltered.map((product) => (
                <CatalogProductCard
                  key={product.id}
                  product={product}
                  price={resolveProductPrice(product, customerPriceMap)}
                  onAdd={addToCart}
                  inCart={cartIds.has(product.id)}
                />
              ))}
            </div>
            {visibleProducts < filtered.length ? (
              <div ref={loadMoreRef} className="py-8 text-center text-sm text-muted-foreground">
                Carregando mais produtos...
              </div>
            ) : null}
          </div>
        )}
      </div>

      <CartTotalBar
        total={cartSubtotal}
        itemCount={cartUnitCount}
        visible={cart.length > 0}
        onOpenCart={openCart}
      />
    </div>
  );
}
