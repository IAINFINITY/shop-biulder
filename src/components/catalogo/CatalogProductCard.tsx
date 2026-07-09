import { type LucideIcon, Plus, Leaf, Pill, FlaskConical, ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { Product } from "@/lib/products";
import { getProductImageUrls, getProductUnitPrice } from "@/lib/products";
import { formatBRL } from "@/lib/formatMoney";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductDescription } from "@/components/catalogo/ProductDescription";
import { cn } from "@/lib/utils";

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
};

export function CatalogProductCard({ product, price, onAdd, inCart, compact }: CatalogProductCardProps) {
  const Icon = typeIcons[product.type] || Leaf;
  const coverUrl = getProductImageUrls(product)[0];
  const displayPrice = Number.isFinite(price ?? Number.NaN) ? (price as number) : getProductUnitPrice(product);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.65rem] bg-background/80 ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:ring-black/10 hover:shadow-[0_14px_30px_rgba(16,24,40,0.06)] active:scale-[0.985]">
      <Link
        to={`/produto/${product.id}`}
        viewTransition
        className="flex flex-1 flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {coverUrl ? (
          <div className={cn("overflow-hidden bg-gradient-to-b from-muted/30 via-background to-background p-2 sm:p-3", compact ? "aspect-square" : "aspect-[4/3]")}>
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

        <div className="flex flex-1 flex-col px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
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

          <h3 className={cn("font-semibold leading-tight text-card-foreground", compact ? "line-clamp-1 text-sm" : "line-clamp-2 min-h-[3.25rem] text-base sm:text-[1.05rem]")}>
            {product.name}
          </h3>

          {!compact ? (
            <div className="mt-2 min-h-[3.5rem]">
              <ProductDescription
                html={product.description}
                plainPreview
                lineClamp={2}
                className="text-sm leading-6 text-muted-foreground"
              />
            </div>
          ) : null}

          <p className={cn("mt-auto font-semibold tabular-nums text-foreground", compact ? "pt-2 text-sm" : "mt-3 mb-1 text-base sm:text-lg")}>
            {formatBRL(displayPrice)}
          </p>
        </div>
      </Link>

      <div className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
        <Button
          type="button"
          onClick={() => onAdd(product)}
          variant={inCart ? "secondary" : "default"}
          className={cn("w-full gap-1.5 transition-all active:scale-95", compact ? "h-8 text-xs" : "h-10 text-xs sm:text-sm")}
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


