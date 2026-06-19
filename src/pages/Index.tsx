import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ProductListItem } from "@/components/catalogo/ProductListItem";
import { ProductFilters } from "@/components/catalogo/ProductFilters";
import { CartDrawer } from "@/components/carrinho/CartDrawer";
import { CartTotalBar } from "@/components/carrinho/CartTotalBar";
import { StoreHeader } from "@/components/catalogo/StoreHeader";
import { StoreHeroBanner } from "@/components/catalogo/StoreHeroBanner";
import { StoreCategoryNav } from "@/components/catalogo/StoreCategoryNav";
import { CatalogOrderNotice } from "@/components/catalogo/CatalogOrderNotice";
import { Product, CartItem, getCart, saveCart } from "@/lib/products";
import { descriptionIncludesQuery } from "@/lib/richText";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerPricing } from "@/hooks/useCustomerPricing";
import { calculateCartSubtotal, resolveProductPrice } from "@/lib/pricing";
import { toast } from "sonner";

export default function Index() {
  const { data: products = [], isLoading } = useProducts();
  const { customerProfile } = useAuth();
  const { data: customerPriceMap = new Map<string, number>() } = useCustomerPricing(
    customerProfile?.customer_type,
  );
  const [cart, setCart] = useState<CartItem[]>(getCart);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const catalogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  const categoryTypes = useMemo(() => [...new Set(products.map((p) => p.type))].sort(), [products]);

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

  const cartIds = useMemo(() => new Set(cart.map((c) => c.product.id)), [cart]);
  const cartQuantityById = useMemo(() => new Map(cart.map((c) => [c.product.id, c.quantity])), [cart]);

  const openCart = useCallback(() => setIsCartOpen(true), []);

  const addToCart = useCallback(
    (product: Product, quantity: number) => {
      setCart((prev) => {
        const existing = prev.find((c) => c.product.id === product.id);
        if (existing) {
          toast.success("Carrinho atualizado!");
          return prev.map((c) =>
            c.product.id === product.id ? { ...c, quantity: Math.max(1, quantity) } : c,
          );
        }
        toast.success(`${product.name} adicionado!`, {
          action: {
            label: "Ver meu carrinho",
            onClick: openCart,
          },
        });
        return [...prev, { product, quantity: Math.max(1, quantity) }];
      });
    },
    [openCart],
  );

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev.map((c) => (c.product.id === id ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c)),
    );
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== id));
  }, []);

  const updateNotes = useCallback((id: string, notes: string) => {
    setCart((prev) => prev.map((c) => (c.product.id === id ? { ...c, notes } : c)));
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
    catalogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className={`min-h-screen bg-background ${cart.length > 0 ? "pb-28" : ""}`}>
      <StoreHeader
        search={search}
        onSearchChange={setSearch}
        cartSlot={
          <CartDrawer
            cart={cart}
            onUpdateQuantity={updateQuantity}
            onRemove={removeFromCart}
            onUpdateNotes={updateNotes}
            onClear={clearCart}
            open={isCartOpen}
            onOpenChange={setIsCartOpen}
            resolveUnitPrice={(product) => resolveProductPrice(product, customerPriceMap)}
          />
        }
      />

      <StoreHeroBanner />

      <StoreCategoryNav
        categoryTypes={categoryTypes}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        onShowAllProducts={showAllProducts}
      />

      <div className="border-b border-border/60 bg-gradient-to-b from-primary/[0.08] to-background">
        <div className="container mx-auto px-4 pt-4 sm:pt-5">
          <CatalogOrderNotice />
        </div>
        <div className="container mx-auto px-4 pb-4 sm:pb-5 pt-3">
          <h1 className="text-lg sm:text-2xl font-semibold text-foreground leading-tight">
            Monte seu carrinho de interesse
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Escolha os produtos que precisa e adicione ao carrinho.
          </p>
        </div>
      </div>

      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur shadow-sm">
        <div className="container mx-auto flex h-11 items-center px-4 text-sm text-muted-foreground">
          {isLoading ? "Carregando..." : `${filtered.length} produto(s) encontrado(s)`}
        </div>
      </div>

      <div ref={catalogRef} id="catalogo-produtos" className="container mx-auto px-4 py-6">
        <div className="flex flex-col gap-6 lg:h-[calc(100vh-12rem)] lg:flex-row lg:overflow-hidden">
          <aside className="shrink-0 lg:h-full lg:w-64 lg:overflow-y-auto">
            <div className="lg:pr-1">
              <ProductFilters
                search={search}
                onSearchChange={setSearch}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                selectedFamily={selectedFamily}
                onFamilyChange={setSelectedFamily}
                showSearch={false}
              />
            </div>
          </aside>

          <main className="flex-1 lg:h-full lg:overflow-y-auto lg:pr-1">
            {isLoading ? (
              <div className="py-20 text-center text-muted-foreground">
                <p className="text-lg font-medium">Carregando produtos...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                <p className="text-lg font-medium">Nenhum produto encontrado</p>
                <p className="mt-1 text-sm">Tente ajustar os filtros ou a busca.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((product) => (
                  <ProductListItem
                    key={product.id}
                    product={product}
                    price={resolveProductPrice(product, customerPriceMap)}
                    onAdd={addToCart}
                    inCart={cartIds.has(product.id)}
                    currentQuantity={cartQuantityById.get(product.id)}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
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
