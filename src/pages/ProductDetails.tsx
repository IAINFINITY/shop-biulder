import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import {
  caminhoDoProduto,
  codigoNaUrl,
  encontrarProdutoPelaUrl,
  identificadorDoProduto,
} from "@/lib/urlDoProduto";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Minus, Heart, ImageIcon, ShieldCheck, ChevronLeft, ChevronRight, Star, Hash, Package, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_CONTAINER } from "@/lib/pageLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  PRODUCTS_TABLE,
  normalizeProductFromSupabaseRow,
  getProductImageUrls,
  readCachedProductFromStorage,
  getProductImageAlt,
  getProductDiscount,
  buildProductSelectColumns,
  detectMissingProductColumn,
} from "@/lib/products";
import { formatBRL } from "@/lib/formatMoney";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { CartDrawer } from "@/components/carrinho/CartDrawer";
import { CatalogProductCard } from "@/components/catalogo/CatalogProductCard";
import { ProductDescription } from "@/components/catalogo/ProductDescription";
import { ProductGalleryModal } from "@/components/catalogo/ProductGalleryModal";
import { CatalogSectionHeader } from "@/components/catalogo/CatalogSectionHeader";
import { ProductImageFrame } from "@/components/catalogo/ProductImageFrame";
import { ProductMediaGallery } from "@/components/catalogo/ProductMediaGallery";
import { ProductInfoPanel } from "@/components/catalogo/ProductInfoPanel";
import { PromoDuo, PromoUnico } from "@/components/catalogo/PromoBanners";
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
import { EMPTY_PRICE_MAP, resolveProductPrice } from "@/lib/pricing";
import { toast } from "sonner";

function QuantityStepper({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(String(value));
    }
  }, [isEditing, value]);

  const commitDraft = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    setDraft(digits);
    if (digits === "") return;

    const parsed = Number.parseInt(digits, 10);
    if (Number.isFinite(parsed)) {
      onChange(Math.max(1, parsed));
    }
  };

  return (
    <div className={cn("flex items-center rounded-full border border-border/60 bg-background shadow-sm", className)}>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        className="flex h-10 w-10 items-center justify-center rounded-l-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
      >
        <Minus className="h-3 w-3" />
      </button>
      <Input
        type="text"
        inputMode="numeric"
        value={isEditing ? draft : String(value)}
        onFocus={() => {
          setIsEditing(true);
          setDraft(String(value));
        }}
        onChange={(event) => commitDraft(event.target.value)}
        onBlur={() => {
          setIsEditing(false);
          if (draft.trim() === "") {
            setDraft(String(value));
          }
        }}
        className="h-10 w-16 border-0 bg-transparent px-0 text-center text-sm font-semibold tabular-nums shadow-none focus-visible:ring-0"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-10 w-10 items-center justify-center rounded-r-full text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function ProductDetails() {
  const { id } = useParams();
  const { user, customerProfile } = useAuth();
  const customerType = customerProfile?.customer_type ?? null;
  const customerTprId = customerProfile?.proxis_tpr_id ?? null;
  const { data: allProducts = [] } = useProducts();
  const { data: customerPriceMap = EMPTY_PRICE_MAP } = useCustomerPricing(
    customerType,
    customerTprId,
  );
  const storageCachedProduct = useMemo(() => (id ? readCachedProductFromStorage(id) : null), [id]);
  const cachedProduct = useMemo(
    () => storageCachedProduct ?? encontrarProdutoPelaUrl(allProducts, id),
    [storageCachedProduct, allProducts, id],
  );

  const { cart, addToCart, updateQuantity, removeFromCart, clearCart } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [relatedCarouselApi, setRelatedCarouselApi] = useState<CarouselApi>();
  const [relatedPage, setRelatedPage] = useState(0);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [id]);

  const navigate = useNavigate();
  const location = useLocation();
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

  const cartIds = useMemo(() => new Set(cart.map((item) => item.product.id)), [cart]);

  const { data: liveProduct, isLoading, error } = useQuery({
    queryKey: ["product", id],
    enabled: !!id && !cachedProduct,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!id) throw new Error("Produto não informado");

      // Este caminho e o acesso direto: alguem colou o endereco e o catalogo
      // ainda nao carregou. Sem a lista em maos nao da para usar
      // `encontrarProdutoPelaUrl`, entao a coluna do filtro sai do formato do
      // que veio na URL — UUID e `id`, o resto e codigo (com ou sem slug).
      const ehUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const coluna = ehUuid ? "id" : "product_code";
      const valor = ehUuid ? id : (codigoNaUrl(id) ?? id);

      const run = (columns: string) =>
        supabase.from(PRODUCTS_TABLE).select(columns).eq(coluna, valor).eq("active", true).single();

      const omitted: string[] = [];
      let { data, error } = await run(buildProductSelectColumns());

      // Mesma degradacao progressiva do catalogo: derruba a coluna ausente e
      // tenta de novo, ate o banco aceitar a consulta.
      while (error) {
        const missingColumn = detectMissingProductColumn(error.message);
        if (!missingColumn || omitted.includes(missingColumn)) throw error;
        omitted.push(missingColumn);
        ({ data, error } = await run(buildProductSelectColumns(omitted)));
      }

      return normalizeProductFromSupabaseRow(data);
    },
  });

  const product = cachedProduct ?? liveProduct ?? null;

  /**
   * Endereco antigo cai no atual.
   *
   * Link com UUID, com codigo puro ou com o nome de antes de o produto ser
   * renomeado continuam abrindo — a resolucao aceita todos. Mas deixar a barra
   * de endereco mostrando a forma velha significa que sera ela a ser copiada e
   * compartilhada de novo, e que o buscador vera a mesma pagina em varios
   * enderecos. `replace` para nao criar volta para o endereco morto.
   */
  useEffect(() => {
    if (!product || !id) return;
    const canonico = identificadorDoProduto(product);
    if (canonico === id) return;
    navigate(caminhoDoProduto(product) + location.search + location.hash, { replace: true });
  }, [product, id, navigate, location.search, location.hash]);

  const averageRating = useMemo(() => {
    if (product && product.average_rating > 0) return product.average_rating;
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [product, reviews]);

  const galleryUrls = product ? getProductImageUrls(product) : [];
  const selectedImage = galleryUrls[selectedImageIndex] ?? galleryUrls[0] ?? null;
  const productPrice = product ? resolveProductPrice(product, customerPriceMap) : 0;
  const selectedTotalPrice = productPrice * quantity;
  const discount = product ? getProductDiscount(product, productPrice) : null;
  const summaryFacts = useMemo(() => {
    if (!product) return [];

    return [
      {
        icon: Hash,
        label: "Código",
        value: product.product_code?.trim() || "Sem código",
      },
      {
        icon: Package,
        label: "Categoria",
        value: `${product.type} · ${product.family}`,
      },
      {
        icon: Sparkles,
        label: "Marca",
        value: product.brand?.trim() || "Não informada",
      },
      {
        icon: ShieldCheck,
        label: "Estoque",
        value:
          typeof product.stock === "number"
            ? product.stock > 0
              ? `${product.stock} unidade${product.stock === 1 ? "" : "s"}`
              : "Sem estoque"
            : "Consulte disponibilidade",
      },
      {
        icon: Star,
        label: "Avaliação",
        value:
          product.review_count > 0
            ? `${product.average_rating.toFixed(1)} (${product.review_count})`
            : "Sem avaliações",
      },
    ];
  }, [product]);
  const descriptionPreview = useMemo(() => {
    if (!product) return "";
    return product.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }, [product]);
  const descriptionBullets = useMemo(() => {
    if (!descriptionPreview) return [];
    return descriptionPreview
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 4);
  }, [descriptionPreview]);
  useEffect(() => {
    setSelectedImageIndex(0);
    setQuantity(1);
  }, [product?.id]);

  useEffect(() => {
    if (!selectedImage) return;
    const preload = new Image();
    preload.src = selectedImage;
  }, [selectedImage]);

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

  const handleShare = async () => {
    if (!product) return;

    const shareData = {
      title: product.name,
      text: product.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(shareData.url);
      toast.success("Link do produto copiado.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Não foi possível compartilhar o produto.");
    }
  };

  const handleRelatedAdd = (targetProduct: (typeof allProducts)[number]) => {
    addToCart(targetProduct);
  };

  const relatedTotalPages = relatedCarouselApi ? relatedCarouselApi.scrollSnapList().length : 1;

  useEffect(() => {
    if (!relatedCarouselApi || relatedProducts.length === 0) return;

    const updatePage = () => setRelatedPage(relatedCarouselApi.selectedScrollSnap());
    const raf = requestAnimationFrame(() => relatedCarouselApi.reInit());

    updatePage();
    relatedCarouselApi.on("select", updatePage);
    relatedCarouselApi.on("reInit", updatePage);

    return () => {
      cancelAnimationFrame(raf);
      relatedCarouselApi.off("select", updatePage);
      relatedCarouselApi.off("reInit", updatePage);
    };
  }, [relatedCarouselApi, relatedProducts.length]);

  if (isLoading && !product) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/40 pb-32 sm:pb-[10rem]">

        <main className="flex flex-1 items-start">
          <div className="w-full px-4 py-4 lg:py-6">
            <div className="grid gap-4 xl:grid-cols-[92px_minmax(0,1.35fr)_minmax(360px,0.95fr)] xl:items-stretch">
              <div className="hidden xl:flex xl:flex-col xl:gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="aspect-square w-full rounded-lg" />
                ))}
              </div>

              <div className="min-w-0 self-stretch">
                <div className="relative flex h-full flex-col overflow-visible xl:min-h-[640px]">
                  <div className="flex flex-1 overflow-hidden rounded-xl bg-background ring-1 ring-black/5">
                    <Skeleton className="h-[min(560px,70vw)] w-full rounded-none bg-muted/70" />
                  </div>
                </div>
              </div>

              <div className="self-stretch xl:sticky xl:top-5">
                <div className="flex h-full flex-col overflow-hidden rounded-xl bg-background ring-1 ring-black/5 xl:min-h-[640px]">
                  <div className="space-y-3 p-4 sm:p-5">
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-7 w-20 rounded-full" />
                      <Skeleton className="h-7 w-24 rounded-full" />
                    </div>

                    <div className="space-y-3">
                      <Skeleton className="h-8 w-3/4 rounded-md" />
                      <Skeleton className="h-10 w-28 rounded-md" />
                    </div>

                    <Skeleton className="h-11 w-full rounded-xl sm:w-56" />
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
                    <div className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm sm:grid sm:grid-cols-3 sm:divide-x sm:divide-border/70">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="flex min-h-[84px] min-w-0 flex-col justify-center px-4 py-3 sm:px-5">
                          <Skeleton className="mb-3 h-3 w-16 rounded-md" />
                          <Skeleton className="h-5 w-24 rounded-md" />
                        </div>
                      ))}
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border/70 bg-background p-4 shadow-sm">
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
                  </div>
                </div>
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

  const hasDescription = Boolean(product.description.trim());
  // Selos, estoque e preco a vista agora sao derivados dentro do
  // `ProductInfoPanel`, que a previa do admin tambem usa.
  const reviewCount = product.review_count > 0 ? product.review_count : reviewTotalCount;
  return (
      <div className="flex min-h-screen flex-col bg-muted/40 pb-32 sm:pb-[10rem]">

      <main className="flex flex-1 items-start">
        <div className={cn(PAGE_CONTAINER, "py-3 lg:py-5")}>
          <nav aria-label="Você está em" className="mb-5 flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
            <Link
              to="/"
              viewTransition
              className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Catálogo
            </Link>
            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
            <span className="shrink-0 px-1.5 py-1">{product.type}</span>
            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
            <span aria-current="page" className="min-w-0 truncate px-1.5 py-1 font-medium text-foreground">
              {product.name}
            </span>
          </nav>
          <div className="space-y-10 sm:space-y-12">
          {/* Coluna de midia com teto fixo, nao proporcional. Em `fr` ela cresce
                junto com a tela: num monitor largo a foto passava de 538x672 —
                mais que o dobro do maior card do catalogo. Travada em 34rem, a
                foto fica em ~456x570, na faixa do que grandes e-commerces usam,
                e o espaco que sobra vai para a coluna de informacao. */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:gap-8 xl:gap-10 lg:items-start">
            <div className="min-w-0 self-start lg:sticky lg:top-5">
              <div className="space-y-3">
                {/* Bloco de fotos compartilhado com a previa do admin: quem
                    edita confere no arranjo real, nao numa reconstrucao. */}
                <div className="hidden lg:block">
                  <ProductMediaGallery
                    product={product}
                    urls={galleryUrls}
                    selectedIndex={selectedImageIndex}
                    onSelect={setSelectedImageIndex}
                  />
                </div>

                <div className="lg:hidden">
                  {galleryUrls.length > 0 ? (
                    <>
                      <div className="mx-auto w-full max-w-[28rem]">
                        <TouchCarousel
                          aspectRatio="aspect-[4/5]"
                          showDots
                          selectedIndex={selectedImageIndex}
                          onSelectedIndexChange={setSelectedImageIndex}
                          className="mx-auto"
                        >
                        {galleryUrls.map((url, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setSelectedImageIndex(i);
                              setIsGalleryOpen(true);
                            }}
                            aria-label="Ampliar imagem"
                            className="h-full w-full"
                          >
                            <ProductImageFrame
                              src={url}
                              alt={getProductImageAlt(product, i)}
                              fit={product.image_fit}
                              className="h-full w-full"
                            />
                          </button>
                        ))}
                        </TouchCarousel>
                      </div>
                      {galleryUrls.length > 1 && (
                        <div className="mt-1 flex justify-center gap-2 overflow-x-auto pb-0 [scrollbar-width:none]">
                          {galleryUrls.map((url, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setSelectedImageIndex(i)}
                              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border transition-all ${
                                i === selectedImageIndex ? "border-primary ring-2 ring-primary/20" : "border-border/70"
                              }`}
                              aria-label={`Ver imagem ${i + 1}`}
                            >
                              <ProductImageFrame src={url} alt="" fit={product.image_fit} loading="lazy" className="h-full w-full" />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-xl border border-border/70 bg-muted/30">
                      <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="self-start lg:sticky lg:top-5">
              {/* Painel compartilhado com a previa do admin: a mesma coluna,
                  com as acoes reais injetadas por `actions`. */}
              <ProductInfoPanel
                product={product}
                price={productPrice}
                averageRating={averageRating}
                reviewCount={reviewCount}
                fullDescriptionHref={hasDescription ? "#descricao-produto" : undefined}
                actions={{
                  quantity,
                  onQuantityChange: setQuantity,
                  isWishlisted: wishlistIds.includes(product.id),
                  onToggleWishlist: () => toggleWishlist(product.id),
                  onShare: handleShare,
                  onBuyNow: () => navigate("/pedido", { state: { buyNow: { product, quantity } } }),
                  onAddToCart: handleAdd,
                  isInCart: cartIds.has(product.id),
                  quantityStepper: <QuantityStepper value={quantity} onChange={setQuantity} />,
                }}
              />
            </div>
          </div>

          <ProductGalleryModal
            open={isGalleryOpen}
            onOpenChange={setIsGalleryOpen}
            title={product.name}
            images={galleryUrls}
            selectedIndex={selectedImageIndex}
            onSelectedIndexChange={setSelectedImageIndex}
          />

          {hasDescription && (
            <section
              id="descricao-produto"
              className="scroll-mt-[calc(var(--page-header-shell-height,88px)+4rem)]"
            >
              <CatalogSectionHeader
                title="Descrição do produto"
                subtitle="Informações completas enviadas pelo fabricante"
              />
              <div className="rounded-xl bg-background p-5 ring-1 ring-black/5 sm:p-6">
                <ProductDescription html={product.description} />
              </div>
            </section>
          )}

          {/* Faixa depois da descricao, descendo a pagina.
              Aqui e seguro: quem chegou ate o fim do texto ja decidiu o que
              queria saber do produto, e o banner nao disputa espaco com a foto
              nem com o botao de comprar. Acima da descricao seria o contrario. */}
          {/* Faixa sangrando depois da descricao. */}
          <PromoUnico format="faixa" label="Produto · faixa" bleed customerType={customerType} />

          <section
            id="avaliacoes"
            className="scroll-mt-[calc(var(--page-header-shell-height,88px)+4rem)]"
          >
            <CatalogSectionHeader
              title="Avaliações"
              subtitle={
                reviewTotalCount === 0
                  ? "Nenhuma avaliação ainda — a sua pode ser a primeira"
                  : `${reviewTotalCount} avaliação(ões) de quem já comprou`
              }
              actions={
                averageRating > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <StarRating rating={Math.round(averageRating)} size="sm" />
                    <span className="font-semibold tabular-nums text-foreground">
                      {averageRating.toFixed(1)}
                    </span>
                  </span>
                ) : undefined
              }
            />

            <div className="rounded-xl bg-background p-5 ring-1 ring-black/5 sm:p-6">
              {reviewTotalCount > 0 && (
                <div className="mb-6 space-y-1.5 pb-4 border-b border-border/30">
                  {[5,4,3,2,1].map((star) => {
                    const count = reviews.filter((r) => r.rating === star).length;
                    const pct = reviewTotalCount > 0 ? (count / reviewTotalCount) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="w-4 text-right tabular-nums text-muted-foreground">{star}</span>
                        <Star className="h-3 w-3 text-warm fill-current" />
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-warm transition-all" style={{ width: `${pct}%` }} />
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
                          <AvatarFallback className="bg-primary/10 text-[0.6875rem] text-primary">
                            {review.user_name?.charAt(0).toUpperCase() ?? "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground leading-tight">{review.user_name}</p>
                          <p className="text-[0.6875rem] text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <StarRating rating={review.rating} size="sm" />
                      </div>

                      {review.tags.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {review.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-primary/5 px-2 py-0.5 text-[0.6875rem] text-primary">
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
                          <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Resposta do vendedor
                          </p>
                          <p className="text-sm text-foreground">{review.admin_response}</p>
                          {review.admin_responded_at && (
                            <p className="mt-1 text-[0.6875rem] text-muted-foreground">
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
                      <p className="text-right text-[0.6875rem] text-muted-foreground/60">{reviewTitle.length}/100</p>
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
                      <p className="text-right text-[0.6875rem] text-muted-foreground/60">{reviewComment.length}/500</p>
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
                              className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
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

          {/* Duas pecas largas antes dos relacionados: formato diferente do da
              faixa acima, para o bloco nao repetir a mesma leitura duas vezes na
              mesma pagina. */}
          <PromoDuo label="Produto · duo" customerType={customerType} />

          {relatedProducts.length > 0 && (
            <section
              id="relacionados"
              className="scroll-mt-[calc(var(--page-header-shell-height,88px)+4rem)]"
            >
              <div className="group relative">
                <Carousel opts={{ align: "start", dragFree: false }} setApi={setRelatedCarouselApi}>
                  <CatalogSectionHeader
                    title="Produtos relacionados"
                    subtitle={`Outros itens de ${product.family}`}
                    actions={
                      <>
                        {relatedTotalPages > 1 ? (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            Página {relatedPage + 1}/{relatedTotalPages}
                          </span>
                        ) : null}
                    <CarouselPrevious
                      className="relative inset-auto h-9 w-9 translate-y-0 rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm hover:border-primary/30 hover:text-primary"
                      aria-label="Anterior"
                    />
                    <CarouselNext
                      className="relative inset-auto h-9 w-9 translate-y-0 rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm hover:border-primary/30 hover:text-primary"
                      aria-label="Próximo"
                    />
                      </>
                    }
                  />
                  <CarouselContent className="-ml-2 sm:-ml-3">
                    {relatedProducts.map((related) => (
                      <CarouselItem
                        key={related.id}
                        className="basis-1/2 pl-2 sm:pl-2.5 sm:basis-1/3 lg:basis-1/4 xl:basis-1/5 min-[1680px]:basis-1/6"
                      >
                        <CatalogProductCard
                          product={related}
                          price={resolveProductPrice(related, customerPriceMap)}
                          onAdd={handleRelatedAdd}
                          inCart={cartIds.has(related.id)}
                          compact
                          isWishlisted={wishlistIds.includes(related.id)}
                          onToggleWishlist={() => toggleWishlist(related.id)}
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
              </div>
            </section>
          )}
          </div>
        </div>
      </main>

      <StickyBottomCTA>
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">
              Preço
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-semibold text-foreground tabular-nums">{formatBRL(selectedTotalPrice)}</p>
            </div>
          </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
                wishlistIds.includes(product.id)
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border/60 bg-background text-muted-foreground",
              )}
              aria-label={wishlistIds.includes(product.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            >
              <Heart className={cn("h-4 w-4", wishlistIds.includes(product.id) && "fill-current")} />
            </button>
            <QuantityStepper value={quantity} onChange={setQuantity} className="h-10" />
            <Button onClick={handleAdd} className="gap-2 shrink-0" size="sm">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>
      </StickyBottomCTA>
    </div>
  );
}
