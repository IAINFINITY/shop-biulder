import { type FormEvent, type ReactNode, useId } from "react";
import { Link } from "react-router-dom";
import { ImageIcon, Search, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/formatMoney";
import { PageHeaderShell } from "@/components/layout/PageHeaderShell";
import { ClinicPlusLogo } from "@/components/shared/ClinicPlusLogo";

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
  cartSlot: ReactNode;
  searchSuggestions?: StoreHeaderSearchSuggestion[];
};

type SearchPanelProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchSuggestions: StoreHeaderSearchSuggestion[];
  showSuggestions: boolean;
  panelId: string;
  floating: boolean;
};

function SearchPanel({
  search,
  onSearchChange,
  searchSuggestions,
  showSuggestions,
  panelId,
  floating,
}: SearchPanelProps) {
  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
  };

  const wrapperClassName = floating
    ? "pointer-events-none absolute left-1/2 top-[calc((var(--page-header-shell-height,88px)-3rem)/2)] z-[70] w-full max-w-2xl -translate-x-1/2 px-4 lg:w-[min(100%,46rem)] lg:max-w-none lg:px-0 xl:w-[48rem]"
    : "relative w-full max-w-2xl lg:w-[min(100%,46rem)] lg:max-w-none xl:w-[48rem]";

  const cardClassName = floating
    ? "pointer-events-auto overflow-hidden rounded-[32px] bg-background/95 ring-1 ring-black/5 shadow-[0_18px_50px_rgba(0,0,0,0.10)]"
    : "overflow-hidden rounded-[32px] bg-background/80 ring-1 ring-black/5";

  return (
    <div className={wrapperClassName}>
      <div className={cardClassName}>
        <form onSubmit={onSearchSubmit} className="relative">
          <Input
            type="search"
            placeholder="O que você procura?..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-12 w-full rounded-none border-0 bg-transparent pl-4 pr-14 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:h-14 sm:pl-5 sm:pr-16"
            aria-label="Buscar produtos"
            aria-controls={showSuggestions ? panelId : undefined}
            role="combobox"
            aria-expanded={showSuggestions}
            aria-autocomplete="list"
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 sm:right-2 sm:h-10 sm:w-10"
            aria-label="Buscar"
          >
            <Search className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
          </Button>
        </form>

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
  cartSlot,
  searchSuggestions = [],
}: StoreHeaderProps) {
  const trimmedSearch = search.trim();
  const showSuggestions = trimmedSearch.length > 0;
  const desktopPanelId = useId();

  return (
    <PageHeaderShell compact innerClassName="pt-3.5 sm:pt-0 sm:items-center">
      <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-6 xl:gap-10">
        <div className="flex items-start justify-between gap-2 lg:block lg:max-w-[220px] xl:max-w-[240px]">
          <Link to="/" viewTransition className="mx-auto inline-block min-w-0 shrink-0 lg:mx-0 lg:pt-0">
            <ClinicPlusLogo />
          </Link>
        </div>

        <div className="min-w-0 lg:relative lg:min-h-[88px] lg:px-4">
          <div className="hidden lg:block">
            <SearchPanel
              search={search}
              onSearchChange={onSearchChange}
              searchSuggestions={searchSuggestions}
              showSuggestions={showSuggestions}
              panelId={desktopPanelId}
              floating
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 sm:gap-4 lg:min-w-[7.5rem] lg:justify-end xl:min-w-[8.5rem]">
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
          <Link to="/admin" viewTransition className="hidden lg:block">
            <Button
              variant="outline"
              size="icon"
              className="border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
              aria-label="Administração"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
          <div className="hidden items-center lg:flex">{cartSlot}</div>
        </div>
      </div>
    </PageHeaderShell>
  );
}
