import { useLocation, useNavigate } from "react-router-dom";
import { Heart, Home, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const isFavoritesView = new URLSearchParams(location.search).get("view") === "favoritos";

  const items: NavItem[] = [
    {
      id: "home",
      label: "Início",
      icon: Home,
      onClick: () => {
        if (location.pathname === "/" && !isFavoritesView) {
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        navigate("/");
      },
    },
    {
      id: "favorites",
      label: "Favoritos",
      icon: Heart,
      onClick: () => {
        if (location.pathname === "/" && isFavoritesView) return;
        navigate("/?view=favoritos");
      },
    },
    {
      id: "account",
      label: "Conta",
      icon: User,
      onClick: () => navigate("/conta"),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0rem)" }}
      aria-label="Navegação principal"
    >
      <div className="grid h-14 grid-cols-3 items-stretch px-1.5">
        {items.map((item) => {
          const active =
            item.id === "home"
              ? location.pathname === "/" && !isFavoritesView
              : item.id === "account"
                ? location.pathname === "/conta" || location.pathname === "/login"
                : item.id === "favorites"
                  ? location.pathname === "/" && isFavoritesView
                : false;

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={cn(
                "relative flex h-full w-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 transition-colors",
                "touch-manipulation select-none",
                active ? "text-primary" : "text-muted-foreground active:text-foreground",
              )}
            >
              <div className="relative flex h-6 w-6 items-center justify-center">
                <item.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
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
