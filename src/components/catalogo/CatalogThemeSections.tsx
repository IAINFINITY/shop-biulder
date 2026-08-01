import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ImageIcon } from "lucide-react";
import type { Product } from "@/lib/products";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CatalogSectionHeader } from "@/components/catalogo/CatalogSectionHeader";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { CatalogProductCard } from "@/components/catalogo/CatalogProductCard";
import type { HighlightTone } from "@/lib/productHighlights";

const AUTOPLAY_MS = 5000;

export type CatalogThemeSection = {
  id: string;
  title: string;
  /** Explica o recorte da prateleira; sem isso o titulo fica solto. */
  subtitle?: string;
  highlightLabel?: string;
  highlightTone?: HighlightTone;
  products: Product[];
};

/**
 * As prateleiras usam o mesmo card do resto da loja.
 *
 * Existia um `ThemeProductCard` proprio aqui, e ele divergia do
 * `CatalogProductCard` em quase tudo: a foto vinha com `p-2.5` em volta (os vaos
 * brancos nas pontas), nao mostrava marca, estoque, favoritar nem previa rapida,
 * e tinha raio e anel proprios. O mesmo produto aparecia de um jeito em "Vistos
 * recentemente" e de outro em "Mais vendidos".
 *
 * Manter dois componentes para a mesma coisa garantia que voltassem a divergir a
 * cada ajuste. Agora ha um so.
 */
type CatalogThemeSectionsProps = {
  sections: CatalogThemeSection[];
  resolvePrice: (product: Product) => number;
  onAdd: (product: Product) => void;
  inCartIds: Set<string>;
  wishlistIds?: string[];
  onToggleWishlist?: (productId: string) => void;
};

function ThemeShelf({
  section,
  resolvePrice,
  onAdd,
  inCartIds,
  wishlistIds,
  onToggleWishlist,
}: {
  section: CatalogThemeSection;
  resolvePrice: (product: Product) => number;
  onAdd: (product: Product) => void;
  inCartIds: Set<string>;
  wishlistIds?: string[];
  onToggleWishlist?: (productId: string) => void;
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
    if (!api || section.products.length <= 1) return;
    const raf = requestAnimationFrame(() => {
      api.reInit();
    });
    return () => cancelAnimationFrame(raf);
  }, [api, section.products]);

  useEffect(() => {
    if (!api) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        requestAnimationFrame(() => api.reInit());
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
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
          <CatalogSectionHeader
            title={section.title}
            subtitle={section.subtitle}
            tone={section.highlightTone === "success" ? "success" : "primary"}
            actions={
              <>
                {totalSnaps > 1 && (
                  <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                    Página {activeIndex + 1}/{totalSnaps}
                  </span>
                )}
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

          <CarouselContent className="-ml-2 sm:-ml-2.5">
            {section.products.map((product) => (
              <CarouselItem
                key={`${section.id}-${product.id}`}
                className="basis-1/2 pl-2 sm:pl-2.5 sm:basis-1/3 lg:basis-1/4 xl:basis-1/5 min-[1680px]:basis-1/6"
              >
                {/* `compact`, igual a "Vistos recentemente" e aos relacionados:
                    e o mesmo carrossel, com a mesma largura de slide. O selo o
                    proprio card resolve, a partir do produto. */}
                <CatalogProductCard
                  product={product}
                  price={resolvePrice(product)}
                  onAdd={onAdd}
                  inCart={inCartIds.has(product.id)}
                  compact
                  isWishlisted={wishlistIds?.includes(product.id) ?? false}
                  onToggleWishlist={onToggleWishlist ? () => onToggleWishlist(product.id) : undefined}
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

export function CatalogThemeSections({ sections, resolvePrice, onAdd, inCartIds, wishlistIds, onToggleWishlist }: CatalogThemeSectionsProps) {
  const visibleSections = sections.filter((section) => section.products.length > 0);

if (visibleSections.length === 0) {
    const skeletonShelves = [];
    for (let i = 0; i < 2; i++) {
      const skeletonCards = [];
      for (let j = 0; j < 4; j++) {
        skeletonCards.push(
          <div key={j} className="overflow-hidden rounded-2xl bg-background/85 ring-1 ring-black/5">
            <Skeleton className="aspect-[4/5] w-full rounded-none" />
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
        <ThemeShelf
          key={section.id}
          section={section}
          resolvePrice={resolvePrice}
          onAdd={onAdd}
          inCartIds={inCartIds}
          wishlistIds={wishlistIds}
          onToggleWishlist={onToggleWishlist}
        />
      ))}
    </div>
  );
}
