import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Filter, Menu, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navInner = "mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8";
const featuredFamilyLimit = 12;
const filtersHeightVariable = "--catalog-filters-bar-height";

export type CatalogFiltersBarV2Props = {
  categoryFamilies: string[];
  familyTypesByFamily: Map<string, string[]>;
  typeCounts: Map<string, number>;
  familyCounts: Map<string, number>;
  resultCount: number;
  isLoading: boolean;
  hasSearch: boolean;
  searchQuery: string;
  selectedType: string | null;
  selectedFamily: string | null;
  onTypeChange: (type: string | null) => void;
  onFamilyChange: (family: string | null) => void;
  onShowAllProducts: () => void;
};

export function CatalogFiltersBarV2({
  categoryFamilies,
  familyTypesByFamily,
  typeCounts,
  familyCounts,
  resultCount,
  isLoading,
  hasSearch,
  searchQuery,
  selectedType,
  selectedFamily,
  onTypeChange,
  onFamilyChange,
  onShowAllProducts,
}: CatalogFiltersBarV2Props) {
  const filtersRef = useRef<HTMLDivElement>(null);
  const familiesScrollRef = useRef<HTMLDivElement>(null);
  const [familiesOpen, setFamiliesOpen] = useState(false);

  useLayoutEffect(() => {
    const filtersRow = filtersRef.current;
    if (!filtersRow || typeof window === "undefined") return;

    const updateHeight = () => {
      document.documentElement.style.setProperty(filtersHeightVariable, `${Math.ceil(filtersRow.offsetHeight)}px`);
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") return;

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(filtersRow);

    return () => resizeObserver.disconnect();
  }, []);

  const totalProducts = useMemo(
    () => Array.from(typeCounts.values()).reduce((sum, count) => sum + count, 0),
    [typeCounts],
  );
  const activeStateCount = useMemo(
    () => [hasSearch, selectedType, selectedFamily].filter(Boolean).length,
    [hasSearch, selectedType, selectedFamily],
  );
  const sortedFamilies = useMemo(
    () =>
      [...categoryFamilies].sort((left, right) => {
        const rightCount = familyCounts.get(right) ?? 0;
        const leftCount = familyCounts.get(left) ?? 0;
        return rightCount - leftCount || left.localeCompare(right);
      }),
    [categoryFamilies, familyCounts],
  );
  const visibleFamilies = sortedFamilies.slice(0, featuredFamilyLimit);
  const extraFamilies = Math.max(0, sortedFamilies.length - featuredFamilyLimit);

  const clearFilters = () => {
    onShowAllProducts();
    setFamiliesOpen(false);
  };

  const selectFamily = (family: string) => {
    const isActive = selectedFamily === family && selectedType == null;
    onFamilyChange(isActive ? null : family);
    onTypeChange(null);
  };

  const selectType = (family: string, type: string) => {
    onFamilyChange(family);
    onTypeChange(type);
  };

  const scrollFamilies = (direction: -1 | 1) => {
    const container = familiesScrollRef.current;
    if (!container) return;
    container.scrollBy({ left: direction * 360, behavior: "smooth" });
  };

  return (
    <nav className="border-b border-border/70 bg-card/95 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur" aria-label="Filtros do catálogo">
      <div className={cn(navInner, "py-3 sm:py-3.5")}>
        <div className="flex flex-col gap-3 border-b border-border/60 pb-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Catálogo de produtos</p>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Navegue pelas categorias e refine a busca por família ou tipo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <p>{`${resultCount} produto(s) encontrado(s)`}</p>
            {hasSearch || selectedType || selectedFamily ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={clearFilters}
              >
                Limpar filtros
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div
        ref={filtersRef}
        className="sticky top-[var(--page-header-shell-height,88px)] z-30 border-y border-border/70 bg-card/95 backdrop-blur"
      >
        <div className={cn(navInner, "py-3")}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                className={cn(
                  "h-9 shrink-0 gap-2 self-start rounded-full px-3 text-xs font-semibold sm:h-10 sm:px-4 sm:text-sm",
                  "shadow-sm shadow-primary/15 transition-colors hover:opacity-95",
                )}
                onClick={clearFilters}
              >
                <Menu className="h-4 w-4" strokeWidth={2.25} />
                <span className="normal-case">Todos os produtos</span>
                <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[0.7rem]">
                  {totalProducts}
                </Badge>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-9 shrink-0 gap-2 self-start rounded-full px-3 text-xs font-semibold sm:h-10 sm:px-4 sm:text-sm"
                onClick={() => setFamiliesOpen(true)}
              >
                <Filter className="h-4 w-4" />
                <span className="normal-case">Categorias</span>
                {extraFamilies > 0 ? (
                  <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[0.7rem]">
                    +{extraFamilies}
                  </Badge>
                ) : null}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="hidden h-10 w-10 rounded-full border-border/70 bg-background sm:inline-flex"
                onClick={() => scrollFamilies(-1)}
                aria-label="Ver filtros anteriores"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </Button>

              <div
                ref={familiesScrollRef}
                className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1 pr-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="list"
                aria-label="Categorias do catálogo"
              >
                {visibleFamilies.map((family) => {
                const active = selectedFamily === family;
                const count = familyCounts.get(family) ?? 0;
                const familyTypes = familyTypesByFamily.get(family) ?? [];

                return (
                  <HoverCard key={family} openDelay={120} closeDelay={80}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        role="listitem"
                        aria-pressed={active}
                        onClick={() => selectFamily(family)}
                        className={cn(
                          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors sm:h-10 sm:px-4 sm:text-[0.9375rem]",
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border/70 bg-background text-foreground/80 hover:border-primary/30 hover:bg-muted/40",
                        )}
                      >
                        <span className="max-w-[10rem] truncate">{family}</span>
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-current/10 px-1.5 py-0 text-[0.7rem] font-semibold leading-none">
                          {count}
                        </span>
                        <ChevronRight className="hidden h-3.5 w-3.5 opacity-60 lg:block" />
                      </button>
                    </HoverCardTrigger>

                    <HoverCardContent align="start" sideOffset={12} className="w-[23rem] rounded-[1.35rem] border-border/70 p-0 shadow-[0_18px_50px_rgba(16,24,40,0.14)]">
                      <div className="border-b border-border/70 px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Categoria</p>
                            <h3 className="mt-1 truncate text-base font-semibold text-foreground">{family}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">{familyTypes.length} tipo(s) nesta categoria</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full px-3 text-xs"
                            onClick={() => selectFamily(family)}
                          >
                            Ver categoria
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3 px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant={selectedFamily === family && selectedType == null ? "default" : "outline"}
                            className="h-8 rounded-full px-3 text-xs"
                            onClick={() => {
                              onFamilyChange(family);
                              onTypeChange(null);
                            }}
                          >
                            Todos os tipos
                          </Button>

                          {familyTypes.map((type) => {
                            const typeActive = selectedFamily === family && selectedType === type;
                            const countByType = typeCounts.get(type) ?? 0;

                            return (
                              <Button
                                key={type}
                                type="button"
                                variant={typeActive ? "default" : "outline"}
                                className="h-8 rounded-full px-3 text-xs"
                                onClick={() => selectType(family, type)}
                              >
                                <span className="max-w-[11rem] truncate">{type}</span>
                                <Badge variant="secondary" className="ml-1.5 rounded-full px-1.5 py-0 text-[0.68rem]">
                                  {countByType}
                                </Badge>
                              </Button>
                            );
                          })}
                        </div>

                        <p className="text-[12px] leading-5 text-muted-foreground">
                          Passe o mouse nas categorias do topo para refinar por tipos sem perder a leitura da vitrine.
                        </p>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                );
                })}
                <div className="w-28 shrink-0 lg:w-36" aria-hidden="true" />
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="hidden h-10 w-10 rounded-full border-border/70 bg-background sm:inline-flex"
                onClick={() => scrollFamilies(1)}
                aria-label="Ver filtros seguintes"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-[0.16em]">
              {activeStateCount > 0 ? "Filtros ativos" : "Sem filtros"}
            </span>
            {hasSearch ? (
              <Badge variant="outline" className="max-w-[16rem] truncate rounded-full border-primary/20 bg-primary/5 text-primary">
                Busca: {searchQuery}
              </Badge>
            ) : null}
            {selectedType ? (
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary">
                Tipo: {selectedType}
              </Badge>
            ) : null}
            {selectedFamily ? (
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary">
                Família: {selectedFamily}
              </Badge>
            ) : null}
            {activeStateCount === 0 ? <span>{totalProducts} itens disponíveis</span> : null}
          </div>
        </div>
      </div>

      <Sheet
        open={familiesOpen}
        onOpenChange={(open) => {
          setFamiliesOpen(open);
        }}
      >
        <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-lg">
          <div className="flex h-full flex-col">
            <div className="shrink-0 px-6 pt-6">
              <SheetHeader className="pr-8">
                <SheetTitle>Categorias</SheetTitle>
                <SheetDescription>Escolha uma família e abra os tipos relacionados sem perder o foco da vitrine.</SheetDescription>
              </SheetHeader>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Todas as categorias</p>
                      <p className="text-sm text-foreground">Selecione uma família para ver os tipos disponíveis</p>
                    </div>
                    <Badge variant="outline" className="rounded-full">
                      {sortedFamilies.length} categorias
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant={selectedFamily == null ? "default" : "outline"}
                      className="h-9 rounded-full px-4"
                      onClick={() => {
                        onFamilyChange(null);
                        onTypeChange(null);
                        setFamiliesOpen(false);
                      }}
                    >
                      Todas as categorias
                    </Button>

                    {sortedFamilies.map((family) => {
                      const active = selectedFamily === family;
                      const count = familyCounts.get(family) ?? 0;
                      const types = familyTypesByFamily.get(family) ?? [];

                      return (
                        <div key={family} className="rounded-[1.1rem] border border-border/70 bg-background p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{family}</p>
                              <p className="text-xs text-muted-foreground">{count} produto(s)</p>
                            </div>
                            <Button
                              type="button"
                              variant={active ? "default" : "outline"}
                              className="h-8 rounded-full px-3 text-xs"
                              onClick={() => {
                                onFamilyChange(active ? null : family);
                                onTypeChange(null);
                              }}
                            >
                              {active ? "Categoria ativa" : "Selecionar"}
                            </Button>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant={selectedFamily === family && selectedType == null ? "default" : "outline"}
                              className="h-8 rounded-full px-3 text-xs"
                              onClick={() => {
                                onFamilyChange(family);
                                onTypeChange(null);
                                setFamiliesOpen(false);
                              }}
                            >
                              Todos os tipos
                            </Button>

                            {types.map((type) => (
                              <Button
                                key={`${family}-${type}`}
                                type="button"
                                variant={selectedFamily === family && selectedType === type ? "default" : "outline"}
                                className="h-8 rounded-full px-3 text-xs"
                                onClick={() => {
                                  onFamilyChange(family);
                                  onTypeChange(type);
                                  setFamiliesOpen(false);
                                }}
                              >
                                {type}
                              </Button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedType || selectedFamily ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start gap-2 text-muted-foreground"
                    onClick={clearFilters}
                  >
                    <X className="h-4 w-4" />
                    Limpar filtros
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
