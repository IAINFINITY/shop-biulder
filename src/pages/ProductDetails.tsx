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
import { type LucideIcon, ArrowLeft, Plus, Minus, Heart, Leaf, Pill, FlaskConical, ImageIcon, ShieldCheck, Truck, RotateCcw, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { StickyBottomCTA } from "@/components/mobile/StickyBottomCTA";
import { TouchCarousel } from "@/components/mobile/TouchCarousel";
import { useAuth } from "@/hooks/useAuth";
import { useProductReviews } from "@/hooks/useProductReviews";
import { StarRating } from "@/components/catalogo/StarRating";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { REVIEW_TAGS } from "@/hooks/useProductReviews";
import { useCart } from "@/hooks/useCart";
import { useCustomerPricing } from "@/hooks/useCustomerPricing";
import { useProducts } from "@/hooks/useProducts";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { useWishlist } from "@/hooks/useWishlist";
import { calculateCartSubtotal, resolveProductPrice } from "@/lib/pricing";
import { toast } from "sonner";

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
  const { user, customerProfile } = useAuth();
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
  const [quantity, setQuantity] = useState(1);
  const [isImageHovered, setIsImageHovered] = useState(false);
  const imageFrameRef = useRef<HTMLDivElement>(null);
  const productImageRef = useRef<HTMLImageElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const zoomPreviewRef = useRef<HTMLDivElement>(null);
  const pointerRafRef = useRef<number | null>(null);
  const relatedRowRef = useRef<HTMLDivElement>(null);
  const [relatedPage, setRelatedPage] = useState(0);
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

  const { add: addToRecentlyViewed } = useRecentlyViewed();
  const { ids: wishlistIds, toggle: toggleWishlist } = useWishlist();
  const [reviewPage, setReviewPage] = useState(1);
  const { data: reviewData = { reviews: [], totalCount: 0, totalPages: 1 }, addReview, updateReview, deleteReview } = useProductReviews(id, reviewPage);
  const { reviews, totalCount: reviewTotalCount, totalPages: reviewTotalPages } = reviewData;
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewTags, setReviewTags] = useState<string[]>([]);

  useEffect(() => {
    if (id) addToRecentlyViewed(id);
  }, [id, addToRecentlyViewed]);

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

  const averageRating = useMemo(() => {
    if (product && product.average_rating > 0) return product.average_rating;
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [product, reviews]);

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
    setQuantity(1);
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
      .slice(0, 10);
  }, [allProducts, product]);

  const handleAdd = () => {
    if (!product) return;
    addToCart(product, quantity);
    setQuantity(1);
  };

  const decQuantity = () => setQuantity((q) => Math.max(1, q - 1));
  const incQuantity = () => setQuantity((q) => Math.min(99, q + 1));

  const handleRelatedAdd = (targetProduct: (typeof allProducts)[number]) => {
    addToCart(targetProduct);
  };

  const scrollRelated = (direction: -1 | 1) => {
    if (!relatedRowRef.current) return;
    const distance = Math.max(relatedRowRef.current.clientWidth * 0.75, 280);
    relatedRowRef.current.scrollBy({ left: direction * distance, behavior: "smooth" });
  };

  const relatedTotalPages = Math.max(1, Math.ceil(relatedProducts.length / 5));

  useEffect(() => {
    const el = relatedRowRef.current;
    if (!el || relatedTotalPages <= 1) return;
    const onScroll = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) { setRelatedPage(0); return; }
      const ratio = el.scrollLeft / maxScroll;
      const page = Math.round(ratio * (relatedTotalPages - 1));
      setRelatedPage(Math.min(relatedTotalPages - 1, Math.max(0, page)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [relatedTotalPages]);

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
      <div className="min-h-screen bg-muted/40 pb-28 flex flex-col">
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
      <div className="min-h-screen bg-muted/40 pb-28 flex flex-col">
        <PageHeaderShell>
          <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <Link to="/" viewTransition className="shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border border-border bg-background shadow-sm">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <span className="text-muted-foreground/30 hidden sm:inline select-none">/</span>
              <Link to="/" viewTransition className="hidden sm:inline hover:text-foreground transition-colors truncate">
                Catálogo
              </Link>
              <span className="text-muted-foreground/30 hidden sm:inline select-none">/</span>
              <span className="hidden sm:inline text-foreground font-medium truncate">{product.type}</span>
            </div>

            <div />

            <div className="hidden justify-self-end xl:block">
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
                    <img src={src} alt="" width={1200} height={900} loading="lazy" decoding="async" className="aspect-square h-full w-full rounded-md object-contain" />
                  </button>
                ))
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-lg border border-border/70 bg-muted/30">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
            </div>

            <div className="min-w-0 self-stretch">
               <div className="xl:hidden">
                {galleryUrls.length > 0 ? (
                  <>
                    <TouchCarousel aspectRatio="aspect-square" showDots>
                      {galleryUrls.map((url, i) => (
                        <div key={i} className="flex h-full w-full items-center justify-center bg-background p-2">
                          <img src={url} alt={product.name} className="h-full w-full object-contain" />
                        </div>
                      ))}
                    </TouchCarousel>
                    {galleryUrls.length > 1 && (
                      <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] pb-1">
                        {galleryUrls.map((url, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSelectedImageIndex(i)}
                            className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-background p-0.5 transition-all ${
                              i === selectedImageIndex ? "border-primary ring-2 ring-primary/20" : "border-border/70"
                            }`}
                            aria-label={`Ver imagem ${i + 1}`}
                          >
                            <img src={url} alt="" width={1200} height={900} loading="lazy" decoding="async" className="h-full w-full rounded-md object-contain" />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-2xl border border-border/70 bg-muted/30">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}
              </div>

              <div className="relative hidden xl:flex h-full flex-col overflow-visible xl:min-h-[640px]">
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
                        width={1200}
                        height={900}
                        fetchPriority="high"
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
                  </div>

                  <div className="space-y-3">
                    <CardTitle className="text-[1.75rem] leading-tight tracking-tight sm:text-[2rem]">
                      {product.name}
                    </CardTitle>
                    {product.is_promotion && (
                      <Badge className="bg-primary text-primary-foreground text-xs font-semibold">
                        Promoção
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                        Preço
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-3xl font-semibold text-foreground tabular-nums">{formatBRL(productPrice)}</p>
                      </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleWishlist(product.id)}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                          wishlistIds.includes(product.id)
                            ? "border-primary/30 bg-primary/5 text-primary"
                            : "border-border/60 bg-background text-muted-foreground hover:text-primary hover:border-primary/30",
                        )}
                        aria-label={wishlistIds.includes(product.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                      >
                        <Heart className={cn("h-4 w-4", wishlistIds.includes(product.id) && "fill-current")} />
                      </button>
                      <div className="flex items-center rounded-full border border-border/60 bg-background shadow-sm">
                        <button
                          type="button"
                          onClick={decQuantity}
                          disabled={quantity <= 1}
                          className="flex h-9 w-9 items-center justify-center rounded-l-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="flex h-9 min-w-[2.5rem] items-center justify-center text-sm font-semibold tabular-nums text-foreground">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={incQuantity}
                          disabled={quantity >= 99}
                          className="flex h-9 w-9 items-center justify-center rounded-r-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Button onClick={handleAdd} className="gap-2">
                        <Plus className="h-4 w-4" /> Adicionar ao carrinho
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" />
                      <span className="hidden sm:inline">Pagamento seguro</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-4 w-4" />
                      <span className="hidden sm:inline">Entrega rápida</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RotateCcw className="h-4 w-4" />
                      <span className="hidden sm:inline">Garantia</span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-foreground">Sobre este item</h3>
                    <ul className="space-y-1.5">
                      {[
                        { label: "Tipo", value: product.type },
                        { label: "Família", value: product.family },
                      ].map((item) => (
                        <li key={item.label} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <span><strong className="text-foreground">{item.label}:</strong> {item.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {hasDescription && (
            <section className="mt-8">
              <h2 className="mb-4 text-lg font-bold tracking-tight text-foreground sm:text-xl">Descrição do produto</h2>
              <div className="rounded-xl border border-border/70 bg-background p-5 sm:p-6">
                <ProductDescription
                  html={product.description}
                  className="text-sm leading-7 text-foreground/90 sm:text-base sm:leading-8"
                />
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="mb-4 text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Avaliações
              {averageRating > 0 && (
                <span className="ml-2 inline-flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
                  <StarRating rating={Math.round(averageRating)} size="sm" />
                  <span className="tabular-nums">{averageRating.toFixed(1)}</span>
                  <span>({reviewTotalCount})</span>
                </span>
              )}
            </h2>

            <div className="rounded-xl border border-border/70 bg-background p-5 sm:p-6">
              {reviewTotalCount > 0 && (
                <div className="mb-6 space-y-1.5 pb-4 border-b border-border/30">
                  {[5,4,3,2,1].map((star) => {
                    const count = reviews.filter((r) => r.rating === star).length;
                    const pct = reviewTotalCount > 0 ? (count / reviewTotalCount) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="w-4 text-right tabular-nums text-muted-foreground">{star}</span>
                        <Star className="h-3 w-3 text-amber-400 fill-current" />
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 text-right tabular-nums text-muted-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma avaliação ainda.</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b border-border/40 pb-4 last:border-0 last:pb-0">
                      <div className="mb-2 flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                            {review.user_name?.charAt(0).toUpperCase() ?? "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground leading-tight">{review.user_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <StarRating rating={review.rating} size="sm" />
                      </div>

                      {review.tags.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {review.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-primary/5 px-2 py-0.5 text-[10px] text-primary">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {review.title && (
                        <p className="text-sm font-semibold text-foreground">{review.title}</p>
                      )}
                      {review.comment && (
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
                      )}

                      {review.admin_response && (
                        <div className="mt-3 rounded-lg border border-border/30 bg-muted/50 p-3">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Resposta do vendedor
                          </p>
                          <p className="text-sm text-foreground">{review.admin_response}</p>
                          {review.admin_responded_at && (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {new Date(review.admin_responded_at).toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {reviewTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                    disabled={reviewPage <= 1}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                  >
                    ← Anterior
                  </button>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {reviewPage} / {reviewTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReviewPage((p) => Math.min(reviewTotalPages, p + 1))}
                    disabled={reviewPage >= reviewTotalPages}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                  >
                    Próximo →
                  </button>
                </div>
              )}

              {user ? (
                !showReviewForm ? (
                  <button
                    type="button"
                    onClick={() => {
                      const existing = reviews.find((r) => r.user_id === user.id);
                      if (existing) {
                        setEditingReviewId(existing.id);
                        setReviewRating(existing.rating);
                        setReviewTitle(existing.title ?? "");
                        setReviewComment(existing.comment ?? "");
                        setReviewTags(existing.tags);
                      } else {
                        setEditingReviewId(null);
                        setReviewRating(0);
                        setReviewTitle("");
                        setReviewComment("");
                        setReviewTags([]);
                      }
                      setShowReviewForm(true);
                    }}
                    className="mt-4 text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    {reviews.some((r) => r.user_id === user.id) ? "Editar minha avaliação" : "Avaliar este produto"}
                  </button>
                ) : (
                  <div className="mt-4 space-y-3 border-t border-border/40 pt-4">
                    <p className="text-sm font-semibold text-foreground">
                      {editingReviewId ? "Editar avaliação" : "Sua avaliação"}
                    </p>
                    <div>
                      <StarRating rating={reviewRating} size="lg" interactive onChange={setReviewRating} />
                    </div>
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="Título (opcional)"
                        maxLength={100}
                        value={reviewTitle}
                        onChange={(e) => setReviewTitle(e.target.value)}
                        className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <p className="text-right text-[10px] text-muted-foreground/60">{reviewTitle.length}/100</p>
                    </div>
                    <div className="space-y-1">
                      <textarea
                        placeholder="Escreva seu comentário..."
                        maxLength={500}
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <p className="text-right text-[10px] text-muted-foreground/60">{reviewComment.length}/500</p>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Marcadores</p>
                      <div className="flex flex-wrap gap-1.5">
                        {REVIEW_TAGS.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              setReviewTags((prev) =>
                                prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                              )
                            }
                            className={cn(
                              "rounded-full px-2.5 py-1 text-xs transition-colors",
                              reviewTags.includes(tag)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/80",
                            )}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          if (reviewRating < 1) return;
                          try {
                            if (editingReviewId) {
                              await updateReview(editingReviewId, {
                                rating: reviewRating,
                                title: reviewTitle,
                                comment: reviewComment,
                                tags: reviewTags,
                              });
                            } else {
                              await addReview({ rating: reviewRating, title: reviewTitle, comment: reviewComment, tags: reviewTags }, user.id);
                            }
                            setReviewRating(0);
                            setReviewTitle("");
                            setReviewComment("");
                            setReviewTags([]);
                            setEditingReviewId(null);
                            setShowReviewForm(false);
                            toast.success("Avaliação salva com sucesso!");
                          } catch (e) { console.error("Erro ao salvar avaliação", e); toast.error(e instanceof Error ? e.message : "Erro ao salvar avaliação"); }
                        }}
                        disabled={reviewRating < 1}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                      >
                        {editingReviewId ? "Salvar alterações" : "Enviar avaliação"}
                      </button>
                      {editingReviewId && (
                        <ConfirmActionDialog
                          trigger={
                            <button
                              type="button"
                              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-100"
                            >
                              Excluir
                            </button>
                          }
                          title="Excluir avaliação"
                          description="Tem certeza que deseja excluir esta avaliação? Esta ação não pode ser desfeita."
                          confirmLabel="Excluir"
                          cancelLabel="Cancelar"
                          destructive
                          onConfirm={async () => {
                            try {
                              await deleteReview(editingReviewId);
                              setShowReviewForm(false);
                              setEditingReviewId(null);
                              setReviewRating(0);
                              setReviewTitle("");
                              setReviewComment("");
                              setReviewTags([]);
                              toast.success("Avaliação excluída!");
                            } catch (e) { console.error("Erro ao excluir avaliação", e); toast.error(e instanceof Error ? e.message : "Erro ao excluir avaliação"); }
                          }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setShowReviewForm(false);
                          setEditingReviewId(null);
                          setReviewRating(0);
                          setReviewTitle("");
                          setReviewComment("");
                          setReviewTags([]);
                        }}
                        className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Faça <Link to="/login" className="text-primary underline underline-offset-2">login</Link> para avaliar este produto.
                </p>
              )}
            </div>
          </section>

          {relatedProducts.length > 0 && (
            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Produtos relacionados</h2>
                <div className="flex items-center gap-1.5">
                  {relatedTotalPages > 1 && (
                    <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                      Página {relatedPage + 1}/{relatedTotalPages}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => scrollRelated(-1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:text-primary sm:h-9 sm:w-9"
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollRelated(1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:text-primary sm:h-9 sm:w-9"
                    aria-label="Próximo"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="group relative">
                <div
                  ref={relatedRowRef}
                  className="flex gap-3 overflow-x-auto overscroll-x-contain [scrollbar-width:none] snap-x snap-mandatory scroll-smooth pb-2"
                >
                  {relatedProducts.map((related) => (
                    <div key={related.id} className="w-[55%] shrink-0 snap-start sm:w-[38%] md:w-[28%] lg:w-[calc(20%-0.6rem)]">
                      <CatalogProductCard
                        product={related}
                        price={resolveProductPrice(related, customerPriceMap)}
                        onAdd={handleRelatedAdd}
                        inCart={cartIds.has(related.id)}
                        compact
                        isWishlisted={wishlistIds.includes(related.id)}
                        onToggleWishlist={() => toggleWishlist(related.id)}
                      />
                    </div>
                  ))}
                </div>
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

      <StickyBottomCTA>
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Preço
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-semibold text-foreground tabular-nums">{formatBRL(productPrice)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                wishlistIds.includes(product.id)
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border/60 bg-background text-muted-foreground",
              )}
              aria-label={wishlistIds.includes(product.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            >
              <Heart className={cn("h-4 w-4", wishlistIds.includes(product.id) && "fill-current")} />
            </button>
            <div className="flex items-center rounded-full border border-border/60 bg-background shadow-sm">
              <button
                type="button"
                onClick={decQuantity}
                disabled={quantity <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-l-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="flex h-9 min-w-[2.5rem] items-center justify-center text-sm font-semibold tabular-nums text-foreground">
                {quantity}
              </span>
              <button
                type="button"
                onClick={incQuantity}
                disabled={quantity >= 99}
                className="flex h-9 w-9 items-center justify-center rounded-r-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button onClick={handleAdd} className="gap-2 shrink-0" size="sm">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>
      </StickyBottomCTA>
    </div>
  );
}
