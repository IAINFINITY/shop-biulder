import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Menu, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import clinicMaisLogo from "@/assets/clinicmais-logo.png";

/** Largura máxima alinhada ao layout tipo vitrine (conteúdo central com margens laterais). */
const headerInner = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

export type StoreHeaderProps = {
  search: string;
  onSearchChange: (value: string) => void;
  categoryTypes: string[];
  selectedType: string | null;
  onTypeChange: (type: string | null) => void;
  onShowAllProducts: () => void;
  cartSlot: ReactNode;
};

export function StoreHeader({
  search,
  onSearchChange,
  categoryTypes,
  selectedType,
  onTypeChange,
  onShowAllProducts,
  cartSlot,
}: StoreHeaderProps) {
  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
  };

  return (
    <header className="border-b-2 border-primary/45 bg-card shadow-sm">
      <div className="h-1 w-full bg-primary" />

      <div className={cn(headerInner, "pt-4 pb-3 sm:pt-5 sm:pb-4")}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-6 xl:gap-10">
          <div className="flex items-start justify-between gap-3 lg:block lg:max-w-[220px] xl:max-w-[240px]">
            <Link to="/" className="inline-block min-w-0 shrink-0">
              <img src={clinicMaisLogo} alt="Clinic+ Suplemento e Nutrição" className="h-8 w-auto sm:h-10" />
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:text-xs sm:tracking-wide">
                Suplemento e Nutrição · B2B
              </p>
            </Link>
            <Link to="/admin" className="shrink-0 lg:hidden">
              <Button
                variant="outline"
                size="icon"
                className="border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
                aria-label="Administração"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </Link>
          </div>

          <div className="flex min-w-0 justify-center lg:px-4">
            <form
              onSubmit={onSearchSubmit}
              className="relative w-full max-w-xl sm:max-w-2xl lg:max-w-[min(100%,40rem)] xl:max-w-[44rem]"
            >
              <Input
                type="search"
                placeholder="O que você procura?..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-11 w-full rounded-full border-border bg-background pl-4 pr-14 shadow-inner sm:h-12 sm:pl-5 sm:pr-16"
                aria-label="Buscar produtos"
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 sm:right-2 sm:h-10 sm:w-10"
                aria-label="Buscar"
              >
                <Search className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              </Button>
            </form>
          </div>

          <div className="flex items-center justify-end gap-3 sm:gap-4 lg:min-w-[7.5rem] lg:justify-end xl:min-w-[8.5rem]">
            <Link to="/admin" className="hidden lg:block">
              <Button
                variant="outline"
                size="icon"
                className="border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
                aria-label="Administração"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center">{cartSlot}</div>
          </div>
        </div>

        {/* Linha de categorias: mesma largura útil, espaçamento horizontal generoso */}
        <nav
          className="mt-5 border-t border-border/80 pt-4 sm:mt-6 sm:pt-5"
          aria-label="Categorias"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5 lg:gap-6 xl:gap-8">
            <Button
              type="button"
              variant="destructive"
              className={cn(
                "h-10 shrink-0 gap-2 self-start rounded-full px-4 text-sm font-semibold sm:h-11 sm:px-5 sm:text-base",
                "shadow-md shadow-primary/15 transition-colors hover:opacity-95",
              )}
              onClick={onShowAllProducts}
            >
              <Menu className="h-4 w-4" strokeWidth={2.25} />
              <span className="normal-case">Todos os produtos</span>
            </Button>

            <div
              className="flex min-h-10 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-5 md:gap-x-6 lg:gap-x-8 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-nowrap"
              role="list"
            >
              <span className="sr-only">Filtrar por tipo</span>
              {categoryTypes.map((t) => {
                const isActive = selectedType === t;
                const label = t.toLowerCase();
                return (
                  <button
                    key={t}
                    type="button"
                    role="listitem"
                    onClick={() => onTypeChange(isActive ? null : t)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors sm:px-4 sm:py-2 sm:text-[0.9375rem]",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border/80 bg-background text-foreground/80 hover:border-primary/30 hover:bg-muted/40",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
