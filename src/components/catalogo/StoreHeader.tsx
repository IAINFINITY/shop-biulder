import { type FormEvent, type ReactNode, useId, useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { ImageIcon, Search, User, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/formatMoney";
import { PageHeaderShell } from "@/components/layout/PageHeaderShell";
import { ClinicPlusLogo } from "@/components/shared/ClinicPlusLogo";
import { cn } from "@/lib/utils";
import { CepLocationButton } from "@/components/catalogo/CepLocationButton";
import { useDeliveryCep } from "@/hooks/useDeliveryCep";

export type StoreHeaderSearchSuggestion = {
  id: string;
  name: string;
  type: string;
  family: string;
  imageUrl?: string | null;
  price?: number | null;
};

export type StoreHeaderProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: (value: string) => void;
  cartSlot: ReactNode;
  searchSuggestions?: StoreHeaderSearchSuggestion[];
  filterNav?: ReactNode;
  searchHistory?: string[];
  onSearchHistoryClear?: () => void;
  onSearchHistoryRemove?: (term: string) => void;
  showSearchSuggestions?: boolean;
};

type SearchPanelProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: (value: string) => void;
  searchSuggestions: StoreHeaderSearchSuggestion[];
  showSuggestions: boolean;
  panelId: string;
  floating: boolean;
  compact?: boolean;
  variant: "mobile" | "desktop";
  searchHistory?: string[];
  onSearchHistoryClear?: () => void;
  onSearchHistoryRemove?: (term: string) => void;
};

function SearchPanel({
  search,
  onSearchChange,
  searchSuggestions,
  showSuggestions,
  panelId,
  floating,
  compact = false,
  variant,
  searchHistory = [],
  onSearchHistoryClear,
  onSearchHistoryRemove,
}: SearchPanelProps) {
  const [isFocused, setIsFocused] = useState(false);
  const showHistory = isFocused && search.trim().length === 0 && searchHistory.length > 0;

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearchSubmit?.(search);
  };

  const wrapperClassName = floating
    ? "pointer-events-none absolute left-1/2 top-[calc((var(--page-header-shell-height,88px)-3rem)/2)] z-[70] w-full max-w-2xl -translate-x-1/2 px-4 lg:w-[min(100%,46rem)] lg:max-w-none lg:px-0 xl:w-[48rem]"
    : "relative w-full max-w-2xl lg:w-[min(100%,46rem)] lg:max-w-none xl:w-[48rem]";

  const cardClassName = floating
    ? "pointer-events-auto overflow-hidden rounded-2xl bg-background/95 ring-1 ring-black/5 shadow-[0_18px_50px_rgba(0,0,0,0.10)]"
    : "overflow-hidden rounded-xl bg-background/95 ring-1 ring-black/5 shadow-sm";

  return (
    <div className={wrapperClassName}>
      <div className={cardClassName}>
        <form onSubmit={onSearchSubmit} className="relative">
          <Input
            data-catalog-search={variant}
            type="search"
            placeholder="O que você procura?..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            className={cn(
              "h-12 w-full rounded-none border-0 bg-transparent pl-4 pr-14 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:pl-5 sm:pr-16",
              compact ? "sm:h-12" : "sm:h-14",
            )}
            aria-label="Buscar produtos"
            aria-controls={showSuggestions ? panelId : undefined}
            role="combobox"
            aria-expanded={showSuggestions}
            aria-autocomplete="list"
          />
          <Button
            type="submit"
            size="icon"
            className={cn(
              "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
              compact ? "h-8 w-8 sm:right-1.5" : "h-9 w-9 sm:right-2 sm:h-10 sm:w-10",
            )}
            aria-label="Buscar"
          >
            <Search className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
          </Button>
        </form>

        {showHistory ? (
          <div id={panelId} className="border-t border-border/70 bg-card" role="listbox" aria-label="Buscas recentes">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Buscas recentes
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-3 text-xs"
                onClick={onSearchHistoryClear}
              >
                Limpar
              </Button>
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
              {searchHistory.map((term) => (
                <button
                  key={term}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/70"
                  onClick={() => onSearchChange(term)}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{term}</span>
                  <button
                    type="button"
                    className="rounded-full p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSearchHistoryRemove?.(term);
                    }}
                    aria-label={`Remover "${term}" do histórico`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {showSuggestions ? (
          <div id={panelId} className="border-t border-border/70 bg-card" role="listbox" aria-label="Sugestões de produtos">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Resultados
                </p>
                <p className="text-sm text-foreground">
                  {searchSuggestions.length > 0
                    ? `${searchSuggestions.length} produto(s) encontrado(s)`
                    : "Nenhum resultado encontrado"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => onSearchChange("")}
              >
                Limpar
              </Button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {searchSuggestions.length > 0 ? (
                searchSuggestions.map((item) => (
                  <Link
                    key={item.id}
                    to={`/produto/${item.id}`}
                    viewTransition
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/70"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} width={1200} height={900} loading="lazy" decoding="async" className="h-full w-full object-contain p-1" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground/35" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.type} · {item.family}
                      </p>
                    </div>

                    {typeof item.price === "number" && Number.isFinite(item.price) && (
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold tabular-nums text-foreground">{formatBRL(item.price)}</p>
                      </div>
                    )}
                  </Link>
                ))
              ) : (
                <div className="px-4 py-5 text-sm text-muted-foreground">Nenhum produto corresponde ao termo pesquisado.</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function StoreHeader({
  search,
  onSearchChange,
  onSearchSubmit,
  cartSlot,
  searchSuggestions = [],
  filterNav,
  searchHistory,
  onSearchHistoryClear,
  onSearchHistoryRemove,
  showSearchSuggestions = true,
}: StoreHeaderProps) {
  const trimmedSearch = search.trim();
  const showSuggestions = showSearchSuggestions && trimmedSearch.length > 0;
  const mobilePanelId = useId();
  const desktopPanelId = useId();
  const { deliveryCep, saveDeliveryCep } = useDeliveryCep();

  return (
    <div className="sticky top-0 z-50">
      <PageHeaderShell
        compact
        className="!relative border-b border-border/70 bg-card/95 shadow-sm backdrop-blur lg:hidden"
        innerClassName="flex-col items-stretch gap-3 py-3 sm:gap-4 sm:py-4"
      >
        <div className="flex w-full items-center gap-3">
          <Link to="/" viewTransition className="min-w-0 shrink-0">
            <ClinicPlusLogo className="h-8 w-auto sm:h-9" alt="Clinic+ Suplemento e Nutrição" />
          </Link>

          <div className="min-w-0 shrink">
            <CepLocationButton
              currentCep={deliveryCep}
              onCepResolved={saveDeliveryCep}
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link to="/conta" viewTransition>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
                aria-label="Minha conta"
              >
                <User className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center">{cartSlot}</div>
          </div>
        </div>

        <SearchPanel
          search={search}
          onSearchChange={onSearchChange}
          onSearchSubmit={onSearchSubmit}
          searchSuggestions={searchSuggestions}
          showSuggestions={showSuggestions}
          panelId={mobilePanelId}
          floating={false}
          compact
          variant="mobile"
          searchHistory={searchHistory}
          onSearchHistoryClear={onSearchHistoryClear}
          onSearchHistoryRemove={onSearchHistoryRemove}
        />
      </PageHeaderShell>

      <PageHeaderShell compact className="!relative hidden lg:flex" innerClassName="pt-3.5 sm:pt-0 sm:items-center">
        <div className="flex w-full items-center gap-4 xl:gap-6">
          {/* Logo + CEP */}
          <div className="flex items-center gap-4 shrink-0">
            <Link to="/" viewTransition className="inline-block shrink-0">
              <ClinicPlusLogo />
            </Link>
            <div className="hidden h-8 w-px bg-border/50 xl:block" />
            <div className="hidden xl:block">
              <CepLocationButton
                currentCep={deliveryCep}
                onCepResolved={saveDeliveryCep}
              />
            </div>
          </div>

          {/* Search — flex-1, centered */}
          <div className="relative flex min-w-0 flex-1 items-center justify-center lg:min-h-[88px]">
            <div className="hidden w-full lg:block">
              <SearchPanel
                search={search}
                onSearchChange={onSearchChange}
                onSearchSubmit={onSearchSubmit}
                searchSuggestions={searchSuggestions}
                showSuggestions={showSuggestions}
                panelId={desktopPanelId}
                floating
                variant="desktop"
                searchHistory={searchHistory}
                onSearchHistoryClear={onSearchHistoryClear}
                onSearchHistoryRemove={onSearchHistoryRemove}
              />
            </div>
          </div>

          {/* User + Cart */}
          <div className="flex items-center justify-end gap-3 sm:gap-4 shrink-0">
            <Link to="/conta" viewTransition className="hidden lg:block">
              <Button
                variant="outline"
                size="icon"
                className="border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
                aria-label="Minha conta"
              >
                <User className="h-5 w-5" />
              </Button>
            </Link>
            <div className="hidden items-center lg:flex">{cartSlot}</div>
          </div>
        </div>
      </PageHeaderShell>
      {filterNav}
    </div>
  );
}
