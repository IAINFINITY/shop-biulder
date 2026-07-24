import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef, memo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CatalogProductCard } from "@/components/catalogo/CatalogProductCard";
import { StoreHeroBanner } from "@/components/catalogo/StoreHeroBanner";
import { type CatalogSortMode } from "@/components/catalogo/CatalogFiltersBarStickyFilters";
import { CatalogThemeSections } from "@/components/catalogo/CatalogThemeSections";
import { QuickView } from "@/components/catalogo/QuickView";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { descriptionIncludesQuery } from "@/lib/richTextPure";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { useCart } from "@/hooks/useCart";
import { useCustomerPricing } from "@/hooks/useCustomerPricing";
import { resolveProductPrice } from "@/lib/pricing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, ChevronUp, Heart } from "lucide-react";
import { readAuthBootstrapSnapshot, readCachedCustomerProfile } from "@/lib/customerProfileSnapshot";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { useWishlist } from "@/hooks/useWishlist";
import { useDebounce } from "@/hooks/useDebounce";
import { useComparison } from "@/hooks/useComparison";
import { CompareBar } from "@/components/catalogo/CompareBar";
import { CompareModal } from "@/components/catalogo/CompareModal";
import { usePublicLayout } from "@/components/layout/PublicLayout";
import type { Product } from "@/lib/products";

const INITIAL_PRODUCTS_VISIBLE = 6;
const PRODUCTS_VISIBLE_STEP = 12;
const CATALOG_VIEW_STORAGE_KEY = "clinicplus_catalog_view";

type CatalogViewState = {
  search: string;
  selectedType: string | null;
  selectedFamily: string | null;
  visibleProducts: number;
  scrollY: number;
  sortMode: CatalogSortMode;
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
      visibleProducts: INITIAL_PRODUCTS_VISIBLE,
      scrollY:
        typeof parsed.scrollY === "number" && Number.isFinite(parsed.scrollY) ? Math.max(0, parsed.scrollY) : 0,
      sortMode:
        parsed.sortMode === "best_sellers" ||
        parsed.sortMode === "price_asc" ||
        parsed.sortMode === "price_desc" ||
        parsed.sortMode === "name_asc"
          ? parsed.sortMode
          : "relevance",
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

const SORT_LABELS: Record<CatalogSortMode, string> = {
  relevance: "Relevância",
  best_sellers: "Mais vendidos",
  price_asc: "Menor preço",
  price_desc: "Maior preço",
  name_asc: "Nome A-Z",
};

const SortModeControl = memo(function SortModeControl({
  value,
  onChange,
}: {
  value: CatalogSortMode;
  onChange: (mode: CatalogSortMode) => void;
}) {
  const handleChange = useCallback((v: string) => onChange(v as CatalogSortMode), [onChange]);
  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="h-8 w-full gap-1.5 rounded-full border-border/60 bg-background px-3 text-xs font-medium shadow-none hover:bg-muted/40 sm:w-auto [&>svg]:h-3.5 [&>svg]:w-3.5">
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="rounded-xl border-border/60">
        {(Object.entries(SORT_LABELS) as [CatalogSortMode, string][]).map(([mode, label]) => (
          <SelectItem key={mode} value={mode} className="rounded-lg text-sm">
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

export default function Index() {
  const location = useLocation();
  const { data: products = [], isLoading } = useProducts();
  const authSnapshot = readAuthBootstrapSnapshot();
  const customerProfile = readCachedCustomerProfile(authSnapshot?.user.id ?? null);
  const { data: orderHistory = [] } = useOrders(Boolean(customerProfile), "catalog");
  const customerType = customerProfile?.customer_type ?? null;
  const customerTprId = customerProfile?.proxis_tpr_id ?? null;
  const { data: customerPriceMap = new Map<string, number>() } = useCustomerPricing(
    customerType,
    customerTprId,
  );
  const { cart, addToCart, updateQuantity, setQuantity, removeFromCart, clearCart } = useCart();
  const { ids: recentlyViewedIds } = useRecentlyViewed();
  const { ids: wishlistIds, toggle: toggleWishlist } = useWishlist();
  const { search, setSearch, setIsCartOpen, setCategoryTopNavProps } = usePublicLayout();
  const [searchParams, setSearchParams] = useSearchParams();
  const debouncedSearch = useDebounce(search, 250);
  const [quickViewProduct, setQuickViewProduct] = useState<string | null>(null);
  const { ids: compareIds, toggle: toggleCompare, remove: removeCompare, clear: clearCompare, max: compareMax } = useComparison();
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(() => readCatalogViewState()?.selectedType ?? null);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(
    () => readCatalogViewState()?.selectedFamily ?? null,
  );
  const [sortMode, setSortMode] = useState<CatalogSortMode>(() => readCatalogViewState()?.sortMode ?? "relevance");
  const [visibleProducts, setVisibleProducts] = useState(
    () => readCatalogViewState()?.visibleProducts ?? INITIAL_PRODUCTS_VISIBLE,
  );
  const catalogRef = useRef<HTMLDivElement>(null);
  const restoredScrollRef = useRef(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const showFavoritesView = searchParams.get("view") === "favoritos";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || restoredScrollRef.current) return;

    restoredScrollRef.current = true;
    const savedState = readCatalogViewState();
    window.history.scrollRestoration = "manual";
    const shouldScrollTop = Boolean((location.state as { scrollToTop?: boolean } | null | undefined)?.scrollToTop);
    window.scrollTo({ top: shouldScrollTop ? 0 : savedState?.scrollY ?? 0, left: 0, behavior: "auto" });

    return () => {
      window.history.scrollRestoration = "auto";
    };
  }, [location.state]);

  useEffect(() => {
    setVisibleProducts(INITIAL_PRODUCTS_VISIBLE);
  }, [search, selectedType, selectedFamily, sortMode]);

  useEffect(() => {
    return () => {
      saveCatalogViewState({
        search,
        selectedType,
        selectedFamily,
        visibleProducts,
        scrollY: typeof window === "undefined" ? 0 : window.scrollY,
        sortMode,
      });
    };
  }, [search, selectedType, selectedFamily, visibleProducts, sortMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const selector = window.matchMedia("(min-width: 1024px)").matches
          ? 'input[data-catalog-search="desktop"]'
          : 'input[data-catalog-search="mobile"]';
        (document.querySelector(selector) as HTMLInputElement | null)?.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const categoryFamilies = useMemo(() => [...new Set(products.map((p) => p.family))].sort(), [products]);
  const familyTypesByFamily = useMemo(() => {
    const grouped = new Map<string, Map<string, number>>();

    for (const product of products) {
      if (!grouped.has(product.family)) grouped.set(product.family, new Map());
      const familyTypes = grouped.get(product.family)!;
      familyTypes.set(product.type, (familyTypes.get(product.type) ?? 0) + 1);
    }

    return new Map(
      [...grouped.entries()].map(([family, typeMap]) => [
        family,
        [...typeMap.entries()]
          .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "pt-BR"))
          .map(([type]) => type),
      ]),
    );
  }, [products]);
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
    const query = debouncedSearch;
    return products.filter((p) => {
      if (
        query &&
        !p.name.toLowerCase().includes(query.toLowerCase()) &&
        !descriptionIncludesQuery(p.description, query)
      ) {
        return false;
      }
      if (selectedType && p.type !== selectedType) return false;
      if (selectedFamily && p.family !== selectedFamily) return false;
      if (p.visible_to && p.visible_to.length > 0 && customerType && !p.visible_to.includes(customerType)) {
        return false;
      }
      if (p.visible_to && p.visible_to.length > 0 && !customerType) {
        return false;
      }
      return true;
    });
  }, [products, debouncedSearch, selectedType, selectedFamily, customerType]);

  const orderPopularity = useMemo(() => {
    const quantityCounts = new Map<string, number>();

    for (const order of orderHistory) {
      for (const item of order.items) {
        const productId = typeof item.product_id === "string" ? item.product_id.trim() : "";
        if (!productId) continue;

        quantityCounts.set(productId, (quantityCounts.get(productId) ?? 0) + Math.max(1, item.quantity));
      }
    }

    return { quantityCounts };
  }, [orderHistory]);

  const sortedFiltered = useMemo(() => {
    const list = [...filtered];

    switch (sortMode) {
      case "best_sellers":
        return list.sort((left, right) => {
          const leftQty = orderPopularity.quantityCounts.get(left.id) ?? 0;
          const rightQty = orderPopularity.quantityCounts.get(right.id) ?? 0;
          const leftPromo = left.is_promotion ? 1 : 0;
          const rightPromo = right.is_promotion ? 1 : 0;
          return rightQty - leftQty || rightPromo - leftPromo || left.name.localeCompare(right.name, "pt-BR");
        });
      case "price_asc":
        return list.sort(
          (left, right) =>
            resolveProductPrice(left, customerPriceMap) - resolveProductPrice(right, customerPriceMap) ||
            left.name.localeCompare(right.name, "pt-BR"),
        );
      case "price_desc":
        return list.sort(
          (left, right) =>
            resolveProductPrice(right, customerPriceMap) - resolveProductPrice(left, customerPriceMap) ||
            left.name.localeCompare(right.name, "pt-BR"),
        );
      case "name_asc":
        return list.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
      case "relevance":
      default:
        return list.sort((left, right) => {
          const leftPromo = left.is_promotion ? 1 : 0;
          const rightPromo = right.is_promotion ? 1 : 0;
          const leftQty = orderPopularity.quantityCounts.get(left.id) ?? 0;
          const rightQty = orderPopularity.quantityCounts.get(right.id) ?? 0;

          return rightPromo - leftPromo || rightQty - leftQty || left.name.localeCompare(right.name, "pt-BR");
        });
    }
  }, [filtered, sortMode, orderPopularity, customerPriceMap]);

  const visibleFiltered = useMemo(() => sortedFiltered.slice(0, visibleProducts), [sortedFiltered, visibleProducts]);

  const cartIds = useMemo(() => new Set(cart.map((c) => c.product.id)), [cart]);

  useEffect(() => {
    setCategoryTopNavProps({
      families: categoryFamilies,
      familyTypesByFamily: familyTypesByFamily,
      typeCounts: typeCounts,
      familyCounts: familyCounts,
      selectedFamily: selectedFamily,
      selectedType: selectedType,
      onFamilyChange: setSelectedFamily,
      onTypeChange: setSelectedType,
      totalProducts: filtered.length,
    });
  }, [categoryFamilies, familyTypesByFamily, typeCounts, familyCounts, selectedFamily, selectedType, filtered.length, setCategoryTopNavProps]);

  const showAllProducts = useCallback(() => {
    setSearch("");
    setSelectedType(null);
    setSelectedFamily(null);
    setVisibleProducts(INITIAL_PRODUCTS_VISIBLE);
    catalogRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const recentlyViewedProducts = useMemo(
    () => products.filter((p) => recentlyViewedIds.includes(p.id)).slice(0, 10),
    [products, recentlyViewedIds],
  );

  const wishlistProducts = useMemo(
    () => products.filter((p) => wishlistIds.includes(p.id)).slice(0, 10),
    [products, wishlistIds],
  );

  const catalogThemeSections = useMemo(() => {
    if (filtered.length === 0) return [];

    const baseProducts = [...filtered];
    const promotedProducts = [...baseProducts]
      .filter((product) => product.is_promotion)
      .sort(
        (left, right) =>
          resolveProductPrice(left, customerPriceMap) -
            resolveProductPrice(right, customerPriceMap) ||
          new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime() ||
          left.name.localeCompare(right.name, "pt-BR"),
      );
    const withPopularSignal = [...baseProducts].sort((left, right) => {
      const leftQty = orderPopularity.quantityCounts.get(left.id) ?? 0;
      const rightQty = orderPopularity.quantityCounts.get(right.id) ?? 0;
      const leftFallback = familyCounts.get(left.family) ?? 0;
      const rightFallback = familyCounts.get(right.family) ?? 0;

      return rightQty - leftQty || rightFallback - leftFallback || left.name.localeCompare(right.name, "pt-BR");
    });

    const typeNames = [...new Set(baseProducts.map((p) => p.type))].sort(
      (a, b) => a.localeCompare(b, "pt-BR"),
    );
    const typeSections = !selectedType
      ? typeNames.map((type) => ({
          id: `tipo-${type}`,
          title: type.charAt(0).toUpperCase() + type.slice(1),
          products: baseProducts
            .filter((p) => p.type === type)
            .slice(0, 8),
        }))
      : [];

    return [
      {
        id: "promocoes",
        title: "Promoções",
        highlightLabel: "Promoção",
        highlightTone: "destructive" as const,
        products: promotedProducts.slice(0, 8),
      },
      {
        id: "mais-vendidos",
        title: "Mais vendidos",
        highlightLabel: "Mais vendido",
        highlightTone: "success" as const,
        products: withPopularSignal.slice(0, 8),
      },
      ...typeSections,
    ];
  }, [customerPriceMap, familyCounts, filtered, orderHistory, orderPopularity, selectedType]);

  return (
    <div id="top" className="min-h-screen bg-muted/40 pb-32 sm:pb-[10rem]">
      <StoreHeroBanner customerType={customerType} />

      <div
        ref={catalogRef}
        id="catalogo-produtos"
        className="w-full px-3 pt-1 sm:px-6 sm:pt-3 lg:px-8"
      >
        <div className="space-y-6">
          {showFavoritesView ? (
            <section className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Favoritos</p>
                  <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Meus favoritos</h2>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-full border-border/60 px-4 text-sm"
                  onClick={() => setSearchParams({})}
                >
                  Ver catálogo
                </Button>
              </div>

              {wishlistProducts.length === 0 ? (
                <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-background/80 px-6 py-14 text-center shadow-sm">
                  <Heart className="mx-auto h-10 w-10 text-muted-foreground/35" />
                  <p className="mt-4 text-lg font-semibold text-foreground">Vc n tem itens favoritos</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Marque produtos com o coração para salvar aqui e acessar depois.
                  </p>
                  <Button type="button" className="mt-5 rounded-full" onClick={() => setSearchParams({})}>
                    Voltar ao catálogo
                  </Button>
                </div>
              ) : (
                <ProductCarouselSection
                  title="Meus favoritos"
                  products={wishlistProducts}
                  resolvePrice={(p) => resolveProductPrice(p, customerPriceMap)}
                  onAdd={addToCart}
                  inCartIds={cartIds}
                  wishlistIds={wishlistIds}
                  toggleWishlist={toggleWishlist}
                />
              )}
            </section>
          ) : (
            <>
              <CatalogThemeSections
                sections={catalogThemeSections}
                resolvePrice={(product) => resolveProductPrice(product, customerPriceMap)}
                onAdd={addToCart}
                inCartIds={cartIds}
              />

              <section className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="max-sm:text-base max-sm:font-semibold tracking-tight text-foreground sm:text-2xl sm:font-bold">
                    {selectedFamily || selectedType
                      ? `Resultados para "${selectedFamily || selectedType}"`
                      : "Catálogo completo"}
                  </h2>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                    <SortModeControl value={sortMode} onChange={setSortMode} />
                    <Badge variant="outline" className="w-full justify-center rounded-full border-border/70 bg-background/80 px-3 py-1 text-[11px] font-medium whitespace-nowrap sm:w-auto">
                      {filtered.length} item(ns)
                    </Badge>
                  </div>
                </div>

                {isLoading ? (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                    {Array.from({ length: 10 }).map((_, index) => (
                      <div key={index} className="overflow-hidden rounded-xl bg-background/70 ring-1 ring-black/5">
                        <Skeleton className="aspect-square w-full rounded-none" />
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-xl bg-background/70 px-6 py-16 text-center text-muted-foreground ring-1 ring-black/5">
                    <p className="text-lg font-medium text-foreground">Nenhum produto encontrado</p>
                    <p className="mt-1 text-sm">Tente ajustar os filtros ou a busca.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                      {visibleFiltered.map((product) => (
                        <CatalogProductCard
                          key={product.id}
                          product={product}
                          price={resolveProductPrice(product, customerPriceMap)}
                          onAdd={addToCart}
                          inCart={cartIds.has(product.id)}
                          compact
                          isWishlisted={wishlistIds.includes(product.id)}
                          onToggleWishlist={() => toggleWishlist(product.id)}
                        />
                      ))}
                    </div>
                    {visibleProducts < filtered.length ? (
                      <div className="flex items-center justify-center py-8">
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          className="h-11 rounded-full border-border/60 px-8 text-sm font-medium shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5"
                          onClick={() =>
                            setVisibleProducts((current) =>
                              Math.min(current + PRODUCTS_VISIBLE_STEP, sortedFiltered.length),
                            )
                          }
                        >
                          Carregar mais produtos
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
              </section>

              {wishlistProducts.length > 0 && (
                <ProductCarouselSection
                  title="Meus favoritos"
                  products={wishlistProducts}
                  resolvePrice={(p) => resolveProductPrice(p, customerPriceMap)}
                  onAdd={addToCart}
                  inCartIds={cartIds}
                  wishlistIds={wishlistIds}
                  toggleWishlist={toggleWishlist}
                />
              )}

              {recentlyViewedProducts.length > 0 && (
                <ProductCarouselSection
                  title="Vistos recentemente"
                  products={recentlyViewedProducts}
                  resolvePrice={(p) => resolveProductPrice(p, customerPriceMap)}
                  onAdd={addToCart}
                  inCartIds={cartIds}
                  wishlistIds={wishlistIds}
                  toggleWishlist={toggleWishlist}
                />
              )}
            </>
          )}
        </div>
      </div>

      {compareIds.length > 0 ? (
        <CompareBar
          products={products}
          compareIds={compareIds}
          max={compareMax}
          onRemove={removeCompare}
          onClear={clearCompare}
          onCompare={() => setCompareOpen(true)}
        />
      ) : null}

      <CompareModal
        open={compareOpen}
        onOpenChange={setCompareOpen}
        products={products.filter((p) => compareIds.includes(p.id))}
      />

      {showBackToTop ? (
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-24 right-4 z-40 h-10 w-10 rounded-full border-border/60 bg-background/90 shadow-md backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-300"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Voltar ao topo"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
      ) : null}

      <QuickView
        product={quickViewProduct ? (products.find((p) => p.id === quickViewProduct) ?? null) : null}
        open={quickViewProduct !== null}
        onOpenChange={(open) => { if (!open) setQuickViewProduct(null); }}
        price={quickViewProduct ? resolveProductPrice(products.find((p) => p.id === quickViewProduct)!, customerPriceMap) : 0}
        onAdd={addToCart}
        inCart={quickViewProduct ? cartIds.has(quickViewProduct) : false}
        isWishlisted={quickViewProduct ? wishlistIds.includes(quickViewProduct) : false}
        onToggleWishlist={() => { if (quickViewProduct) toggleWishlist(quickViewProduct); }}
      />

    </div>
  );
}

function ProductCarouselSection({
  title,
  products,
  resolvePrice,
  onAdd,
  inCartIds,
  wishlistIds,
  toggleWishlist,
}: {
  title: string;
  products: Product[];
  resolvePrice: (product: Product) => number;
  onAdd: (product: Product) => void;
  inCartIds: Set<string>;
  wishlistIds: string[];
  toggleWishlist: (id: string) => void;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!api) return;
    setActiveIndex(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api || products.length === 0) return;
    const raf = requestAnimationFrame(() => {
      api.reInit();
    });
    return () => cancelAnimationFrame(raf);
  }, [api, products]);

  useEffect(() => {
    if (!api) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        requestAnimationFrame(() => api.reInit());
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [api]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api, onSelect]);

  const totalSnaps = api ? api.scrollSnapList().length : 1;

  return (
    <section>
      <h2 className="mb-3 text-lg font-bold tracking-tight text-foreground sm:text-xl">{title}</h2>
      <div className="group relative">
        <Carousel opts={{ align: "start", dragFree: false }} setApi={setApi}>
          <div className="mb-3 flex items-center justify-end gap-1.5">
            {totalSnaps > 1 && (
              <span className="text-xs tabular-nums text-muted-foreground">
                Página {activeIndex + 1}/{totalSnaps}
              </span>
            )}
            <CarouselPrevious
              className="relative inset-auto h-8 w-8 translate-y-0 rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm hover:border-primary/30 hover:text-primary sm:h-9 sm:w-9"
              aria-label="Anterior"
            />
            <CarouselNext
              className="relative inset-auto h-8 w-8 translate-y-0 rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm hover:border-primary/30 hover:text-primary sm:h-9 sm:w-9"
              aria-label="Próximo"
            />
          </div>
          <CarouselContent className="-ml-2 sm:-ml-3">
            {products.map((product) => (
              <CarouselItem key={product.id} className="basis-1/2 pl-2 sm:pl-3 md:basis-1/3 lg:basis-1/4 xl:basis-1/5 2xl:basis-1/6">
                <CatalogProductCard
                  product={product}
                  price={resolvePrice(product)}
                  onAdd={onAdd}
                  inCart={inCartIds.has(product.id)}
                  compact
                  isWishlisted={wishlistIds.includes(product.id)}
                  onToggleWishlist={() => toggleWishlist(product.id)}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        {totalSnaps > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2" role="tablist" aria-label={`Slides de ${title}`}>
            {Array.from({ length: totalSnaps }).map((_, index) => (
              <button
                key={`dot-${index}`}
                type="button"
                role="tab"
                aria-selected={activeIndex === index}
                aria-label={`Ir para slide ${index + 1}`}
                onClick={() => api?.scrollTo(index)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  activeIndex === index ? "w-6 bg-primary" : "w-2 bg-foreground/20 hover:bg-foreground/40",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
