import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { type LucideIcon, ArrowLeft, Plus, Leaf, Pill, FlaskConical, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PRODUCTS_TABLE,
  CartItem,
  getCart,
  saveCart,
  getCartSubtotal,
  normalizeProductFromSupabaseRow,
  getProductImageUrls,
  PRODUCT_SELECT_COLUMNS,
  PRODUCT_SELECT_COLUMNS_LEGACY,
  isMissingImageUrlsColumnError,
} from "@/lib/products";
import { coercePrice, formatBRL } from "@/lib/formatMoney";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CartDrawer } from "@/components/carrinho/CartDrawer";
import { CartTotalBar } from "@/components/carrinho/CartTotalBar";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { toast } from "sonner";
import { ProductDescription } from "@/components/catalogo/ProductDescription";

const typeIcons: Record<string, LucideIcon> = {
  "Chá": Leaf,
  "Cápsula": Pill,
  "Solúvel": FlaskConical,
};

const typeColors: Record<string, string> = {
  "Chá": "bg-success/10 text-success border-success/20",
  "Cápsula": "bg-warm/10 text-warm border-warm/20",
  "Solúvel": "bg-primary/10 text-primary border-primary/20",
};

export default function ProductDetails() {
  const { id } = useParams();

  const [cart, setCart] = useState<CartItem[]>(getCart);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => { saveCart(cart); }, [cart]);

  const openCart = useCallback(() => setIsCartOpen(true), []);

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

  const cartSubtotal = useMemo(() => getCartSubtotal(cart), [cart]);
  const cartUnitCount = useMemo(() => cart.reduce((s, c) => s + c.quantity, 0), [cart]);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["product", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error("Produto não informado");
      const run = (columns: string) =>
        supabase.from(PRODUCTS_TABLE).select(columns).eq("id", id).eq("active", true).single();

      let { data, error } = await run(PRODUCT_SELECT_COLUMNS);
      if (error && isMissingImageUrlsColumnError(error.message)) {
        ({ data, error } = await run(PRODUCT_SELECT_COLUMNS_LEGACY));
      }
      if (error) throw error;
      return normalizeProductFromSupabaseRow(data);
    },
  });

  const handleAdd = () => {
    if (!product) return;
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
      return [...prev, { product, quantity: 1 }];
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando produto...
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Produto não encontrado.</p>
          <Link to="/">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Voltar ao catálogo
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const Icon = typeIcons[product.type] || Leaf;
  const galleryUrls = getProductImageUrls(product);

  return (
    <div className={`min-h-screen bg-background ${cart.length > 0 ? "pb-28" : ""}`}>
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <span className="font-semibold text-foreground">Detalhes do Produto</span>
          <div className="ml-auto">
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
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative rounded-xl border border-border bg-card overflow-hidden">
            {galleryUrls.length === 0 ? (
              <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                <ImageIcon className="w-16 h-16 text-muted-foreground/30" />
              </div>
            ) : galleryUrls.length === 1 ? (
              <img src={galleryUrls[0]} alt={product.name} className="aspect-[4/3] w-full object-cover" />
            ) : (
              <Carousel className="w-full" opts={{ loop: true }}>
                <CarouselContent className="-ml-2 md:-ml-4">
                  {galleryUrls.map((src, i) => (
                    <CarouselItem key={`${src}-${i}`} className="pl-2 md:pl-4 basis-full">
                      <div className="aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                        <img src={src} alt={product.name} className="h-full w-full object-cover" />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-2 border-0 bg-background/90 shadow-md" />
                <CarouselNext className="right-2 border-0 bg-background/90 shadow-md" />
              </Carousel>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`${typeColors[product.type] || ""} text-xs font-medium`}>
                <Icon className="w-3 h-3 mr-1" />
                {product.type}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {product.family}
              </Badge>
            </div>

            <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>

            <p className="text-2xl font-semibold text-primary tabular-nums">{formatBRL(coercePrice(product.price))}</p>

            <ProductDescription html={product.description} className="text-base" />

            <div className="pt-2">
              <Button onClick={handleAdd} className="gap-2">
                <Plus className="w-4 h-4" /> Adicionar ao carrinho
              </Button>
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
    </div>
  );
}
