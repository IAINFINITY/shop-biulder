import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ImageIcon, Plus, Star } from "lucide-react";
import type { Product } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/formatMoney";
import { getProductImageUrls } from "@/lib/products";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

const AUTOPLAY_MS = 5000;

export type CatalogThemeSection = {
  id: string;
  title: string;
  highlightLabel?: string;
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
    <article className="flex h-full w-full min-w-0 snap-start flex-col overflow-hidden rounded-lg bg-background ring-1 ring-black/[0.03] transition-all duration-200 active:scale-[0.98] sm:rounded-xl sm:ring-black/5 sm:hover:-translate-y-0.5 sm:hover:ring-black/10 sm:hover:shadow-md">
      <Link to={`/produto/${product.id}`} viewTransition className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          <div className="p-2.5 sm:p-3">
            {highlightLabel && (
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
            )}

          <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-background/90 p-2 sm:p-3">
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

      <div className="flex flex-1 flex-col justify-between px-3 pb-3 sm:px-4 sm:pb-4">
        <h3 className="line-clamp-2 text-xs font-semibold leading-4 text-card-foreground sm:text-sm">
          {product.name}
        </h3>
        {(() => {
          const plain = product.description?.replace(/<[^>]*>/g, "").trim();
          return plain ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{plain}</p>
          ) : null;
        })()}
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
              <span className="ml-0.5">({product.review_count})</span>
            </span>
          </div>
        )}
        <div className="mt-2 space-y-1.5">
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
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  const apiRef = useRef(api);
  apiRef.current = api;

  const onSelect = useCallback(() => {
    if (!api) return;
    setActiveIndex(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api, onSelect]);

  useEffect(() => {
    if (!api || section.products.length <= 1) return;

    const id = setInterval(() => {
      const embla = apiRef.current;
      if (!embla) return;
      if (embla.canScrollNext()) {
        embla.scrollNext();
      } else {
        embla.scrollTo(0);
      }
    }, AUTOPLAY_MS);

    return () => clearInterval(id);
  }, [api, section.products.length]);

  const totalSnaps = api ? api.scrollSnapList().length : 1;

  return (
    <section id={section.id} className="scroll-mt-[calc(var(--page-header-shell-height,88px)+1rem)]">
      <div className="group relative">
        <Carousel
          opts={{
            loop: true,
            align: "start",
            duration: 30,
            slidesToScroll: 1,
          }}
          setApi={setApi}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              {section.title}
            </h2>
            <div className="flex items-center gap-1.5">
              {totalSnaps > 1 && (
                <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                  Página {activeIndex + 1}/{totalSnaps}
                </span>
              )}
              <CarouselPrevious
                className="relative inset-auto h-8 w-8 translate-y-0 rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm hover:border-primary/30 hover:text-primary sm:h-9 sm:w-9"
                aria-label="Anterior"
              />
              <CarouselNext
                className="relative inset-auto h-8 w-8 translate-y-0 rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm hover:border-primary/30 hover:text-primary sm:h-9 sm:w-9"
                aria-label="Próximo"
              />
            </div>
          </div>

          <CarouselContent className="-ml-2 sm:-ml-3">
            {section.products.map((product) => (
              <CarouselItem
                key={`${section.id}-${product.id}`}
                className="basis-1/2 pl-2 sm:pl-3 md:basis-1/3 lg:basis-1/4 xl:basis-1/5 2xl:basis-1/6"
              >
                <ThemeProductCard
                  product={product}
                  resolvePrice={resolvePrice}
                  onAdd={onAdd}
                  inCart={inCartIds.has(product.id)}
                  highlightLabel={section.highlightLabel}
                  highlightTone={section.highlightTone}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {totalSnaps > 1 && (
          <div
            className="mt-4 flex items-center justify-center gap-2"
            role="tablist"
            aria-label={`Slides de ${section.title}`}
          >
            {Array.from({ length: totalSnaps }).map((_, index) => (
              <button
                key={`dot-${section.id}-${index}`}
                type="button"
                role="tab"
                aria-selected={activeIndex === index}
                aria-label={`Ir para slide ${index + 1}`}
                onClick={() => api?.scrollTo(index)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  activeIndex === index
                    ? "w-6 bg-primary"
                    : "w-2 bg-foreground/20 hover:bg-foreground/40",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function CatalogThemeSections({ sections, resolvePrice, onAdd, inCartIds }: CatalogThemeSectionsProps) {
  const visibleSections = sections.filter((section) => section.products.length > 0);

if (visibleSections.length === 0) {
    const skeletonShelves = [];
    for (let i = 0; i < 2; i++) {
      const skeletonCards = [];
      for (let j = 0; j < 4; j++) {
        skeletonCards.push(
          <div key={j} className="overflow-hidden rounded-2xl bg-background/85 ring-1 ring-black/5">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="space-y-2 p-3 sm:p-4">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </div>,
        );
      }
      skeletonShelves.push(
        <section key={i} className="scroll-mt-[calc(var(--page-header-shell-height,88px)+1rem)]">
          <div className="mb-3">
            <Skeleton className="h-6 w-32 rounded-md" />
          </div>
          <div className="grid auto-cols-[55%] grid-flow-col gap-3 sm:auto-cols-[calc((100%_-_1rem)/2.5)] lg:auto-cols-[calc((100%_-_2rem)/3.5)] xl:auto-cols-[calc((100%_-_3rem)/4.5)]">
            {skeletonCards}
          </div>
        </section>,
      );
    }

    return (
      <div className="space-y-8">
        {skeletonShelves}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {visibleSections.map((section) => (
        <ThemeShelf key={section.id} section={section} resolvePrice={resolvePrice} onAdd={onAdd} inCartIds={inCartIds} />
      ))}
    </div>
  );
}
