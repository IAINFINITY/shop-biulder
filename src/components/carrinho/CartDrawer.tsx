import { Minus, Plus, Trash2, ShoppingBag, Send, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CartItem } from "@/lib/products";
import { resolveProductPrice } from "@/lib/pricing";
import { formatBRL } from "@/lib/formatMoney";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { CatalogOrderNotice } from "@/components/catalogo/CatalogOrderNotice";
import { ImageIcon } from "lucide-react";
import { getProductImageUrls } from "@/lib/products";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";

function getCartImage(item: CartItem): string | null {
  return getProductImageUrls(item.product)[0] ?? item.product.image_url ?? null;
}

interface CartDrawerProps {
  cart: CartItem[];
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  resolveUnitPrice?: (product: CartItem["product"]) => number;
}

export function CartDrawer({
  cart,
  onUpdateQuantity,
  onRemove,
  onClear,
  open,
  onOpenChange,
  resolveUnitPrice,
}: CartDrawerProps) {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const unitPrice = resolveUnitPrice ?? resolveProductPrice;
  const subtotal = Math.round(
    cart.reduce((sum, item) => sum + unitPrice(item.product) * item.quantity, 0) * 100,
  ) / 100;
  const navigate = useNavigate();

  const handleSend = () => {
    if (cart.length === 0) {
      toast.info("Carrinho vazio");
      return;
    }
    onOpenChange?.(false);
    navigate("/pedido", { viewTransition: true });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="default" className="relative gap-2 shadow-lg">
          <ShoppingBag className="h-5 w-5" />
          <span className="hidden sm:inline">Meu Carrinho</span>
          {totalItems > 0 && (
            <Badge className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center bg-warm p-0 text-xs text-warm-foreground">
              {totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="!flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Meu Carrinho
            {totalItems > 0 && <Badge variant="secondary">{totalItems} item(ns)</Badge>}
          </SheetTitle>
        </SheetHeader>

        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <ShoppingBag className="h-16 w-16 opacity-30" />
            <p className="text-lg font-medium">Carrinho vazio</p>
            <p className="text-center text-sm">Adicione produtos do catálogo para montar seu interesse.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto py-4">
              {cart.map((item) => (
                <div key={item.product.id} className="space-y-3 rounded-2xl border border-border bg-card p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background">
                      {getCartImage(item) ? (
                        <img
                          src={getCartImage(item) ?? ""}
                          alt={item.product.name}
                          className="h-full w-full object-contain p-1.5"
                        />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground/35" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                            {item.product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.product.type} · {item.product.family}
                          </p>
                        </div>
                        <ConfirmActionDialog
                          trigger={
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          }
                          title="Remover item do carrinho"
                          description={`Deseja remover "${item.product.name}" do carrinho?`}
                          confirmLabel="Remover"
                          destructive
                          onConfirm={() => onRemove(item.product.id)}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Unitário
                          </p>
                          <p className="text-sm font-semibold tabular-nums text-foreground">
                            {formatBRL(unitPrice(item.product))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Subtotal
                          </p>
                          <p className="text-sm font-semibold tabular-nums text-foreground">
                            {formatBRL(unitPrice(item.product) * item.quantity)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Quantidade
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => onUpdateQuantity(item.product.id, -1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <div className="min-w-10 rounded-full border border-border bg-background px-3 py-1 text-center text-sm font-medium tabular-nums text-foreground">
                        {item.quantity}
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => onUpdateQuantity(item.product.id, 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <CatalogOrderNotice variant="compact" />
              <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
                <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
                <span className="text-base font-semibold tabular-nums text-foreground">{formatBRL(subtotal)}</span>
              </div>
              <Button onClick={handleSend} className="w-full gap-2" size="lg">
                <Send className="h-4 w-4" />
                Finalizar pedido
              </Button>
              <ConfirmActionDialog
                trigger={
                  <Button variant="ghost" size="sm" className="w-full gap-1 text-muted-foreground">
                    <X className="h-3 w-3" /> Limpar carrinho
                  </Button>
                }
                title="Limpar carrinho"
                description="Deseja remover todos os itens do carrinho? Esta ação não pode ser desfeita."
                confirmLabel="Limpar"
                destructive
                onConfirm={onClear}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
