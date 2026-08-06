import { useLocation, useNavigate } from "react-router-dom";
import { CircleHelp, Home, ShoppingBag, User, type LucideIcon } from "lucide-react";
import { usePublicLayout } from "@/components/layout/publicLayoutContext";
import { useCart } from "@/hooks/useCart";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Numero no canto do icone. Zero nao desenha nada. */
  badge?: number;
}

/**
 * Os quatro destinos do rodape no celular.
 *
 * Eram Inicio · Favoritos · Conta, e o **carrinho ficava de fora** — a acao mais
 * importante de uma loja sem atalho permanente. Favoritos e secundario: ja tem o
 * coracao em cada card, uma ancora no catalogo e agora uma entrada na Conta.
 *
 * Busca nao entra aqui de proposito: o campo fica sempre visivel no cabecalho de
 * celular, que e fixo. Um item so para rolar ate ele seria um destino que nao
 * leva a lugar nenhum.
 *
 * Categorias tambem nao: o botao "Filtros" do catalogo ja abre a gaveta com a
 * arvore inteira.
 *
 * Ajuda entrou depois: ela existia so no rodape da pagina, entao so descobria
 * quem rolasse o catalogo inteiro ate o fim — que e onde ninguem vai quando esta
 * com duvida.
 */
export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setIsCartOpen } = usePublicLayout();
  const { cart } = useCart();

  const itensNoCarrinho = cart.reduce((soma, item) => soma + item.quantity, 0);

  const items: NavItem[] = [
    {
      id: "home",
      label: "Início",
      icon: Home,
      onClick: () => {
        if (location.pathname === "/") {
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        navigate("/", { viewTransition: true });
      },
    },
    {
      id: "cart",
      label: "Carrinho",
      icon: ShoppingBag,
      badge: itensNoCarrinho,
      // Abre a gaveta em vez de navegar: o carrinho e um painel sobre a pagina,
      // e tirar a pessoa de onde ela esta para revisar o carrinho custa a volta.
      onClick: () => setIsCartOpen(true),
    },
    {
      id: "account",
      label: "Conta",
      icon: User,
      // `viewTransition` aqui e no Inicio: sem ela a troca era um corte seco.
      // Todos os Link do projeto ja passam a flag; so os `navigate` desta barra
      // ficavam de fora — e e por ela que se pula de uma area para a outra.
      onClick: () => navigate("/conta", { viewTransition: true }),
    },
    {
      // Por ultimo de proposito: e o item menos usado dos quatro, e assim os
      // tres que ja existiam nao trocam de lugar — quem ja sabia onde ficava o
      // carrinho continua sabendo.
      id: "help",
      label: "Ajuda",
      icon: CircleHelp,
      onClick: () => navigate("/ajuda", { viewTransition: true }),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0rem)" }}
      aria-label="Navegação principal"
    >
      <div className="grid h-14 grid-cols-4 items-stretch px-1.5">
        {items.map((item) => {
          const active =
            item.id === "home"
              ? location.pathname === "/"
              : item.id === "account"
                ? location.pathname === "/conta" || location.pathname === "/login"
                : item.id === "help"
                  ? location.pathname.startsWith("/ajuda")
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
                {item.badge ? (
                  <span
                    aria-hidden
                    className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold leading-none text-primary-foreground"
                  >
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                ) : null}
              </div>
              <span className={cn("text-[0.6875rem] font-medium leading-none", active && "font-semibold")}>
                {item.label}
                {item.badge ? <span className="sr-only"> — {item.badge} item(ns)</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
