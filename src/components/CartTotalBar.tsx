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

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md shadow-[0_-8px_24px_rgba(0,0,0,0.08)] animate-in slide-in-from-bottom-4 duration-200"
      role="region"
      aria-label="Resumo do valor do carrinho"
    >
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShoppingBag className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total do carrinho</p>
            <p className="text-xl font-semibold tracking-tight text-foreground tabular-nums">{formatBRL(total)}</p>
            <p className="text-xs text-muted-foreground">{itemCount} unidade(s) nos itens selecionados</p>
          </div>
        </div>
        <Button type="button" size="lg" className="shrink-0 gap-2 rounded-full px-6" onClick={onOpenCart}>
          Ver carrinho
        </Button>
      </div>
    </div>
  );
}
