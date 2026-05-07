import { useState, useMemo, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductListItem } from "@/components/ProductListItem";
import { ProductFilters } from "@/components/ProductFilters";
import { CartDrawer } from "@/components/CartDrawer";
import { Product, CartItem, getCart, saveCart } from "@/lib/products";
import { useProducts } from "@/hooks/useProducts";
import { toast } from "sonner";
import clinicMaisLogo from "@/assets/clinicmais-logo.png";

export default function Index() {
  const { data: products = [], isLoading } = useProducts();
  const [cart, setCart] = useState<CartItem[]>(getCart);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);

  useEffect(() => { saveCart(cart); }, [cart]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedType && p.type !== selectedType) return false;
      if (selectedFamily && p.family !== selectedFamily) return false;
      return true;
    });
  }, [products, search, selectedType, selectedFamily]);

  const cartIds = useMemo(() => new Set(cart.map((c) => c.product.id)), [cart]);

  const openCart = useCallback(() => setIsCartOpen(true), []);

  const addToCart = useCallback((product: Product, quantity: number) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        toast.info("Produto já está no carrinho");
        return prev;
      }
      toast.success(`${product.name} adicionado!`, {
        action: {
          label: "Ver meu carrinho",
          onClick: openCart,
        },
      });
      return [...prev, { product, quantity: Math.max(1, quantity) }];
    });
  }, [openCart]);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart((prev) => prev.map((c) =>
      c.product.id === id ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c
    ));
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== id));
  }, []);

  const updateNotes = useCallback((id: string, notes: string) => {
    setCart((prev) => prev.map((c) =>
      c.product.id === id ? { ...c, notes } : c
    ));
  }, []);

  const clearCart = useCallback(() => { setCart([]); }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="h-1 bg-primary" />
        <div className="container mx-auto px-4 py-4 sm:py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <img src={clinicMaisLogo} alt="Clinic+ Suplemento e Nutrição" className="h-9 sm:h-11 w-auto mb-2" />
            <h1 className="text-lg sm:text-2xl font-semibold text-foreground leading-tight">
              Monte seu carrinho de interesse
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Selecione os produtos para montar seu pedido personalizado.
            </p>
          </div>
          <Link to="/admin">
            <Button variant="outline" size="icon" className="shrink-0 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary">
              <Settings className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Toolbar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border shadow-sm">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Carregando..." : `${filtered.length} produto(s) encontrado(s)`}
          </p>
          <div className="flex items-center gap-2">
            <CartDrawer
              cart={cart}
              onUpdateQuantity={updateQuantity}
              onRemove={removeFromCart}
              onUpdateNotes={updateNotes}
              onClear={clearCart}
              open={isCartOpen}
              onOpenChange={setIsCartOpen}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-14rem)] lg:overflow-hidden">
          <aside className="lg:w-64 shrink-0 lg:h-full lg:overflow-y-auto">
            <div className="lg:pr-1">
              <ProductFilters
                search={search}
                onSearchChange={setSearch}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                selectedFamily={selectedFamily}
                onFamilyChange={setSelectedFamily}
              />
            </div>
          </aside>

          <main className="flex-1 lg:h-full lg:overflow-y-auto lg:pr-1">
            {isLoading ? (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-lg font-medium">Carregando produtos...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-lg font-medium">Nenhum produto encontrado</p>
                <p className="text-sm mt-1">Tente ajustar os filtros.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((product) => (
                  <ProductListItem
                    key={product.id}
                    product={product}
                    onAdd={addToCart}
                    inCart={cartIds.has(product.id)}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
