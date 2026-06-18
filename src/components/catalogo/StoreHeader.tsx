import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Search, Settings, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import clinicMaisLogo from "@/assets/clinicmais-logo.png";

const headerInner = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

export type StoreHeaderProps = {
  search: string;
  onSearchChange: (value: string) => void;
  cartSlot: ReactNode;
};

export function StoreHeader({ search, onSearchChange, cartSlot }: StoreHeaderProps) {
  const { user, isAdmin } = useAuth();
  const accountPath = user && !isAdmin ? "/conta" : "/login";

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
  };

  return (
    <header className="bg-card shadow-sm">
      <div className="h-1 w-full bg-primary" />

      <div className={cn(headerInner, "py-4 pb-3 sm:pt-5 sm:pb-4")}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-6 xl:gap-10">
          <div className="flex items-start justify-between gap-3 lg:block lg:max-w-[220px] xl:max-w-[240px]">
            <Link to="/" className="inline-block min-w-0 shrink-0">
              <img src={clinicMaisLogo} alt="Clinic+ Suplemento e Nutrição" className="h-8 w-auto sm:h-10" />
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:text-xs sm:tracking-wide">
                Suplemento e Nutrição · B2B
              </p>
            </Link>
            <div className="flex shrink-0 items-center gap-2 lg:hidden">
              <Link to={accountPath}>
                <Button
                  variant="outline"
                  size="icon"
                  className="border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
                  aria-label="Minha conta"
                >
                  <User className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/admin">
                <Button
                  variant="outline"
                  size="icon"
                  className="border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
                  aria-label="Administração"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </Link>
            </div>
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
            <Link to={accountPath} className="hidden lg:block">
              <Button
                variant="outline"
                size="icon"
                className="border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
                aria-label="Minha conta"
              >
                <User className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/admin" className="hidden lg:block">
              <Button
                variant="outline"
                size="icon"
                className="border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
                aria-label="Administração"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center">{cartSlot}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
