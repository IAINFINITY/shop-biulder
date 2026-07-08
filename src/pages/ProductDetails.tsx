import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { type LucideIcon, ArrowLeft, Plus, Leaf, Pill, FlaskConical, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PRODUCTS_TABLE,
  normalizeProductFromSupabaseRow,
  getProductImageUrls,
  readCachedProductFromStorage,
  PRODUCT_SELECT_COLUMNS,
  PRODUCT_SELECT_COLUMNS_LEGACY,
  isMissingImageUrlsColumnError,
  isMissingPromotionColumnError,
} from "@/lib/products";
import { formatBRL } from "@/lib/formatMoney";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CartDrawer } from "@/components/carrinho/CartDrawer";
import { CartTotalBar } from "@/components/carrinho/CartTotalBar";
import { PageHeaderShell } from "@/components/layout/PageHeaderShell";
import { CatalogProductCard } from "@/components/catalogo/CatalogProductCard";
import { ProductDescription } from "@/components/catalogo/ProductDescription";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useCustomerPricing } from "@/hooks/useCustomerPricing";
import { useProducts } from "@/hooks/useProducts";
import { calculateCartSubtotal, resolveProductPrice } from "@/lib/pricing";

type ProductTypeTheme = {
  Icon: LucideIcon;
  className: string;
};

const TYPE_THEME_PALETTE: ProductTypeTheme[] = [
  { Icon: Leaf, className: "bg-success/10 text-success border-success/20" },
  { Icon: Pill, className: "bg-warm/10 text-warm border-warm/20" },
  { Icon: FlaskConical, className: "bg-primary/10 text-primary border-primary/20" },
];

function hashTypeName(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export default function ProductDetails() {
  const { id } = useParams();
  const { customerProfile } = useAuth();
  const customerType = customerProfile?.customer_type ?? null;
  const customerTprId = customerProfile?.proxis_tpr_id ?? null;
  const { data: allProducts = [] } = useProducts();
  const { data: customerPriceMap = new Map<string, number>() } = useCustomerPricing(
    customerType,
    customerTprId,
  );
  const storageCachedProduct = useMemo(() => (id ? readCachedProductFromStorage(id) : null), [id]);
  const cachedProduct = useMemo(
    () => storageCachedProduct ?? allProducts.find((item) => item.id === id) ?? null,
    [storageCachedProduct, allProducts, id],
  );

  const { cart, addToCart, updateQuantity, removeFromCart, clearCart } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageHovered, setIsImageHovered] = useState(false);
  const imageFrameRef = useRef<HTMLDivElement>(null);
  const productImageRef = useRef<HTMLImageElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const zoomPreviewRef = useRef<HTMLDivElement>(null);
  const pointerRafRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<{
    clientX: number;
    clientY: number;
    frameRect: DOMRect;
    imageRect: DOMRect;
  } | null>(null);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [id]);

  const openCart = useCallback(() => setIsCartOpen(true), []);

  const cartSubtotal = useMemo(() => calculateCartSubtotal(cart, customerPriceMap), [cart, customerPriceMap]);
  const cartUnitCount = useMemo(() => cart.reduce((s, c) => s + c.quantity, 0), [cart]);
  const cartIds = useMemo(() => new Set(cart.map((item) => item.product.id)), [cart]);

  const { data: liveProduct, isLoading, error } = useQuery({
    queryKey: ["product", id],
    enabled: !!id && !cachedProduct,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!id) throw new Error("Produto não informado");
      const run = (columns: string) =>
        supabase.from(PRODUCTS_TABLE).select(columns).eq("id", id).eq("active", true).single();

      let { data, error } = await run(PRODUCT_SELECT_COLUMNS);
      if (error && isMissingImageUrlsColumnError(error.message)) {
        ({ data, error } = await run(PRODUCT_SELECT_COLUMNS_LEGACY));
      }
      if (error && isMissingPromotionColumnError(error.message)) {
        ({ data, error } = await run(PRODUCT_SELECT_COLUMNS_LEGACY));
      }
      if (error) throw error;
      return normalizeProductFromSupabaseRow(data);
    },
  });

  const product = cachedProduct ?? liveProduct ?? null;

  const galleryUrls = product ? getProductImageUrls(product) : [];
  const selectedImage = galleryUrls[selectedImageIndex] ?? galleryUrls[0] ?? null;
  const productPrice = product ? resolveProductPrice(product, customerPriceMap) : 0;
  const typeThemeMap = useMemo(() => {
    const uniqueTypes = [...new Set(allProducts.map((item) => item.type).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );

    return uniqueTypes.reduce((acc, type, index) => {
      acc[type] = TYPE_THEME_PALETTE[hashTypeName(type) % TYPE_THEME_PALETTE.length] ?? TYPE_THEME_PALETTE[index % TYPE_THEME_PALETTE.length];
      return acc;
    }, {} as Record<string, ProductTypeTheme>);
  }, [allProducts]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [product.id]);

  useEffect(() => {
    if (!selectedImage) return;
    const preload = new Image();
    preload.src = selectedImage;
  }, [selectedImage]);

  useEffect(() => {
    return () => {
      if (pointerRafRef.current !== null) {
        window.cancelAnimationFrame(pointerRafRef.current);
      }
    };
  }, []);

  const quickFacts = product
    ? [
        { label: "Tipo", value: product.type },
        { label: "Família", value: product.family },
      ]
    : [];

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return allProducts
      .filter((candidate) => candidate.id !== product.id)
      .filter((candidate) => candidate.family === product.family || candidate.type === product.type)
      .sort((a, b) => {
        const aScore = a.family === product.family ? 2 : 1;
        const bScore = b.family === product.family ? 2 : 1;
        return bScore - aScore || a.name.localeCompare(b.name);
      })
      .slice(0, 4);
  }, [allProducts, product]);

  const handleAdd = () => {
    if (!product) return;
    addToCart(product);
  };

  const handleRelatedAdd = (targetProduct: (typeof allProducts)[number]) => {
    addToCart(targetProduct);
  };

  const handleImageMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!selectedImage) return;

      const frameRect = imageFrameRef.current.getBoundingClientRect();
      const imageRect = productImageRef.current.getBoundingClientRect();
      if (!frameRect || !imageRect || imageRect.width === 0 || imageRect.height === 0) return;

      pendingPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        frameRect,
        imageRect,
      };

      if (pointerRafRef.current !== null) return;

      pointerRafRef.current = window.requestAnimationFrame(() => {
        pointerRafRef.current = null;
        const pending = pendingPointerRef.current;
        if (!pending) return;

        const { clientX, clientY, frameRect, imageRect } = pending;
        const nextX = ((clientX - imageRect.left) / imageRect.width) * 100;
        const nextY = ((clientY - imageRect.top) / imageRect.height) * 100;
        const x = Math.min(100, Math.max(0, nextX));
        const y = Math.min(100, Math.max(0, nextY));
        const clampedClientX = Math.min(imageRect.right, Math.max(imageRect.left, clientX));
        const clampedClientY = Math.min(imageRect.bottom, Math.max(imageRect.top, clientY));
        const lensX = ((clampedClientX - frameRect.left) / frameRect.width) * 100;
        const lensY = ((clampedClientY - frameRect.top) / frameRect.height) * 100;

        if (lensRef.current) {
          lensRef.current.style.left = `${lensX}%`;
          lensRef.current.style.top = `${lensY}%`;
        }

        if (zoomPreviewRef.current) {
          zoomPreviewRef.current.style.backgroundPosition = `${x}% ${y}%`;
        }
      });
    },
    [selectedImage],
  );

  const zoomPreviewStyle = selectedImage
    ? {
        backgroundImage: `url(${selectedImage})`,
        backgroundPosition: "50% 50%",
        backgroundRepeat: "no-repeat",
        backgroundSize: "240%",
      }
    : undefined;

  if (isLoading && !product) {
    return (
      <div className={`min-h-screen bg-background ${cart.length > 0 ? "pb-28" : ""} flex flex-col`}>
        <PageHeaderShell>
          <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-5 w-44 rounded-md" />
              <div className="ml-auto">
                <Skeleton className="h-10 w-32 rounded-full" />
              </div>
          </div>
        </PageHeaderShell>

        <main className="flex flex-1 items-start">
          <div className="container mx-auto max-w-[1400px] px-4 py-4 lg:py-6">
            <div className="grid gap-4 xl:grid-cols-[92px_minmax(0,1.35fr)_minmax(360px,0.95fr)] xl:items-stretch">
              <div className="hidden xl:flex xl:flex-col xl:gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="aspect-square w-full rounded-lg" />
                ))}
              </div>

              <div className="min-w-0 self-stretch">
                <div className="relative flex h-full flex-col overflow-visible xl:min-h-[640px]">
                  <div className="flex flex-1 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                    <Skeleton className="h-[min(560px,70vw)] w-full rounded-none bg-muted/70" />
                  </div>
                </div>
              </div>

              <div className="self-stretch xl:sticky xl:top-5">
                <Card className="flex h-full flex-col overflow-hidden border-border/70 shadow-sm xl:min-h-[640px]">
                  <CardHeader className="space-y-3 p-4 sm:p-5">
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-7 w-20 rounded-full" />
                      <Skeleton className="h-7 w-24 rounded-full" />
                    </div>

                    <div className="space-y-3">
                      <Skeleton className="h-8 w-3/4 rounded-md" />
                      <Skeleton className="h-10 w-28 rounded-md" />
                    </div>

                    <Skeleton className="h-11 w-full rounded-xl sm:w-56" />
                  </CardHeader>

                  <CardContent className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
                    <div className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm sm:grid sm:grid-cols-3 sm:divide-x sm:divide-border/70">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="flex min-h-[84px] min-w-0 flex-col justify-center px-4 py-3 sm:px-5">
                          <Skeleton className="mb-3 h-3 w-16 rounded-md" />
                          <Skeleton className="h-5 w-24 rounded-md" />
                        </div>
                      ))}
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-6 w-28 rounded-md" />
                        <div className="h-px flex-1 bg-border/70" />
                      </div>

                      <div className="mt-3 space-y-3">
                        <Skeleton className="h-4 w-full rounded-md" />
                        <Skeleton className="h-4 w-[92%] rounded-md" />
                        <Skeleton className="h-4 w-[86%] rounded-md" />
                        <Skeleton className="h-4 w-[75%] rounded-md" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if ((error && !cachedProduct) || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground">Produto não encontrado.</p>
          <Link to="/" viewTransition>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const typeTheme = typeThemeMap[product.type] ?? TYPE_THEME_PALETTE[0];
  const Icon = typeTheme.Icon;
  const hasDescription = Boolean(product.description.trim());

  return (
      <div className={`min-h-screen bg-background ${cart.length > 0 ? "pb-28" : ""} flex flex-col`}>
        <PageHeaderShell>
          <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" viewTransition>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full border border-border bg-background shadow-sm">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <span className="truncate font-semibold text-foreground">Detalhes do Produto</span>
          </div>

          <div />

          <div className="justify-self-end">
            <CartDrawer
              cart={cart}
              onUpdateQuantity={updateQuantity}
              onRemove={removeFromCart}
              onClear={clearCart}
              open={isCartOpen}
              onOpenChange={setIsCartOpen}
              resolveUnitPrice={(currentProduct) => resolveProductPrice(currentProduct, customerPriceMap)}
            />
          </div>
        </div>
      </PageHeaderShell>

      <main className="flex flex-1 items-start">
        <div className="container mx-auto max-w-[1400px] px-4 py-4 lg:py-6">
          <div className="grid gap-4 xl:grid-cols-[92px_minmax(0,1.18fr)_minmax(360px,0.92fr)] xl:items-start">
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
              <div className="relative flex h-full flex-col overflow-visible xl:min-h-[640px]">
                <div className="flex flex-1 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                  <div
                    ref={imageFrameRef}
                    className="relative flex flex-1 cursor-zoom-in items-center justify-center bg-background p-4 sm:p-6"
                    onMouseEnter={() => setIsImageHovered(true)}
                    onMouseLeave={() => setIsImageHovered(false)}
                    onMouseMove={handleImageMove}
                  >
                  {selectedImage ? (
                      <img
                        ref={productImageRef}
                        src={selectedImage}
                        alt={product.name}
                        className="max-h-[560px] w-full max-w-[560px] object-contain object-center transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-background p-8">
                        <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
                      </div>
                    )}
                    {selectedImage && (
                      <>
                        <div
                          className={`pointer-events-none absolute inset-0 bg-black/8 transition-opacity duration-150 ${
                            isImageHovered ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <div
                          ref={lensRef}
                          className={`pointer-events-none absolute h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/50 bg-black/5 shadow-lg transition-opacity duration-150 ${
                            isImageHovered ? "opacity-100" : "opacity-0"
                          }`}
                          style={{ left: "50%", top: "50%" }}
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
                  {selectedImage ? (
                    <div
                      ref={zoomPreviewRef}
                      className="h-full w-full"
                      style={zoomPreviewStyle}
                    />
                  ) : null}
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
                <CardHeader className="space-y-4 p-4 sm:p-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={`${typeTheme.className} text-xs font-medium`}>
                      <Icon className="mr-1 h-3 w-3" />
                      {product.type}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {product.family}
                    </Badge>
                    {product.is_promotion ? (
                      <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-xs text-primary">
                        Promoção
                      </Badge>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <CardTitle className="text-[1.75rem] leading-tight tracking-tight sm:text-[2rem]">
                      {product.name}
                    </CardTitle>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                        Preço
                      </p>
                      <p className="text-3xl font-semibold text-primary tabular-nums">{formatBRL(productPrice)}</p>
                    </div>

                    <Button onClick={handleAdd} className="w-full gap-2 sm:w-auto">
                      <Plus className="h-4 w-4" /> Adicionar ao carrinho
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
                  <div className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm grid grid-cols-1 sm:grid-cols-3 sm:divide-x sm:divide-border/70">
                    {quickFacts.map((fact) => (
                      <div
                        key={fact.label}
                        className="flex min-h-[76px] min-w-0 flex-col justify-center px-4 py-3 sm:px-4"
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                          {fact.label}
                        </div>
                        <div className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground sm:text-[14px]">
                          {fact.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">Descrição</CardTitle>
                      <span className="hidden text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                        Conteúdo
                      </span>
                    </div>

                    <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                      {hasDescription ? (
                        <ProductDescription
                          html={product.description}
                          className="text-sm leading-7 text-foreground/90 sm:text-base sm:leading-8"
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

          {relatedProducts.length > 0 && (
            <section className="mt-6">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">Produtos relacionados</h2>
                  <p className="text-sm text-muted-foreground">
                    Outros itens da mesma família ou tipo para complementar a compra.
                  </p>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Sugestões
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {relatedProducts.map((related) => (
                  <CatalogProductCard
                    key={related.id}
                    product={related}
                    price={resolveProductPrice(related, customerPriceMap)}
                    onAdd={handleRelatedAdd}
                    inCart={cartIds.has(related.id)}
                  />
                ))}
              </div>
            </section>
          )}
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
