import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Filter, Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const filtersHeightVariable = "--catalog-filters-bar-height";

type CatalogFiltersBarV2Props = {
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
  sortMode: CatalogSortMode;
  onSortChange: (mode: CatalogSortMode) => void;
};

export type CatalogSortMode = "relevance" | "best_sellers" | "price_asc" | "price_desc" | "name_asc";

type SharedFilterProps = Pick<
  CatalogFiltersBarV2Props,
  | "categoryFamilies"
  | "familyTypesByFamily"
  | "typeCounts"
  | "familyCounts"
  | "selectedType"
  | "selectedFamily"
  | "onTypeChange"
  | "onFamilyChange"
  | "sortMode"
  | "onSortChange"
>;

function getSortedFamilies(categoryFamilies: string[], familyCounts: Map<string, number>) {
  return [...categoryFamilies].sort((left, right) => {
    const rightCount = familyCounts.get(right) ?? 0;
    const leftCount = familyCounts.get(left) ?? 0;
    return rightCount - leftCount || left.localeCompare(right);
  });
}

function SortModeControl({
  value,
  onChange,
}: {
  value: CatalogSortMode;
  onChange: (mode: CatalogSortMode) => void;
}) {
  return (
    <div className="rounded-[1.4rem] border border-border/70 bg-background/90 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Ordenar por</p>
      <div className="mt-3">
        <Select value={value} onValueChange={(next) => onChange(next as CatalogSortMode)}>
          <SelectTrigger className="h-10 rounded-2xl border-border/70 bg-background">
            <SelectValue placeholder="Selecione a ordenação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">Relevância</SelectItem>
            <SelectItem value="best_sellers">Mais vendidos</SelectItem>
            <SelectItem value="price_asc">Menor preço</SelectItem>
            <SelectItem value="price_desc">Maior preço</SelectItem>
            <SelectItem value="name_asc">Nome A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ActiveFilterSummary({
  selectedType,
  selectedFamily,
  onClear,
}: Pick<CatalogFiltersBarV2Props, "selectedType" | "selectedFamily"> & {
  onClear: () => void;
}) {
  const activeLabel = selectedType ?? selectedFamily;
  const activeKind = selectedType ? "Tipo" : selectedFamily ? "Familia" : null;

  if (!activeLabel || !activeKind) return null;

  return (
    <div className="rounded-[1.4rem] border border-primary/15 bg-primary/5 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Filtro atual</p>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{activeKind}</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{activeLabel}</p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 rounded-full border-primary/20 bg-background px-3 text-xs text-primary hover:bg-primary/10 hover:text-primary"
          onClick={onClear}
        >
          Limpar
        </Button>
      </div>
    </div>
  );
}

function FamilyCollapsibleList({
  categoryFamilies,
  familyTypesByFamily,
  typeCounts,
  familyCounts,
  selectedType,
  selectedFamily,
  onTypeChange,
  onFamilyChange,
  onClose,
}: SharedFilterProps & {
  onClose?: () => void;
}) {
  const sortedFamilies = useMemo(() => getSortedFamilies(categoryFamilies, familyCounts), [categoryFamilies, familyCounts]);

  const selectFamily = (family: string) => {
    const isActive = selectedFamily === family && selectedType == null;
    onFamilyChange(isActive ? null : family);
    onTypeChange(null);
  };

  const selectType = (family: string, type: string) => {
    onFamilyChange(family);
    onTypeChange(type);
    onClose?.();
  };

  return (
    <div className="space-y-3">
      {sortedFamilies.map((family) => {
        const active = selectedFamily === family;
        const count = familyCounts.get(family) ?? 0;
        const types = familyTypesByFamily.get(family) ?? [];

        return (
          <Collapsible
            key={family}
            open={active}
            onOpenChange={(open) => {
              if (open) {
                onFamilyChange(family);
                onTypeChange(null);
                return;
              }

              if (selectedFamily === family) {
                onFamilyChange(null);
                onTypeChange(null);
              }
            }}
            className="rounded-[1.4rem] border border-border/70 bg-background/90"
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-[1.4rem] px-4 py-3 text-left transition-colors",
                  active ? "bg-primary/5 text-primary" : "hover:bg-muted/40",
                )}
                onClick={() => selectFamily(family)}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{family}</p>
                  <p className="text-xs text-muted-foreground">{count} produto(s)</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="rounded-full border-border/70 bg-background px-2.5 py-0 text-[11px] font-medium">
                    {types.length} tipo(s)
                  </Badge>
                  <ChevronRight className={cn("h-4 w-4 transition-transform", active && "rotate-90")} />
                </div>
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent className="border-t border-border/70 px-3 pb-3 pt-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={selectedFamily === family && selectedType == null ? "default" : "outline"}
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => {
                    onFamilyChange(family);
                    onTypeChange(null);
                    onClose?.();
                  }}
                >
                  Todos os tipos
                </Button>

                {types.map((type) => {
                  const typeActive = selectedFamily === family && selectedType === type;
                  const countByType = typeCounts.get(type) ?? 0;

                  return (
                    <Button
                      key={`${family}-${type}`}
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
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

export function CatalogFiltersBarV2({
  categoryFamilies,
  familyTypesByFamily,
  typeCounts,
  familyCounts,
  isLoading,
  selectedType,
  selectedFamily,
  onTypeChange,
  onFamilyChange,
  onShowAllProducts,
  sortMode,
  onSortChange,
}: CatalogFiltersBarV2Props) {
  const filtersRef = useRef<HTMLDivElement>(null);
  const [familiesOpen, setFamiliesOpen] = useState(false);

  const totalProducts = useMemo(
    () => Array.from(typeCounts.values()).reduce((sum, count) => sum + count, 0),
    [typeCounts],
  );
  const sortedFamilies = useMemo(() => getSortedFamilies(categoryFamilies, familyCounts), [categoryFamilies, familyCounts]);
  const showFiltersSummary = true;

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;

    const filtersRow = filtersRef.current;
    if (!filtersRow || !showFiltersSummary) {
      document.documentElement.style.setProperty(filtersHeightVariable, "0px");
      return;
    }

    const updateHeight = () => {
      document.documentElement.style.setProperty(filtersHeightVariable, `${Math.ceil(filtersRow.offsetHeight)}px`);
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") return;

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(filtersRow);

    return () => resizeObserver.disconnect();
  }, [showFiltersSummary]);

  const clearFilters = () => {
    onShowAllProducts();
    setFamiliesOpen(false);
  };

  return (
    <div className="space-y-4">
      {showFiltersSummary ? (
        <div
          ref={filtersRef}
          className="rounded-[1.6rem] border border-border/70 bg-background/80 px-4 py-4 shadow-sm backdrop-blur sm:px-6"
        >
          <div className="flex flex-wrap items-center gap-2">
            {isLoading ? (
              <Badge variant="outline" className="rounded-full border-border/70 bg-background/80 px-3 py-1 text-[11px] font-medium">
                Carregando catalogo
              </Badge>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 lg:hidden">
        <Button
          type="button"
          variant="destructive"
          className="h-9 shrink-0 gap-2 rounded-full px-3 text-xs font-semibold shadow-sm shadow-primary/15 transition-colors hover:opacity-95"
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
          className="h-9 shrink-0 gap-2 rounded-full px-3 text-xs font-semibold"
          onClick={() => setFamiliesOpen(true)}
        >
          <Filter className="h-4 w-4" />
          <span className="normal-case">Categorias</span>
          <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[0.7rem]">
            {sortedFamilies.length}
          </Badge>
        </Button>
      </div>

      <Sheet
        open={familiesOpen}
        onOpenChange={(open) => {
          setFamiliesOpen(open);
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col overflow-hidden p-0 sm:max-w-lg">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-6 pt-6">
              <SheetHeader className="pr-8">
                <SheetTitle>Categorias</SheetTitle>
                <SheetDescription>Escolha uma familia e abra os tipos relacionados sem perder o foco da vitrine.</SheetDescription>
              </SheetHeader>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-4">
              <div className="h-full overflow-y-auto overscroll-contain pr-2 [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
                <div className="space-y-4 px-2">
                  <SortModeControl value={sortMode} onChange={onSortChange} />
                  <ActiveFilterSummary selectedType={selectedType} selectedFamily={selectedFamily} onClear={clearFilters} />

                  <Button
                    type="button"
                    variant={selectedFamily == null ? "default" : "outline"}
                    className="h-9 w-full justify-start rounded-2xl px-4"
                    onClick={() => {
                      clearFilters();
                      setFamiliesOpen(false);
                    }}
                  >
                    Todas as categorias
                  </Button>

                  <FamilyCollapsibleList
                    categoryFamilies={categoryFamilies}
                    familyTypesByFamily={familyTypesByFamily}
                    typeCounts={typeCounts}
                    familyCounts={familyCounts}
                    selectedType={selectedType}
                    selectedFamily={selectedFamily}
                    onTypeChange={onTypeChange}
                    onFamilyChange={onFamilyChange}
                    onClose={() => setFamiliesOpen(false)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 shrink-0 border-t border-border/70 bg-card px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
            <Button
              type="button"
              className="h-11 w-full gap-2 rounded-full text-sm font-semibold"
              onClick={() => setFamiliesOpen(false)}
            >
              Aplicar filtros
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function CatalogFiltersSidebar({
  categoryFamilies,
  familyTypesByFamily,
  typeCounts,
  familyCounts,
  selectedType,
  selectedFamily,
  onTypeChange,
  onFamilyChange,
  onShowAllProducts,
  sortMode,
  onSortChange,
}: Omit<CatalogFiltersBarV2Props, "resultCount" | "isLoading" | "hasSearch" | "searchQuery">) {
  const totalProducts = useMemo(
    () => Array.from(typeCounts.values()).reduce((sum, count) => sum + count, 0),
    [typeCounts],
  );

  return (
    <aside className="hidden lg:block lg:sticky lg:top-[calc(var(--page-header-shell-height,88px)+1rem)] lg:self-start">
      <div className="flex h-[calc(100vh-var(--page-header-shell-height,88px)-2rem)] flex-col overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/80 p-4 shadow-sm backdrop-blur">
        <div className="flex shrink-0 flex-col gap-3">
          <SortModeControl value={sortMode} onChange={onSortChange} />
          <ActiveFilterSummary selectedType={selectedType} selectedFamily={selectedFamily} onClear={onShowAllProducts} />
          <Button
            type="button"
            variant="destructive"
            className="h-9 w-full justify-start gap-2 rounded-full px-3 text-xs font-semibold shadow-sm shadow-primary/15 transition-colors hover:opacity-95"
            onClick={onShowAllProducts}
          >
            <Menu className="h-4 w-4" strokeWidth={2.25} />
            <span className="normal-case">Todos os produtos</span>
            <Badge variant="secondary" className="ml-auto rounded-full px-1.5 py-0 text-[0.7rem]">
              {totalProducts}
            </Badge>
          </Button>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-28 pr-3 [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
          <FamilyCollapsibleList
            categoryFamilies={categoryFamilies}
            familyTypesByFamily={familyTypesByFamily}
            typeCounts={typeCounts}
            familyCounts={familyCounts}
            selectedType={selectedType}
            selectedFamily={selectedFamily}
            onTypeChange={onTypeChange}
            onFamilyChange={onFamilyChange}
          />
        </div>
      </div>
    </aside>
  );
}
