import { useState, useMemo, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Settings, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { ProductFilters } from "@/components/ProductFilters";
import { CartDrawer } from "@/components/CartDrawer";
import { Product, CartItem, getCart, saveCart } from "@/lib/products";
import { useProducts } from "@/hooks/useProducts";
import { toast } from "sonner";
import heroImage from "@/assets/hero-products.jpg";

export default function Index() {
  const { data: products = [], isLoading } = useProducts();
  const [cart, setCart] = useState<CartItem[]>(getCart);
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

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        toast.info("Produto já está no carrinho");
        return prev;
      }
      toast.success(`${product.name} adicionado!`);
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

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
      {/* Hero */}
      <div className="relative h-56 sm:h-72 overflow-hidden">
        <img src={heroImage} alt="Produtos Clinic+" width={1920} height={800} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/70 to-foreground/30" />
        <div className="absolute inset-0 flex items-center">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Leaf className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold text-background tracking-tight">
                Clinic<span className="text-accent">+</span>
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl font-bold text-background max-w-lg">
              Monte seu carrinho de interesse
            </h1>
            <p className="text-background/80 mt-1 text-sm sm:text-base max-w-md">
              Selecione os produtos desejados para seu atendimento personalizado.
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
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
            />
            <Link to="/admin">
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <Settings className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-64 shrink-0">
            <div className="lg:sticky lg:top-20">
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

          <main className="flex-1">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch auto-rows-fr">
                {filtered.map((product) => (
                  <ProductCard
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
