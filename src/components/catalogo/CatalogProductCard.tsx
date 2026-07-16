import { type LucideIcon, Plus, Heart, Eye, Star, Leaf, Pill, FlaskConical, ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { Product } from "@/lib/products";
import { getProductImageUrls, getProductUnitPrice } from "@/lib/products";
import { formatBRL } from "@/lib/formatMoney";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductDescription } from "@/components/catalogo/ProductDescription";
import { cn } from "@/lib/utils";
import { StockBadge } from "@/components/catalogo/StockBadge";

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
  onAdd: (product: Product) => void;
  inCart: boolean;
  compact?: boolean;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
  onQuickView?: () => void;
};

export function CatalogProductCard({ product, price, onAdd, inCart, compact, isWishlisted, onToggleWishlist, onQuickView }: CatalogProductCardProps) {
  const Icon = typeIcons[product.type] || Leaf;
  const coverUrl = getProductImageUrls(product)[0];
  const displayPrice = Number.isFinite(price ?? Number.NaN) ? (price as number) : getProductUnitPrice(product);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-background/80 ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:ring-black/10 hover:shadow-[0_14px_30px_rgba(16,24,40,0.06)] active:scale-[0.985]">
      <Link
        to={`/produto/${product.id}`}
        viewTransition
        className="flex flex-1 flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {coverUrl ? (
          <div className={cn("relative overflow-hidden bg-gradient-to-b from-muted/30 via-background to-background p-2 sm:p-3", compact ? "aspect-square" : "aspect-[4/3]")}>
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
            <img
              src={coverUrl}
              alt={product.name}
              width={1200}
              height={900}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
        ) : (
          <div className={cn("flex items-center justify-center border-b border-border/70 bg-background p-3", compact ? "aspect-square" : "aspect-[4/3]")}>
            <ImageIcon className={cn("text-muted-foreground/30", compact ? "h-8 w-8" : "h-12 w-12")} />
          </div>
        )}

        <div className="flex flex-1 flex-col px-3 pb-3 pt-2 sm:px-5 sm:pb-5 sm:pt-3">
          {compact ? (
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{product.type}</p>
          ) : null}

          {!compact ? (
            <div className="mb-2 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Tipo</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`${typeColors[product.type] || ""} text-xs font-medium`}>
                  <Icon className="mr-1 h-3 w-3" />
                  {product.type}
                </Badge>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {product.family}
                </Badge>
                {product.is_promotion ? (
                  <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-primary">
                    Promoção
                  </Badge>
                ) : null}
              </div>
            </div>
          ) : null}

          <h3 className={cn("font-semibold leading-tight text-card-foreground", compact ? "line-clamp-2 text-xs sm:text-[0.95rem] sm:font-bold" : "line-clamp-2 min-h-[3.25rem] text-base sm:text-[1.05rem]")}>
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
                        ? "fill-amber-400 text-amber-400"
                        : "fill-muted text-muted",
                    )}
                  />
                ))}
              </div>
              <span className="text-[11px] tabular-nums text-muted-foreground">
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
              className="mt-0.5 text-[11px] leading-4 text-muted-foreground/80 sm:text-sm sm:leading-6"
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

          <p className={cn("mt-auto font-semibold tabular-nums text-foreground", compact ? "pt-1.5 text-sm sm:text-base" : "mt-3 mb-1 text-base sm:text-lg")}>
            {formatBRL(displayPrice)}
          </p>

          <StockBadge stock={product.stock} className="mt-1.5" />
        </div>
      </Link>

      <div className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
        <Button
          type="button"
          onClick={() => onAdd(product)}
          variant={inCart ? "secondary" : "default"}
          className={cn("w-full gap-1.5 transition-all active:scale-95", compact ? "h-8 text-xs sm:h-10 sm:text-sm" : "h-10 text-xs sm:text-sm")}
          size="sm"
        >
          <Plus className="h-4 w-4" />
          {inCart ? (
            <>
              <span className="sm:hidden">No carrinho</span>
              <span className="hidden sm:inline">Já no carrinho</span>
            </>
          ) : (
            <>
              <span className="sm:hidden">Adicionar</span>
              <span className="hidden sm:inline">Adicionar ao carrinho</span>
            </>
          )}
        </Button>
      </div>
    </article>
  );
}


