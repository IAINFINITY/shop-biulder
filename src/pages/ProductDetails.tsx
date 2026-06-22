import { useState, useEffect, useCallback, useMemo, type MouseEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { type LucideIcon, ArrowLeft, Plus, Leaf, Pill, FlaskConical, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PRODUCTS_TABLE,
  CartItem,
  getCart,
  saveCart,
  normalizeProductFromSupabaseRow,
  getProductImageUrls,
  PRODUCT_SELECT_COLUMNS,
  PRODUCT_SELECT_COLUMNS_LEGACY,
  isMissingImageUrlsColumnError,
} from "@/lib/products";
import { formatBRL } from "@/lib/formatMoney";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CartDrawer } from "@/components/carrinho/CartDrawer";
import { CartTotalBar } from "@/components/carrinho/CartTotalBar";
import { toast } from "sonner";
import { ProductDescription } from "@/components/catalogo/ProductDescription";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerPricing } from "@/hooks/useCustomerPricing";
import { calculateCartSubtotal, resolveProductPrice } from "@/lib/pricing";

const typeIcons: Record<string, LucideIcon> = {
  Chá: Leaf,
  Cápsula: Pill,
  Solúvel: FlaskConical,
};

const typeColors: Record<string, string> = {
  Chá: "bg-success/10 text-success border-success/20",
  Cápsula: "bg-warm/10 text-warm border-warm/20",
  Solúvel: "bg-primary/10 text-primary border-primary/20",
};

export default function ProductDetails() {
  const { id } = useParams();
  const { customerProfile } = useAuth();
  const { data: customerPriceMap = new Map<string, number>() } = useCustomerPricing(
    customerProfile?.customer_type,
  );

  const [cart, setCart] = useState<CartItem[]>(getCart);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageHovered, setIsImageHovered] = useState(false);
  const [imagePointer, setImagePointer] = useState({ x: 50, y: 50 });

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  const openCart = useCallback(() => setIsCartOpen(true), []);

  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setCart((prev) =>
      prev.map((c) => (c.product.id === itemId ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c)),
    );
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== itemId));
  }, []);

  const updateNotes = useCallback((itemId: string, notes: string) => {
    setCart((prev) => prev.map((c) => (c.product.id === itemId ? { ...c, notes } : c)));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const cartSubtotal = useMemo(() => calculateCartSubtotal(cart, customerPriceMap), [cart, customerPriceMap]);
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

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [product?.id]);

  const galleryUrls = product ? getProductImageUrls(product) : [];
  const selectedImage = galleryUrls[selectedImageIndex] ?? galleryUrls[0] ?? null;
  const productPrice = product ? resolveProductPrice(product, customerPriceMap) : 0;

  const quickFacts = product
    ? [
        { label: "Tipo", value: product.type },
        { label: "Família", value: product.family },
        { label: "Status", value: "Disponível" },
      ]
    : [];

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

  const handleImageMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!selectedImage) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      setImagePointer({
        x: Math.min(100, Math.max(0, x)),
        y: Math.min(100, Math.max(0, y)),
      });
    },
    [selectedImage],
  );

  const zoomPreviewStyle = selectedImage
    ? {
        backgroundImage: `url(${selectedImage})`,
        backgroundPosition: `${imagePointer.x}% ${imagePointer.y}%`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "230%",
      }
    : undefined;

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
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground">Produto não encontrado.</p>
          <Link to="/">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const Icon = typeIcons[product.type] || Leaf;
  const hasDescription = Boolean(product.description?.trim());

  return (
    <div className={`min-h-screen bg-background ${cart.length > 0 ? "pb-28" : ""} flex flex-col`}>
      <header className="border-b border-border bg-card/95 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center gap-3 px-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
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
              resolveUnitPrice={(currentProduct) => resolveProductPrice(currentProduct, customerPriceMap)}
            />
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-start">
        <div className="container mx-auto max-w-7xl px-4 py-4 lg:py-6">
          <div className="grid gap-4 xl:grid-cols-[92px_minmax(0,1.35fr)_minmax(360px,0.95fr)] xl:items-stretch">
            <div className="hidden xl:flex xl:sticky xl:top-5 xl:flex-col xl:gap-2">
              {galleryUrls.length > 0 ? (
                galleryUrls.map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    className={`overflow-hidden rounded-lg border bg-background p-1 transition-all ${
                      index === selectedImageIndex
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border/70 hover:border-primary/40"
                    }`}
                    aria-label={`Ver imagem ${index + 1}`}
                  >
                    <img src={src} alt="" className="aspect-square h-full w-full rounded-md object-contain" />
                  </button>
                ))
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-lg border border-border/70 bg-muted/30">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
            </div>

            <div className="min-w-0 self-stretch">
              <div
                className="relative flex h-full flex-col overflow-visible xl:min-h-[640px]"
                onMouseEnter={() => setIsImageHovered(true)}
                onMouseLeave={() => setIsImageHovered(false)}
                onMouseMove={handleImageMove}
              >
                <div className="flex flex-1 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                  <div className="relative flex flex-1 items-center justify-center bg-background p-6 sm:p-8">
                    {selectedImage ? (
                      <img
                        src={selectedImage}
                        alt={product.name}
                        className="max-h-[560px] w-full max-w-[560px] object-contain object-center"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-background p-8">
                        <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
                      </div>
                    )}
                    {selectedImage && (
                      <>
                        <div
                          className={`pointer-events-none absolute inset-0 bg-black/10 transition-opacity duration-200 ${
                            isImageHovered ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <div
                          className={`pointer-events-none absolute h-[40%] w-[40%] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/40 bg-black/15 shadow-[0_0_0_9999px_rgba(0,0,0,0.08)] transition-opacity duration-200 ${
                            isImageHovered ? "opacity-100" : "opacity-0"
                          }`}
                          style={{ left: `${imagePointer.x}%`, top: `${imagePointer.y}%` }}
                        />
                      </>
                    )}
                  </div>
                </div>

                <div
                  className={`pointer-events-none absolute right-4 top-4 z-20 hidden h-[38%] w-[38%] overflow-hidden rounded-xl border border-border/70 bg-muted/80 shadow-lg xl:block ${
                    selectedImage && isImageHovered ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {selectedImage ? <div className="h-full w-full" style={zoomPreviewStyle} /> : null}
                </div>
              </div>

              {galleryUrls.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 xl:hidden">
                  {galleryUrls.map((src, index) => (
                    <button
                      key={`${src}-${index}`}
                      type="button"
                      onClick={() => setSelectedImageIndex(index)}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-background p-1 ${
                        index === selectedImageIndex
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border/70"
                      }`}
                      aria-label={`Ver imagem ${index + 1}`}
                    >
                      <img src={src} alt="" className="h-full w-full rounded-md object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="self-stretch xl:sticky xl:top-5">
              <Card className="flex h-full flex-col overflow-hidden border-border/70 shadow-sm xl:min-h-[640px]">
                <CardHeader className="space-y-3 p-4 sm:p-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={`${typeColors[product.type] || ""} text-xs font-medium`}>
                      <Icon className="mr-1 h-3 w-3" />
                      {product.type}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {product.family}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-[1.9rem] leading-tight tracking-tight">{product.name}</CardTitle>
                    <p className="text-3xl font-semibold text-primary tabular-nums">{formatBRL(productPrice)}</p>
                  </div>

                  <Button onClick={handleAdd} className="w-full gap-2 sm:w-fit">
                    <Plus className="h-4 w-4" /> Adicionar ao carrinho
                  </Button>
                </CardHeader>

                <CardContent className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
                  <div className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm sm:grid sm:grid-cols-3 sm:divide-x sm:divide-border/70">
                    {quickFacts.map((fact) => (
                      <div
                        key={fact.label}
                        className="flex min-h-[84px] min-w-0 flex-col justify-center px-4 py-3 sm:px-5"
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                          {fact.label}
                        </div>
                        <div className="mt-1 truncate text-sm font-medium leading-snug text-foreground sm:text-[14px]">
                          {fact.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">Descrição</CardTitle>
                      <div className="h-px flex-1 bg-border/70" />
                    </div>

                    <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                      {hasDescription ? (
                        <ProductDescription
                          html={product.description}
                          className="text-sm leading-6 sm:text-base sm:leading-7"
                        />
                      ) : (
                        <p className="text-sm leading-6 text-muted-foreground">
                          Sem descrição disponível para este produto.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <CartTotalBar
        total={cartSubtotal}
        itemCount={cartUnitCount}
        visible={cart.length > 0}
        onOpenCart={openCart}
      />
    </div>
  );
}
