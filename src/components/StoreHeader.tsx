import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Menu, Search, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import clinicMaisLogo from "@/assets/clinicmais-logo.png";

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
    <header className="border-b border-border bg-card shadow-sm">
      <div className="h-1 bg-primary" />

      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
          <div className="flex items-start justify-between gap-3 lg:contents">
            <Link to="/" className="inline-block min-w-0 shrink-0">
              <img src={clinicMaisLogo} alt="Clinic+ Suplemento e Nutrição" className="h-8 sm:h-10 w-auto" />
              <p className="text-[10px] sm:text-xs tracking-wide text-muted-foreground mt-0.5 uppercase">
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

          <form
            onSubmit={onSearchSubmit}
            className="flex-1 flex w-full min-w-0 max-w-2xl lg:max-w-none mx-auto lg:mx-0 gap-2"
          >
            <div className="relative flex-1">
              <Input
                type="search"
                placeholder="O que você procura?..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-11 w-full rounded-full border-border bg-background pl-4 pr-12 shadow-inner"
                aria-label="Buscar produtos"
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-primary text-primary-foreground shadow-sm"
                aria-label="Buscar"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end lg:ml-auto lg:shrink-0">
            <Link
              to="/pedido"
              className="hidden sm:inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <User className="h-5 w-5 shrink-0" aria-hidden />
              <span className="font-medium text-foreground max-xl:hidden">Meu pedido</span>
            </Link>
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
            <div className="flex items-center gap-2">{cartSlot}</div>
          </div>
        </div>

        <nav
          className="mt-4 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:gap-3"
          aria-label="Categorias"
        >
          <Button
            type="button"
            variant="destructive"
            className="h-10 shrink-0 gap-2 rounded-full px-4 font-semibold shadow-sm sm:self-center"
            onClick={onShowAllProducts}
          >
            <Menu className="h-4 w-4" />
            Todos os produtos
          </Button>
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categoryTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTypeChange(selectedType === t ? null : t)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  selectedType === t
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/50",
                )}
              >
                {t.toLowerCase()}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
