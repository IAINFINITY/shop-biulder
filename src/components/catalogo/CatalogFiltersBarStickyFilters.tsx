import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Filter, Menu, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navInner = "mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8";
const featuredFamilyLimit = 12;
const filtersHeightVariable = "--catalog-filters-bar-height";

export type CatalogFiltersBarV2Props = {
  categoryTypes: string[];
  categoryFamilies: string[];
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
  categoryTypes,
  categoryFamilies,
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
  const [familiesOpen, setFamiliesOpen] = useState(false);
  const [showAllFamilies, setShowAllFamilies] = useState(false);

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
  const visibleFamilies = showAllFamilies ? sortedFamilies : sortedFamilies.slice(0, featuredFamilyLimit);
  const extraFamilies = Math.max(0, sortedFamilies.length - featuredFamilyLimit);

  const clearFilters = () => {
    onShowAllProducts();
    setFamiliesOpen(false);
    setShowAllFamilies(false);
  };

  return (
    <nav className="border-b border-border/70 bg-card/95 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur" aria-label="Filtros do catálogo">
      <div className={cn(navInner, "py-3 sm:py-3.5")}>
        <div className="flex flex-col gap-3 border-b border-border/60 pb-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Catálogo de produtos</p>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Navegue pelos produtos e refine a busca por tipo ou família.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <p>{isLoading ? "Carregando..." : `${resultCount} produto(s) encontrado(s)`}</p>
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
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
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

            <div
              className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="list"
              aria-label="Tipos de produto"
            >
              <span className="sr-only">Filtro primário por tipo</span>
              {categoryTypes.map((type) => {
                const active = selectedType === type;
                const count = typeCounts.get(type) ?? 0;
                return (
                  <button
                    key={type}
                    type="button"
                    role="listitem"
                    aria-pressed={active}
                    onClick={() => onTypeChange(active ? null : type)}
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-xs font-medium transition-colors sm:h-10 sm:px-4 sm:text-[0.9375rem]",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border/70 bg-background text-foreground/80 hover:border-primary/30 hover:bg-muted/40",
                    )}
                  >
                    <span>{type}</span>
                    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-current/10 px-1.5 py-0 text-[0.7rem] font-semibold leading-none">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-9 shrink-0 gap-2 self-start rounded-full px-3 text-xs font-semibold sm:h-10 sm:px-4 sm:text-sm"
              onClick={() => {
                setShowAllFamilies(false);
                setFamiliesOpen(true);
              }}
            >
              <Filter className="h-4 w-4" />
              <span className="normal-case">Famílias</span>
              {extraFamilies > 0 && !showAllFamilies ? (
                <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[0.7rem]">
                  +{extraFamilies}
                </Badge>
              ) : null}
            </Button>
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
          if (!open) setShowAllFamilies(false);
        }}
      >
        <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-md">
          <div className="flex h-full flex-col">
            <div className="shrink-0 px-6 pt-6">
              <SheetHeader className="pr-8">
                <SheetTitle>Famílias</SheetTitle>
                <SheetDescription>Refine a vitrine principal sem ocupar espaço na primeira dobra.</SheetDescription>
              </SheetHeader>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
              <div className="space-y-5">
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Famílias</p>
                      <p className="text-sm text-foreground">Escolha uma família para refinar a busca</p>
                    </div>
                    <Badge variant="outline" className="rounded-full">
                      {visibleFamilies.length} de {sortedFamilies.length}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={selectedFamily == null ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => {
                        onFamilyChange(null);
                        setFamiliesOpen(false);
                        setShowAllFamilies(false);
                      }}
                    >
                      Todas as famílias
                    </Button>

                    {visibleFamilies.map((family) => {
                      const active = selectedFamily === family;
                      const count = familyCounts.get(family) ?? 0;
                      return (
                        <Button
                          key={family}
                          type="button"
                          variant={active ? "default" : "outline"}
                          className="rounded-full"
                          onClick={() => {
                            onFamilyChange(active ? null : family);
                            setFamiliesOpen(false);
                            setShowAllFamilies(false);
                          }}
                        >
                          <span>{family}</span>
                          <Badge variant="secondary" className="ml-2 rounded-full px-1.5 py-0 text-[0.7rem]">
                            {count}
                          </Badge>
                        </Button>
                      );
                    })}
                  </div>

                  {extraFamilies > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-3 w-full justify-between gap-2 text-muted-foreground"
                      onClick={() => setShowAllFamilies((current) => !current)}
                    >
                      <span>{showAllFamilies ? "Mostrar só as principais" : "Ver todas as famílias"}</span>
                      <span>{showAllFamilies ? `Mostrando ${sortedFamilies.length}` : `+${extraFamilies}`}</span>
                    </Button>
                  ) : null}
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
