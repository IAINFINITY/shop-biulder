import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";

export type CategoryTopNavProps = {
  families: string[];
  familyTypesByFamily: Map<string, string[]>;
  typeCounts: Map<string, number>;
  familyCounts: Map<string, number>;
  selectedFamily: string | null;
  selectedType: string | null;
  onFamilyChange: (family: string | null) => void;
  onTypeChange: (type: string | null) => void;
  totalProducts: number;
};

export function CategoryTopNav({
  families,
  familyTypesByFamily,
  typeCounts,
  familyCounts,
  selectedFamily,
  selectedType,
  onFamilyChange,
  onTypeChange,
  totalProducts,
}: CategoryTopNavProps) {
  const sortedFamilies = useMemo(() => {
    return [...families].sort((a, b) => {
      const aCount = familyCounts.get(a) ?? 0;
      const bCount = familyCounts.get(b) ?? 0;
      return bCount - aCount || a.localeCompare(b, "pt-BR");
    });
  }, [families, familyCounts]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll, sortedFamilies]);

  const scrollBy = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === "left" ? -300 : 300;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  const activeFamilyTypes = selectedFamily ? familyTypesByFamily.get(selectedFamily) ?? [] : [];
  const hasSubtypes = activeFamilyTypes.length > 1;

  return (
    <div className="border-b border-border/40 bg-card/95 backdrop-blur">
      <div className="px-4 sm:px-6 lg:px-8">
        {/* Family row */}
        <div className="group relative flex items-center py-3">
          {canScrollLeft ? (
            <button
              type="button"
              onClick={() => scrollBy("left")}
              className="absolute left-0 z-10 flex h-full w-8 items-center justify-center bg-gradient-to-r from-background via-background/95 to-transparent text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : null}

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onFamilyChange(null);
                onTypeChange(null);
              }}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                !selectedFamily
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-border/60",
              )}
            >
              Todos
              <span className="text-[10px] opacity-70">({totalProducts})</span>
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex items-center gap-1 overflow-x-auto mx-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sortedFamilies.map((family) => {
              const isActive = selectedFamily === family;
              const count = familyCounts.get(family) ?? 0;
              return (
                <button
                  key={family}
                  type="button"
                  onClick={() => {
                    onFamilyChange(isActive ? null : family);
                    onTypeChange(null);
                  }}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-border/60",
                  )}
                >
                  {family}
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          {canScrollRight ? (
            <button
              type="button"
              onClick={() => scrollBy("right")}
              className="absolute right-0 z-10 flex h-full w-8 items-center justify-center bg-gradient-to-l from-background via-background/95 to-transparent text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}

          <div className="shrink-0 pl-2">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-full border border-dashed border-border/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:text-primary"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  + Categorias
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={8}
                className="w-72 rounded-xl border-border/60 p-3 shadow-lg"
              >
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Todas as categorias
                </p>
                <div className="max-h-72 space-y-0.5 overflow-y-auto">
                  {sortedFamilies.map((family) => {
                    const isActive = selectedFamily === family;
                    const count = familyCounts.get(family) ?? 0;
                    const types = familyTypesByFamily.get(family) ?? [];
                    return (
                      <div key={family}>
                        <button
                          type="button"
                          onClick={() => {
                            onFamilyChange(isActive ? null : family);
                            onTypeChange(null);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-sm transition-colors",
                            isActive
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                          )}
                        >
                          <span>{family}</span>
                          <span className="text-[11px] text-muted-foreground/60">{count}</span>
                        </button>
                        {types.length > 1 ? (
                          <div className="ml-3 flex flex-wrap gap-1 pb-1">
                            {types.map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => {
                                  onFamilyChange(family);
                                  onTypeChange(selectedType === type ? null : type);
                                }}
                                className={cn(
                                  "rounded-md px-2 py-0.5 text-[11px] transition-colors",
                                  selectedFamily === family && selectedType === type
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted/40",
                                )}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Sub-type row when a family is selected */}
        {hasSubtypes && selectedFamily ? (
          <div className="-mt-1 flex items-center gap-1.5 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => onTypeChange(null)}
              className={cn(
                "flex shrink-0 items-center rounded-full px-3 py-1 text-[11px] font-medium transition-all",
                !selectedType
                  ? "bg-muted/80 text-foreground"
                  : "text-muted-foreground hover:text-foreground border border-border/40",
              )}
            >
              Todos os tipos
            </button>
            {activeFamilyTypes.map((type) => {
              const typeCount = typeCounts.get(type) ?? 0;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onTypeChange(selectedType === type ? null : type)}
                  className={cn(
                    "flex shrink-0 items-center rounded-full px-3 py-1 text-[11px] font-medium transition-all whitespace-nowrap",
                    selectedType === type
                      ? "bg-muted/80 text-foreground"
                      : "text-muted-foreground hover:text-foreground border border-border/40",
                  )}
                >
                  {type}
                  <span className="ml-1 text-[10px] opacity-70">({typeCount})</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
