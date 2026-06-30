import { Link } from "react-router-dom";
import { ImageIcon, Plus } from "lucide-react";
import type { Product } from "@/lib/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/formatMoney";
import { getProductImageUrls } from "@/lib/products";
import { cn } from "@/lib/utils";

export type CatalogThemeSection = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  highlightLabel: string;
  highlightTone?: "primary" | "success" | "destructive";
  products: Product[];
};

type CatalogThemeSectionsProps = {
  sections: CatalogThemeSection[];
  resolvePrice: (product: Product) => number;
  onAdd: (product: Product) => void;
  inCartIds: Set<string>;
};

function getHighlightBadgeClassName(tone: CatalogThemeSection["highlightTone"]) {
  if (tone === "success") {
    return "border-emerald-600 bg-emerald-600 text-white";
  }
  if (tone === "destructive") {
    return "border-primary bg-primary text-primary-foreground";
  }
  return "border-border/80 bg-card text-foreground";
}

function ThemeProductCard({
  product,
  resolvePrice,
  onAdd,
  inCart,
  highlightLabel,
  highlightTone = "primary",
}: {
  product: Product;
  resolvePrice: (product: Product) => number;
  onAdd: (product: Product) => void;
  inCart: boolean;
  highlightLabel: string;
  highlightTone?: CatalogThemeSection["highlightTone"];
}) {
  const imageUrl = getProductImageUrls(product)[0];
  const price = resolvePrice(product);

  return (
    <article className="flex h-full w-[16rem] shrink-0 snap-start flex-col overflow-hidden rounded-[1.35rem] border border-border/70 bg-card shadow-[0_8px_24px_rgba(16,24,40,0.05)] transition-transform duration-200 hover:-translate-y-1 2xl:w-[15.75rem]">
      <Link to={`/produto/${product.id}`} viewTransition className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
        <div className="border-b border-border/70 bg-background p-3">
          <div className="flex items-center">
            <span
              className={cn(
                "inline-flex w-fit max-w-full whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] leading-none shadow-none",
                highlightTone === "destructive" && "mt-0.5",
                getHighlightBadgeClassName(highlightTone),
              )}
            >
              {highlightLabel}
            </span>
          </div>

          <div className="mt-3 flex min-h-[11rem] items-center justify-center rounded-[1.15rem] bg-background/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            {imageUrl ? (
              <img src={imageUrl} alt={product.name} className="max-h-[9.8rem] w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-primary">
              {product.type}
            </Badge>
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
              {product.family}
            </Badge>
          </div>

          <h3 className="line-clamp-2 min-h-[2.7rem] text-sm font-semibold leading-5 text-card-foreground">
            {product.name}
          </h3>
        </div>
      </Link>

      <div className="mt-auto flex items-end justify-between gap-3 px-4 pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Preço</p>
          <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{formatBRL(price)}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={inCart ? "secondary" : "default"}
          className={cn("h-9 rounded-full px-3 text-xs", inCart && "text-foreground")}
          onClick={() => onAdd(product)}
        >
          <Plus className="h-4 w-4" />
          {inCart ? "No carrinho" : "Adicionar"}
        </Button>
      </div>
    </article>
  );
}

export function CatalogThemeSections({ sections, resolvePrice, onAdd, inCartIds }: CatalogThemeSectionsProps) {
  const visibleSections = sections.filter((section) => section.products.length > 0);

  if (visibleSections.length === 0) return null;

  return (
    <div className="mt-8 space-y-8">
      {visibleSections.map((section) => (
        <section
          key={section.id}
          className="space-y-4 rounded-[1.85rem] border border-border/70 bg-card/60 p-4 shadow-[0_12px_32px_rgba(16,24,40,0.04)] sm:p-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">{section.eyebrow}</p>
              <h2 className="text-xl font-black tracking-[-0.04em] text-foreground sm:text-2xl">{section.title}</h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{section.description}</p>
            </div>
            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1 text-[11px] font-medium">
              {section.products.length} item(ns)
            </Badge>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 pr-2 [scrollbar-width:none] snap-x snap-mandatory scroll-px-4 [&::-webkit-scrollbar]:hidden">
            {section.products.map((product) => (
              <ThemeProductCard
                key={`${section.id}-${product.id}`}
                product={product}
                resolvePrice={resolvePrice}
                onAdd={onAdd}
                inCart={inCartIds.has(product.id)}
                highlightLabel={section.highlightLabel}
                highlightTone={section.highlightTone}
              />
            ))}
            <div className="w-4 shrink-0" aria-hidden="true" />
          </div>
        </section>
      ))}
    </div>
  );
}
