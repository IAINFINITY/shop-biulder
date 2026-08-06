import { type LucideIcon, Plus, Heart, Eye, Star, Leaf, Pill, FlaskConical, ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { Product } from "@/lib/products";
import { getProductDiscount, getProductImageAlt, getProductImageUrls, getProductUnitPrice, caminhoDoProduto } from "@/lib/products";
import { formatBRL } from "@/lib/formatMoney";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductDescription } from "@/components/catalogo/ProductDescription";
import { cn } from "@/lib/utils";
import { StockBadge } from "@/components/catalogo/StockBadge";
import { useTopSellers } from "@/hooks/useTopSellers";
import { highlightBadgeClassName, highlightForProduct } from "@/lib/productHighlights";
import { ProductImageFrame } from "@/components/catalogo/ProductImageFrame";
import { ProductPriceTag } from "@/components/catalogo/ProductPriceTag";

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

export type CatalogProductCardProps = {
  product: Product;
  price: number;
  /** Preco sem promocao, para a etiqueta desenhar o "de". Ver `ProductPriceTag`. */
  precoBase: number;
  onAdd: (product: Product) => void;
  inCart: boolean;
  compact?: boolean;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
  onQuickView?: () => void;
};

export function CatalogProductCard({ product, price, precoBase, onAdd, inCart, compact, isWishlisted, onToggleWishlist, onQuickView }: CatalogProductCardProps) {
  // O card busca o proprio selo em vez de receber por prop: ele e usado em cinco
  // lugares diferentes, e cada um teria de lembrar de repassar a informacao.
  // A consulta e uma so, cacheada por meia hora e compartilhada entre todos.
  const { idsMaisVendidos } = useTopSellers();
  const highlight = highlightForProduct(product, idsMaisVendidos);
  const Icon = typeIcons[product.type] || Leaf;
  const coverUrl = getProductImageUrls(product)[0];
  const displayPrice = Number.isFinite(price ?? Number.NaN) ? (price as number) : getProductUnitPrice(product);
  const discount = getProductDiscount(product, displayPrice);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-background/80 ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:ring-black/10 hover:shadow-[0_14px_30px_rgba(16,24,40,0.06)] active:scale-[0.985]">
      <Link
        to={caminhoDoProduto(product)}
        viewTransition
        className="flex flex-1 flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {coverUrl ? (
          <ProductImageFrame
            src={coverUrl}
            alt={getProductImageAlt(product, 0)}
            fit={product.image_fit}
            width={1280}
            height={1600}
            loading="lazy"
            className="aspect-[4/5]"
            imageClassName="transition-transform duration-300 group-hover:scale-[1.03]"
          >
            <div className="absolute right-1.5 top-1.5 z-10 flex gap-1">
              {onQuickView && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickView(); }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow-sm transition-all hover:scale-110 hover:text-primary sm:h-8 sm:w-8"
                  aria-label="Prévia do produto"
                >
                  <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              )}
              {onToggleWishlist && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleWishlist(); }}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition-all hover:scale-110 sm:h-8 sm:w-8",
                    isWishlisted
                      ? "bg-primary text-primary-foreground"
                      : "bg-background/80 text-muted-foreground hover:text-primary",
                  )}
                  aria-label={isWishlisted ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                >
                  <Heart className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", isWishlisted && "fill-current")} />
                </button>
              )}
            </div>
          </ProductImageFrame>
        ) : (
          <div className="flex aspect-[4/5] items-center justify-center bg-muted/20">
            <ImageIcon className={cn("text-muted-foreground/30", compact ? "h-8 w-8" : "h-12 w-12")} />
          </div>
        )}

        <div className="flex flex-1 flex-col px-3 pb-3 pt-2 sm:px-5 sm:pb-5 sm:pt-3">
          {/* O selo aparece nas duas versoes do card.
              
              Estava so no ramo `!compact`, e **todo** lugar que usa este card
              passa `compact`: grade, favoritos, vistos recentemente e
              relacionados. Na pratica o selo nao aparecia em lugar nenhum. */}
          {compact && highlight ? (
            <Badge
              variant="outline"
              className={cn(
                "mb-1 w-fit rounded-full px-2 py-0 text-[0.625rem] font-semibold uppercase leading-4 tracking-[0.14em]",
                highlightBadgeClassName(highlight.tone),
              )}
            >
              {highlight.label}
            </Badge>
          ) : null}

          {compact ? (
            <p className="mb-0.5 truncate text-[0.6875rem] font-medium text-muted-foreground">
              {product.brand ? `${product.brand} · ${product.type}` : product.type}
            </p>
          ) : null}

          {!compact ? (
            <div className="mb-2 space-y-1">
              {product.brand ? (
                <p className="truncate text-xs font-semibold text-primary">{product.brand}</p>
              ) : (
                <p className="text-xs font-medium text-muted-foreground">Tipo</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`${typeColors[product.type] || ""} text-xs font-medium`}>
                  <Icon className="mr-1 h-3 w-3" />
                  {product.type}
                </Badge>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {product.family}
                </Badge>
                {/* O selo acompanha o produto para onde ele for: grade,
                    favoritos, vistos recentemente, relacionados. Antes so a
                    prateleira dele desenhava o selo, entao o mesmo produto
                    aparecia como "Promocao" no carrossel e sem nada na grade. */}
                {highlight ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]",
                      highlightBadgeClassName(highlight.tone),
                    )}
                  >
                    {highlight.label}
                  </Badge>
                ) : null}
              </div>
            </div>
          ) : null}

          <h3 className={cn("font-semibold leading-tight text-card-foreground", compact ? "line-clamp-2 text-xs sm:text-sm sm:font-semibold" : "line-clamp-2 min-h-[3.25rem] text-base sm:text-base")}>
            {product.name}
          </h3>

          {product.review_count > 0 && (
            <div className="mt-1 flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                {[1,2,3,4,5].map((s) => (
                  <Star
                    key={s}
                    className={cn(
                      "h-3 w-3",
                      s <= Math.round(product.average_rating)
                        ? "fill-warm text-warm"
                        : "fill-muted text-muted",
                    )}
                  />
                ))}
              </div>
              <span className="text-[0.6875rem] tabular-nums text-muted-foreground">
                {product.average_rating.toFixed(1)}
                {!compact && <span className="ml-0.5">({product.review_count})</span>}
              </span>
            </div>
          )}

          {compact ? (
            <ProductDescription
              html={product.description}
              plainPreview
              lineClamp={1}
              className="mt-0.5 text-[0.6875rem] leading-4 text-muted-foreground/80 sm:text-sm sm:leading-6"
            />
          ) : (
            <div className="mt-2 min-h-[3.5rem]">
              <ProductDescription
                html={product.description}
                plainPreview
                lineClamp={2}
                className="text-sm leading-6 text-muted-foreground"
              />
            </div>
          )}

          <div className={cn("mt-auto", compact ? "pt-1.5" : "mt-3 mb-1")}>
            <ProductPriceTag product={product} precoBase={precoBase} price={displayPrice} size={compact ? "sm" : "md"} />
          </div>

          <StockBadge stock={product.stock} className="mt-1.5" />
        </div>
      </Link>

      <div className="px-3 pb-3 pt-0 sm:px-5 sm:pb-5">
        <Button
          type="button"
          onClick={() => onAdd(product)}
          variant={inCart ? "secondary" : "default"}
          aria-label={inCart ? "Já no carrinho" : "Adicionar ao carrinho"}
          className="h-10 w-full gap-1.5 rounded-full px-2 text-[0.8125rem] font-medium transition-all active:scale-95 [&_svg]:size-4"
          size="sm"
        >
          <Plus className="shrink-0" />
          <span className="truncate">{inCart ? "No carrinho" : "Adicionar"}</span>
        </Button>
      </div>
    </article>
  );
}


