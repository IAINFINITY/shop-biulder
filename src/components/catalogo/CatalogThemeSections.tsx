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
    <article className="flex h-full w-full min-w-0 snap-start flex-col overflow-hidden rounded-[1.45rem] bg-background/85 ring-1 ring-black/5 transition-all duration-200 hover:-translate-y-1 hover:ring-black/10 active:scale-[0.985]">
      <Link to={`/produto/${product.id}`} viewTransition className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
        <div className="bg-gradient-to-b from-muted/30 via-background to-background p-3">
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

          <div className="mt-3 aspect-[4/3] flex items-center justify-center rounded-[1.15rem] bg-background/90 p-3 ring-1 ring-black/5">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={product.name}
                width={1200}
                height={900}
                loading="lazy"
                decoding="async"
                className="max-h-[9.8rem] w-full object-contain"
              />
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

      <div className="mt-auto flex min-w-0 items-end justify-between gap-3 border-t border-black/5 px-4 pb-4 pt-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Preço</p>
          <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{formatBRL(price)}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={inCart ? "secondary" : "default"}
          className={cn("h-9 shrink-0 rounded-full px-3 text-xs transition-all active:scale-90", inCart && "text-foreground")}
          onClick={() => onAdd(product)}
        >
          <Plus className="h-4 w-4" />
          {inCart ? "No carrinho" : "Adicionar"}
        </Button>
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

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/5 pb-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">{section.eyebrow}</p>
          <h2 className="text-xl font-black tracking-[-0.04em] text-foreground sm:text-2xl">{section.title}</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{section.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-full border-border/70 bg-background/80 px-3 py-1 text-[11px] font-medium">
            {section.products.length} item(ns)
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-black/5 bg-background/90 shadow-none"
            aria-label={`Ver itens anteriores de ${section.title}`}
            onClick={() => scroll(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-black/5 bg-background/90 shadow-none"
            aria-label={`Ver próximos itens de ${section.title}`}
            onClick={() => scroll(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={rowRef}
        className="grid auto-cols-[100%] grid-flow-col gap-4 overflow-x-auto overscroll-x-contain px-1.5 pb-2 [scrollbar-width:none] snap-x snap-mandatory scroll-smooth scroll-px-1.5 sm:auto-cols-[calc((100%_-_1rem)/2)] lg:auto-cols-[calc((100%_-_2rem)/3)] xl:auto-cols-[calc((100%_-_3rem)/4)] 2xl:auto-cols-[calc((100%_-_4rem)/5)] [&::-webkit-scrollbar]:hidden"
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
