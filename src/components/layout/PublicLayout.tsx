import { createContext, useContext, useState, useEffect, useMemo, type ReactNode, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { StoreHeader, type StoreHeaderSearchSuggestion } from "@/components/catalogo/StoreHeader";
import { CategoryTopNav, type CategoryTopNavProps } from "@/components/catalogo/CategoryTopNav";
import { CartDrawer } from "@/components/carrinho/CartDrawer";
import { StoreFooter } from "@/components/layout/StoreFooter";
import { MobileBottomNav } from "@/components/mobile";
import { useCart } from "@/hooks/useCart";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useCustomerPricing } from "@/hooks/useCustomerPricing";
import { useProducts } from "@/hooks/useProducts";
import { resolveProductPrice } from "@/lib/pricing";
import { getProductImageUrls } from "@/lib/products";
import { descriptionIncludesQuery } from "@/lib/richTextPure";
import { readCachedCustomerProfile } from "@/lib/customerProfileSnapshot";
import { readAuthBootstrapSnapshot } from "@/lib/customerProfileSnapshot";

type PublicLayoutContextValue = {
  search: string;
  setSearch: (value: string) => void;
  searchSuggestions: StoreHeaderSearchSuggestion[];
  setSearchSuggestions: (suggestions: StoreHeaderSearchSuggestion[]) => void;
  searchHistory: string[];
  addToSearchHistory: (term: string) => void;
  removeFromSearchHistory: (term: string) => void;
  clearSearchHistory: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  categoryTopNavProps: CategoryTopNavProps | null;
  setCategoryTopNavProps: (props: CategoryTopNavProps | null) => void;
};

const PublicLayoutContext = createContext<PublicLayoutContextValue | null>(null);

export function usePublicLayout() {
  const ctx = useContext(PublicLayoutContext);
  if (!ctx) throw new Error("usePublicLayout must be used within PublicLayout");
  return ctx;
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: allProducts = [] } = useProducts();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [searchSuggestions, setSearchSuggestions] = useState<StoreHeaderSearchSuggestion[]>([]);
  const { history: searchHistory, add: addToSearchHistory, remove: removeFromSearchHistory, clear: clearSearchHistory } = useSearchHistory();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [categoryTopNavProps, setCategoryTopNavProps] = useState<CategoryTopNavProps | null>(null);

  const { cart, addToCart, updateQuantity, setQuantity, removeFromCart, clearCart } = useCart();
  const authSnapshot = readAuthBootstrapSnapshot();
  const customerProfile = readCachedCustomerProfile(authSnapshot?.user.id ?? null);
  const customerType = customerProfile?.customer_type ?? null;
  const customerTprId = customerProfile?.proxis_tpr_id ?? null;
  const { data: customerPriceMap = new Map<string, number>() } = useCustomerPricing(customerType, customerTprId);

  useEffect(() => {
    if (debouncedSearch.trim().length > 0) {
      addToSearchHistory(debouncedSearch.trim());
    }
  }, [debouncedSearch, addToSearchHistory]);

  const query = useMemo(() => debouncedSearch.trim().toLowerCase(), [debouncedSearch]);

  const productsForSuggestions = useMemo(() => {
    if (!query) return [];
    return allProducts
      .filter((p) => {
        const name = p.name.toLowerCase();
        const desc = p.description ?? "";
        return name.includes(query) || descriptionIncludesQuery(desc, query);
      })
      .map((p) => {
        const name = p.name.toLowerCase();
        let score = 1;
        if (name.startsWith(query)) score += 2;
        if (p.product_code?.toLowerCase().includes(query)) score += 2;
        return { product: p, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ product }) => ({
        id: product.id,
        name: product.name,
        type: product.type,
        family: product.family,
        imageUrl: getProductImageUrls(product)[0] ?? product.image_url ?? null,
        price: resolveProductPrice(product, customerPriceMap),
      }));
  }, [query, allProducts, customerPriceMap]);

  useEffect(() => {
    setSearchSuggestions(productsForSuggestions);
  }, [productsForSuggestions, setSearchSuggestions]);

  const isIndexRoute = location.pathname === "/";
  const isAccountRoute = location.pathname.startsWith("/conta");
  const isOrderRoute = location.pathname.startsWith("/pedido");
  const isLoginRoute = location.pathname === "/login";
  const isProductRoute = location.pathname.startsWith("/produto");
  const isHelpRoute = location.pathname.startsWith("/ajuda");
  const hideFooter = isAccountRoute || isOrderRoute || isLoginRoute;
  const showStoreHeader = isIndexRoute || isProductRoute || isOrderRoute || isHelpRoute;
  const handleSearchSubmit = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!isIndexRoute) {
      navigate(`/?search=${encodeURIComponent(trimmed)}`);
    }
  }, [isIndexRoute, navigate]);

  const ctx: PublicLayoutContextValue = {
    search, setSearch,
    searchSuggestions, setSearchSuggestions,
    searchHistory, addToSearchHistory, removeFromSearchHistory, clearSearchHistory,
    isCartOpen, setIsCartOpen,
    categoryTopNavProps, setCategoryTopNavProps,
  };

  return (
    <PublicLayoutContext.Provider value={ctx}>
      <div className="flex min-h-screen flex-col">
        {showStoreHeader ? (
          <StoreHeader
            search={search}
            onSearchChange={setSearch}
            onSearchSubmit={handleSearchSubmit}
            searchSuggestions={searchSuggestions}
            searchHistory={searchHistory}
            onSearchHistoryClear={clearSearchHistory}
            onSearchHistoryRemove={removeFromSearchHistory}
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
            filterNav={
              isIndexRoute && categoryTopNavProps ? (
                <CategoryTopNav {...categoryTopNavProps} />
              ) : undefined
            }
          />
        ) : null}
        <main
          data-native-view-transition={
            typeof document !== "undefined" && "startViewTransition" in document ? "true" : "false"
          }
          className="flex-1 page-shell pb-16 lg:pb-0"
        >
          {children}
        </main>
        {!isLoginRoute ? <MobileBottomNav /> : null}
        {!hideFooter ? <StoreFooter /> : null}
      </div>
    </PublicLayoutContext.Provider>
  );
}
