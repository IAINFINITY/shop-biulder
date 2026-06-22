import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { CatalogProductCard } from "@/components/catalogo/CatalogProductCard";
import { CartDrawer } from "@/components/carrinho/CartDrawer";
import { CartTotalBar } from "@/components/carrinho/CartTotalBar";
import { StoreHeader } from "@/components/catalogo/StoreHeader";
import { StoreHeroBanner } from "@/components/catalogo/StoreHeroBanner";
import { CatalogFiltersBarV2 } from "@/components/catalogo/CatalogFiltersBarV2";
import { Button } from "@/components/ui/button";
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

  const cartIds = useMemo(() => new Set(cart.map((c) => c.product.id)), [cart]);

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

      <CatalogFiltersBarV2
        categoryTypes={categoryTypes}
        categoryFamilies={categoryFamilies}
        typeCounts={typeCounts}
        familyCounts={familyCounts}
        selectedType={selectedType}
        selectedFamily={selectedFamily}
        onTypeChange={setSelectedType}
        onFamilyChange={setSelectedFamily}
        onShowAllProducts={showAllProducts}
      />

      <div ref={catalogRef} id="catalogo-produtos" className="container mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 border-b border-border/60 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-lg font-semibold leading-tight text-foreground sm:text-2xl">
                Catálogo de produtos
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Navegue pelos produtos e refine a busca por tipo ou família.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <p>{isLoading ? "Carregando..." : `${filtered.length} produto(s) encontrado(s)`}</p>
              {(search || selectedType || selectedFamily) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={showAllProducts}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
        </div>

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
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((product) => (
              <CatalogProductCard
                key={product.id}
                product={product}
                price={resolveProductPrice(product, customerPriceMap)}
                onAdd={addToCart}
                inCart={cartIds.has(product.id)}
              />
            ))}
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
