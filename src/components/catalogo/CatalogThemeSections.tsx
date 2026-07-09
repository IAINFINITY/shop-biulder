import { useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ImageIcon, Plus } from "lucide-react";
import type { Product } from "@/lib/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/formatMoney";
import { getProductImageUrls } from "@/lib/products";
import { cn } from "@/lib/utils";
import { ProductDescription } from "@/components/catalogo/ProductDescription";

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
  return "border-border/80 bg-muted text-muted-foreground";
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
    <article className="flex h-full w-full min-w-0 snap-start flex-col overflow-hidden rounded-xl bg-background/80 ring-1 ring-black/[0.03] transition-all duration-200 active:scale-[0.98] sm:rounded-[1.45rem] sm:ring-black/5 sm:hover:-translate-y-1 sm:hover:ring-black/10 sm:hover:shadow-[0_14px_30px_rgba(16,24,40,0.06)]">
      <Link to={`/produto/${product.id}`} viewTransition className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          <div className="p-2 sm:p-3">
          <div className="mb-1.5">
            <span
              className={cn(
                "inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] leading-none",
                getHighlightBadgeClassName(highlightTone),
              )}
            >
              {highlightLabel}
            </span>
          </div>

          <div className="aspect-[4/3] flex items-center justify-center rounded-lg bg-background/90 p-2 sm:p-3">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={product.name}
                width={1200}
                height={900}
                loading="lazy"
                decoding="async"
                className="max-h-[7rem] w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
              </div>
            )}
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col justify-between px-3 pb-3 sm:px-5 sm:pb-5">
        <div>
          <h3 className="line-clamp-2 min-h-[2rem] text-xs font-semibold leading-4 text-card-foreground sm:text-[0.95rem] sm:font-bold">
            {product.name}
          </h3>
          <ProductDescription
            html={product.description}
            plainPreview
            lineClamp={1}
            className="mt-0.5 text-[10px] leading-3 text-muted-foreground/70 sm:text-sm sm:leading-5"
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold tabular-nums text-foreground sm:text-base">{formatBRL(price)}</p>
          <Button
            type="button"
            size="sm"
            variant={inCart ? "secondary" : "default"}
            className={cn("h-8 w-full rounded-full text-xs transition-all sm:h-9 sm:text-sm", inCart && "text-foreground")}
            onClick={() => onAdd(product)}
          >
            <Plus className="mr-1 h-3 w-3" />
            {inCart ? "No carrinho" : "Adicionar"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function scrollRow(container: HTMLDivElement | null, direction: -1 | 1) {
  if (!container) return;
  const distance = Math.max(container.clientWidth - 32, 280);
  container.scrollBy({ left: direction * distance, behavior: "smooth" });
}

function ThemeShelf({
  section,
  resolvePrice,
  onAdd,
  inCartIds,
}: {
  section: CatalogThemeSection;
  resolvePrice: (product: Product) => number;
  onAdd: (product: Product) => void;
  inCartIds: Set<string>;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const scroll = useCallback((direction: -1 | 1) => scrollRow(rowRef.current, direction), []);
  const rowGridClass = "grid auto-cols-[60%] grid-flow-col gap-2.5 overflow-x-auto overscroll-x-contain px-1.5 pb-2 [scrollbar-width:none] snap-x snap-start scroll-smooth scroll-px-1.5 sm:auto-cols-[calc((100%_-_1rem)/2)] lg:auto-cols-[calc((100%_-_2rem)/3)] xl:auto-cols-[calc((100%_-_3rem)/4)] 2xl:auto-cols-[calc((100%_-_4rem)/5)] [&::-webkit-scrollbar]:hidden";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/5 pb-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">{section.eyebrow}</p>
          <h2 className="text-xl font-black tracking-[-0.04em] text-foreground sm:text-2xl">{section.title}</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{section.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-medium">
            {section.products.length} item(ns)
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 sm:h-9 sm:w-9 rounded-full border-black/5 bg-background/90 shadow-none"
            aria-label={`Ver itens anteriores de ${section.title}`}
            onClick={() => scroll(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 sm:h-9 sm:w-9 rounded-full border-black/5 bg-background/90 shadow-none"
            aria-label={`Ver próximos itens de ${section.title}`}
            onClick={() => scroll(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={rowRef}
        className={rowGridClass}
      >
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
      </div>
    </section>
  );
}

export function CatalogThemeSections({ sections, resolvePrice, onAdd, inCartIds }: CatalogThemeSectionsProps) {
  const visibleSections = sections.filter((section) => section.products.length > 0);

if (visibleSections.length === 0) {
    const gridClass = "grid auto-cols-[100%] grid-flow-col gap-4 sm:auto-cols-[calc((100%_-_1rem)/2)] lg:auto-cols-[calc((100%_-_2rem)/3)] xl:auto-cols-[calc((100%_-_3rem)/4)] 2xl:auto-cols-[calc((100%_-_4rem)/5)]";
    const skeletonShelves = [];
    for (let i = 0; i < 2; i++) {
      const skeletonCards = [];
      for (let j = 0; j < 4; j++) {
        skeletonCards.push(
          <div key={j} className="overflow-hidden rounded-[1.45rem] bg-background/85 ring-1 ring-black/5">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="space-y-3 p-4">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-[2.7rem] w-full rounded-md" />
              <div className="flex items-end justify-between gap-3 border-t border-black/5 pt-3">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-12 rounded-md" />
                  <Skeleton className="h-5 w-20 rounded-md" />
                </div>
                <Skeleton className="h-9 w-28 rounded-full" />
              </div>
            </div>
          </div>
        );
      }
      skeletonShelves.push(
        <section key={i} className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/5 pb-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-8 w-48 rounded-md" />
              <Skeleton className="h-5 w-72 rounded-md" />
            </div>
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
          <div className={gridClass}>
            {skeletonCards}
          </div>
        </section>
      );
    }

    return (
      <div className="mt-10 space-y-10">
        {skeletonShelves}
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-10">
      {visibleSections.map((section) => (
        <ThemeShelf key={section.id} section={section} resolvePrice={resolvePrice} onAdd={onAdd} inCartIds={inCartIds} />
      ))}
    </div>
  );
}
