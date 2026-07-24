import { useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TouchCarouselProps {
  children: ReactNode[];
  className?: string;
  aspectRatio?: string;
  showDots?: boolean;
  showArrows?: boolean;
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
}

export function TouchCarousel({
  children,
  className,
  aspectRatio = "aspect-[4/3]",
  showDots = true,
  showArrows = false,
  selectedIndex,
  onSelectedIndexChange,
}: TouchCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const totalSlides = children.length;

  const goTo = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(index, totalSlides - 1));
      setCurrent(next);
      onSelectedIndexChange?.(next);
    },
    [totalSlides, onSelectedIndexChange],
  );

  useEffect(() => {
    if (typeof selectedIndex === "number" && Number.isFinite(selectedIndex)) {
      setCurrent(Math.max(0, Math.min(selectedIndex, totalSlides - 1)));
    }
  }, [selectedIndex, totalSlides]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    startXRef.current = e.touches[0].clientX;
    scrollLeftRef.current = current;
  }, [current]);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      const deltaX = e.touches[0].clientX - startXRef.current;
      if (Math.abs(deltaX) > 40) {
        if (deltaX < -40) {
          goTo(current + 1);
        } else if (deltaX > 40) {
          goTo(current - 1);
        }
        setIsDragging(false);
      }
    },
    [isDragging, current, goTo],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transform = `translateX(-${current * 100}%)`;
  }, [current]);

  if (totalSlides === 0) return null;

  return (
    <div className={cn("relative overflow-hidden", aspectRatio, className)}>
      <div
        ref={trackRef}
        className="flex h-full w-full transition-transform duration-300 ease-out"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: "pan-y" }}
      >
        {children.map((child, i) => (
          <div key={i} className="h-full w-full shrink-0">
            {child}
          </div>
        ))}
      </div>

      {showArrows && totalSlides > 1 ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute left-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full border-0 bg-background/80 shadow-sm backdrop-blur"
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            aria-label="Slide anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute right-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full border-0 bg-background/80 shadow-sm backdrop-blur"
            onClick={() => goTo(current + 1)}
            disabled={current === totalSlides - 1}
            aria-label="Próximo slide"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      ) : null}

      {showDots && totalSlides > 1 ? (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === current ? "w-5 bg-foreground" : "w-1.5 bg-foreground/30",
              )}
              aria-label={`Ir para slide ${i + 1}`}
              aria-current={i === current ? "true" : "false"}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
