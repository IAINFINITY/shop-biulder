import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CatalogProductCard } from "@/components/catalogo/CatalogProductCard";
import { CartDrawer } from "@/components/carrinho/CartDrawer";
import { CartTotalBar } from "@/components/carrinho/CartTotalBar";
import { StoreHeader } from "@/components/catalogo/StoreHeader";
import { StoreHeroBanner } from "@/components/catalogo/StoreHeroBanner";
import {
  CatalogFiltersBarV2,
  CatalogFiltersSidebar,
  type CatalogSortMode,
} from "@/components/catalogo/CatalogFiltersBarStickyFilters";
import { CatalogThemeSections } from "@/components/catalogo/CatalogThemeSections";
import { getProductImageUrls } from "@/lib/products";
import { descriptionIncludesQuery } from "@/lib/richTextPure";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { useCart } from "@/hooks/useCart";
import { useCustomerPricing } from "@/hooks/useCustomerPricing";
import { calculateCartSubtotal, resolveProductPrice } from "@/lib/pricing";
import { ChevronUp, Loader2 } from "lucide-react";
import { readAuthBootstrapSnapshot, readCachedCustomerProfile } from "@/lib/customerProfileSnapshot";

const INITIAL_PRODUCTS_VISIBLE = 12;
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
      visibleProducts:
        typeof parsed.visibleProducts === "number" && Number.isFinite(parsed.visibleProducts)
          ? Math.max(INITIAL_PRODUCTS_VISIBLE, parsed.visibleProducts)
          : INITIAL_PRODUCTS_VISIBLE,
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

export default function Index() {
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
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [search, setSearch] = useState(() => readCatalogViewState()?.search ?? "");
  const [selectedType, setSelectedType] = useState<string | null>(() => readCatalogViewState()?.selectedType ?? null);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(
    () => readCatalogViewState()?.selectedFamily ?? null,
  );
  const [sortMode, setSortMode] = useState<CatalogSortMode>(() => readCatalogViewState()?.sortMode ?? "relevance");
  const [visibleProducts, setVisibleProducts] = useState(
    () => readCatalogViewState()?.visibleProducts ?? INITIAL_PRODUCTS_VISIBLE,
  );
  const catalogRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const restoredScrollRef = useRef(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

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
    window.scrollTo({ top: savedState?.scrollY ?? 0, left: 0, behavior: "auto" });

    return () => {
      window.history.scrollRestoration = "auto";
    };
  }, []);

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
      if (p.visible_to && p.visible_to.length > 0 && customerType && !p.visible_to.includes(customerType)) {
        return false;
      }
      if (p.visible_to && p.visible_to.length > 0 && !customerType) {
        return false;
      }
      return true;
    });
  }, [products, search, selectedType, selectedFamily, customerType]);

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

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    if (isLoading || visibleProducts >= sortedFiltered.length) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisibleProducts((current) => Math.min(current + PRODUCTS_VISIBLE_STEP, sortedFiltered.length));
      },
      {
        root: null,
        rootMargin: "360px 0px",
        threshold: 0.05,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sortedFiltered.length, isLoading, visibleProducts]);

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
    catalogRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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

    const promoDescription = "Seleção em destaque para você encontrar ofertas e produtos prioritários com mais rapidez.";
    const soldDescription = orderHistory.length > 0
      ? "Os produtos mais recorrentes no seu histórico, organizados para consulta rápida."
      : "Produtos mais procurados para ajudar você a descobrir o catálogo com facilidade.";

    return [
      {
        id: "promocoes",
        eyebrow: "Oferta inteligente",
        title: "Promoções",
        description: promoDescription,
        highlightLabel: "Promoção",
        highlightTone: "destructive" as const,
        products: promotedProducts.slice(0, 8),
      },
      {
        id: "mais-vendidos",
        eyebrow: orderHistory.length > 0 ? "Seu histórico" : "Destaques",
        title: "Mais vendidos",
        description: soldDescription,
        highlightLabel: "Mais vendido",
        highlightTone: "success" as const,
        products: withPopularSignal.slice(0, 8),
      },
    ];
  }, [customerPriceMap, familyCounts, filtered, orderHistory.length, orderPopularity]);

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_18%_8%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_30%),radial-gradient(circle_at_82%_18%,color-mix(in_oklch,var(--primary)_5%,transparent),transparent_28%),radial-gradient(circle_at_55%_42%,color-mix(in_oklch,var(--primary)_3%,transparent),transparent_25%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--background))_50%,hsl(var(--muted)/0.10)_100%)] pb-32 sm:pb-[10rem]"
    >
      <StoreHeader
        search={search}
        onSearchChange={setSearch}
        searchSuggestions={searchSuggestions}
        cartSlot={
          <CartDrawer
            cart={cart}
            onUpdateQuantity={updateQuantity}
            onSetQuantity={setQuantity}
            onRemove={removeFromCart}
            onClear={clearCart}
            open={isCartOpen}
            onOpenChange={setIsCartOpen}
            resolveUnitPrice={(product) => resolveProductPrice(product, customerPriceMap)}
          />
        }
      />

      <StoreHeroBanner customerType={customerType} />

      <div
        ref={catalogRef}
        id="catalogo-produtos"
        className="mx-auto max-w-[1600px] px-3 py-6 sm:px-6 lg:px-8 scroll-mt-[calc(var(--page-header-shell-height,88px)+var(--catalog-filters-bar-height,132px)+1.5rem)]"
      >
        <div className="space-y-8">
          <CatalogFiltersBarV2
            categoryFamilies={categoryFamilies}
            familyTypesByFamily={familyTypesByFamily}
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
            sortMode={sortMode}
            onSortChange={setSortMode}
          />

          <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
            <CatalogFiltersSidebar
              categoryFamilies={categoryFamilies}
              familyTypesByFamily={familyTypesByFamily}
              typeCounts={typeCounts}
              familyCounts={familyCounts}
              selectedType={selectedType}
              selectedFamily={selectedFamily}
              onTypeChange={setSelectedType}
              onFamilyChange={setSelectedFamily}
              onShowAllProducts={showAllProducts}
              sortMode={sortMode}
              onSortChange={setSortMode}
            />

            <div className="min-w-0 space-y-10">
              <CatalogThemeSections
                sections={catalogThemeSections}
                resolvePrice={(product) => resolveProductPrice(product, customerPriceMap)}
                onAdd={addToCart}
                inCartIds={cartIds}
              />

              <section className="space-y-4 pt-2">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Catálogo completo
                    </p>
                    <h2 className="text-xl font-black tracking-[-0.04em] text-foreground sm:text-2xl">
                      Navegue pelos demais produtos
                    </h2>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      A vitrine principal continua abaixo, organizada pela busca e pelos filtros ativos.
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-full border-border/70 bg-background/80 px-3 py-1 text-[11px] font-medium">
                    {filtered.length} item(ns)
                  </Badge>
                </div>

                {isLoading ? (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div key={index} className="overflow-hidden rounded-2xl sm:rounded-[1.5rem] bg-background/70 ring-1 ring-black/5">
                        <Skeleton className="aspect-square sm:aspect-[4/3] w-full rounded-none" />
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-[1.75rem] bg-background/70 px-6 py-16 text-center text-muted-foreground ring-1 ring-black/5">
                    <p className="text-lg font-medium text-foreground">Nenhum produto encontrado</p>
                    <p className="mt-1 text-sm">Tente ajustar os filtros ou a busca.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {visibleFiltered.map((product) => (
                        <CatalogProductCard
                          key={product.id}
                          product={product}
                          price={resolveProductPrice(product, customerPriceMap)}
                          onAdd={addToCart}
                          inCart={cartIds.has(product.id)}
                          compact
                        />
                      ))}
                    </div>
                    {visibleProducts < filtered.length ? (
                      <div ref={loadMoreRef} className="flex items-center justify-center gap-3 py-8 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando mais produtos...
                      </div>
                    ) : null}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>

      <CartTotalBar
        total={cartSubtotal}
        itemCount={cartUnitCount}
        visible={cart.length > 0}
        onOpenCart={openCart}
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

    </div>
  );
}
