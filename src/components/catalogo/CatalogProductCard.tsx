import { type LucideIcon, Plus, Leaf, Pill, FlaskConical, ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { Product } from "@/lib/products";
import { getProductImageUrls, getProductUnitPrice } from "@/lib/products";
import { formatBRL } from "@/lib/formatMoney";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductDescription } from "@/components/catalogo/ProductDescription";

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
};

export function CatalogProductCard({ product, price, onAdd, inCart }: CatalogProductCardProps) {
  const Icon = typeIcons[product.type] || Leaf;
  const coverUrl = getProductImageUrls(product)[0];
  const displayPrice = Number.isFinite(price ?? Number.NaN) ? (price as number) : getProductUnitPrice(product);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5">
      <Link
        to={`/produto/${product.id}`}
        viewTransition
        className="flex flex-1 flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {coverUrl ? (
          <div className="aspect-[4/3] overflow-hidden border-b border-border/70 bg-background p-2 sm:p-3">
            <img
              src={coverUrl}
              alt={product.name}
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center border-b border-border/70 bg-background p-3">
            <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}

        <div className="flex flex-1 flex-col px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className={`${typeColors[product.type] || ""} text-xs font-medium`}>
              <Icon className="mr-1 h-3 w-3" />
              {product.type}
            </Badge>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {product.family}
            </Badge>
          </div>

          <h3 className="line-clamp-2 min-h-[3.25rem] text-base font-semibold leading-tight text-card-foreground sm:text-[1.05rem]">
            {product.name}
          </h3>

          <div className="mt-2 min-h-[3.5rem]">
            <ProductDescription
              html={product.description}
              plainPreview
              lineClamp={2}
              className="text-sm leading-6 text-muted-foreground"
            />
          </div>

          <p className="mt-3 mb-1 text-base font-semibold tabular-nums text-foreground sm:text-lg">
            {formatBRL(displayPrice)}
          </p>
        </div>
      </Link>

      <div className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
        <Button
          type="button"
          onClick={() => onAdd(product)}
          variant={inCart ? "secondary" : "default"}
          className="h-10 w-full gap-1.5 text-xs sm:text-sm"
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


