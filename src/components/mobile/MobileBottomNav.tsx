import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, Search, ShoppingBag, User, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}

interface MobileBottomNavProps {
  cartItemCount: number;
  onOpenCart: () => void;
}

export function MobileBottomNav({ cartItemCount, onOpenCart }: MobileBottomNavProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const accountPath = user ? "/conta" : "/login";

  const scrollToCatalog = () => {
    const catalogEl = document.getElementById("catalogo-produtos");
    if (location.pathname === "/" && catalogEl) {
      catalogEl.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      navigate("/");
      setTimeout(() => {
        document.getElementById("catalogo-produtos")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const items: NavItem[] = [
    {
      id: "home",
      label: "Início",
      icon: Home,
      onClick: () => (location.pathname === "/" ? window.scrollTo({ top: 0, behavior: "smooth" }) : navigate("/")),
    },
    {
      id: "search",
      label: "Buscar",
      icon: Search,
      onClick: scrollToCatalog,
    },
    {
      id: "cart",
      label: "Carrinho",
      icon: ShoppingBag,
      onClick: onOpenCart,
    },
    {
      id: "account",
      label: "Conta",
      icon: User,
      onClick: () => navigate(accountPath),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0rem)" }}
      aria-label="Navegação principal"
    >
      <div className="flex h-14 items-center justify-around px-2">
        {items.map((item) => {
          const active =
            item.id === "home"
              ? location.pathname === "/"
              : item.id === "account"
                ? location.pathname === "/conta" || location.pathname === "/login"
                : false;

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={cn(
                "relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 transition-colors",
                "touch-manipulation select-none",
                active ? "text-primary" : "text-muted-foreground active:text-foreground",
              )}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                {item.id === "cart" && cartItemCount > 0 ? (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-card">
                    {cartItemCount > 99 ? "99+" : cartItemCount}
                  </span>
                ) : null}
              </div>
              <span className={cn("text-[11px] font-medium leading-none", active && "font-semibold")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
