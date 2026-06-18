import { useCallback, useEffect, useRef, useState } from "react";
import heroGummiesBanner from "@/assets/hero-gummies-banner.png";
import heroVitaminsBanner from "@/assets/hero-vitamins-banner.png";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

const SLIDES = [
  {
    src: heroGummiesBanner,
    alt: "Mais sabor, praticidade e inovação - linha de gomas Clinic+",
  },
  {
    src: heroVitaminsBanner,
    alt: "Vitaminas pensadas para a rotina moderna - Clinic+",
  },
] as const;

const AUTOPLAY_MS = 5500;

const slideImageClass =
  "block h-auto max-h-[min(42vw,420px)] w-full max-w-full object-contain object-center sm:max-h-[min(38vw,480px)]";

/** Painel promocional em largura total com carrossel automático. */
export function StoreHeroBanner() {
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  const autoplayTimerRef = useRef<number>();

  const onSelect = useCallback(() => {
    if (!api) return;
    setActiveIndex(api.selectedScrollSnap());
  }, [api]);

  const scheduleAutoplay = useCallback(() => {
    if (!api) return;
    if (autoplayTimerRef.current) window.clearInterval(autoplayTimerRef.current);
    autoplayTimerRef.current = window.setInterval(() => api.scrollNext(), AUTOPLAY_MS);
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
    if (!api) return;
    scheduleAutoplay();
    const onPointerDown = () => scheduleAutoplay();
    api.on("pointerDown", onPointerDown);
    return () => {
      if (autoplayTimerRef.current) window.clearInterval(autoplayTimerRef.current);
      api.off("pointerDown", onPointerDown);
    };
  }, [api, scheduleAutoplay]);

  return (
    <section
      className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 border-b border-border/40 bg-muted/30"
      aria-label="Destaques promocionais"
      aria-roledescription="carousel"
    >
      <div className="relative mx-auto w-full max-w-[1400px]">
        <Carousel
          className="w-full"
          opts={{ loop: true, align: "center", duration: 35 }}
          setApi={setApi}
        >
          <CarouselContent className="-ml-0">
            {SLIDES.map((slide, index) => (
              <CarouselItem key={slide.alt} className="basis-full pl-0">
                <div className="flex items-center justify-center px-9 sm:px-11">
                  <img
                    src={slide.src}
                    alt={slide.alt}
                    className={slideImageClass}
                    width={1400}
                    height={350}
                    loading={index === 0 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    decoding="async"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>

          <CarouselPrevious
            className="left-1 top-1/2 h-8 w-8 -translate-y-1/2 border-0 bg-background/90 shadow-md hover:bg-background sm:left-2 sm:h-9 sm:w-9"
            aria-label="Banner anterior"
            onPointerDown={scheduleAutoplay}
          />
          <CarouselNext
            className="right-1 top-1/2 h-8 w-8 -translate-y-1/2 border-0 bg-background/90 shadow-md hover:bg-background sm:right-2 sm:h-9 sm:w-9"
            aria-label="Próximo banner"
            onPointerDown={scheduleAutoplay}
          />

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2" role="tablist" aria-label="Slides do banner">
            {SLIDES.map((slide, index) => (
              <button
                key={slide.alt}
                type="button"
                role="tab"
                aria-selected={activeIndex === index}
                aria-label={`Ir para slide ${index + 1}`}
                onClick={() => {
                  api?.scrollTo(index);
                  scheduleAutoplay();
                }}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  activeIndex === index ? "w-6 bg-primary" : "w-2 bg-foreground/30 hover:bg-foreground/50",
                )}
              />
            ))}
          </div>
        </Carousel>
      </div>
    </section>
  );
}
