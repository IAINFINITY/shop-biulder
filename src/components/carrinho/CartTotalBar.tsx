import { createPortal } from "react-dom";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/formatMoney";

interface CartTotalBarProps {
  total: number;
  itemCount: number;
  onOpenCart: () => void;
  visible: boolean;
}

export function CartTotalBar({ total, itemCount, onOpenCart, visible }: CartTotalBarProps) {
  if (!visible) return null;

  return createPortal(
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md shadow-[0_-8px_24px_rgba(0,0,0,0.08)] animate-in slide-in-from-bottom-4 duration-200 lg:bottom-0"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0rem) + 3.5rem)" }}
      role="region"
      aria-label="Resumo do valor do carrinho"
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-6 sm:py-3.5 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShoppingBag className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total do carrinho</p>
            <p className="text-lg font-semibold tracking-tight text-foreground tabular-nums sm:text-xl">
              {formatBRL(total)}
            </p>
            <p className="text-xs text-muted-foreground">{itemCount} unidade(s) nos itens selecionados</p>
          </div>
        </div>
        <Button type="button" size="lg" className="shrink-0 gap-2 rounded-full px-5" onClick={onOpenCart}>
          Ver carrinho
        </Button>
      </div>
    </div>,
    document.body,
  );
}
