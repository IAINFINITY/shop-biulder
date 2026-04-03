import { Minus, Plus, Trash2, ShoppingBag, Send, X } from "lucide-react";
import { CartItem } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";

interface CartDrawerProps {
  cart: CartItem[];
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemove: (productId: string) => void;
  onUpdateNotes: (productId: string, notes: string) => void;
  onClear: () => void;
}

export function CartDrawer({ cart, onUpdateQuantity, onRemove, onUpdateNotes, onClear }: CartDrawerProps) {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSend = () => {
    if (cart.length === 0) return;
    const phone = "554998380268";
    const header = "Ola! Gostaria de informacoes sobre os produtos do Catalogo Clinic+:";
    const lines = cart.map((item) => {
      const base = `${item.quantity}x ${item.product.name} (${item.product.type} · ${item.product.family})`;
      return item.notes ? `${base} | Obs: ${item.notes}` : base;
    });
    const message = [header, "", ...lines].join("\n");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.location.href = url;
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="default" className="gap-2 relative shadow-lg">
          <ShoppingBag className="w-5 h-5" />
          <span className="hidden sm:inline">Meu Carrinho</span>
          {totalItems > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs bg-warm text-warm-foreground">
              {totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            Meu Carrinho
            {totalItems > 0 && (
              <Badge variant="secondary">{totalItems} item(s)</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <ShoppingBag className="w-16 h-16 opacity-30" />
            <p className="text-lg font-medium">Carrinho vazio</p>
            <p className="text-sm text-center">Adicione produtos do catálogo para montar seu interesse.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 py-4">
              {cart.map((item) => (
                <div key={item.product.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">{item.product.type} · {item.product.family}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onRemove(item.product.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateQuantity(item.product.id, -1)}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateQuantity(item.product.id, 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Observações (opcional)"
                    value={item.notes || ""}
                    onChange={(e) => onUpdateNotes(item.product.id, e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <Button onClick={handleSend} className="w-full gap-2" size="lg">
                <Send className="w-4 h-4" />
                Enviar ao Consultor
              </Button>
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground gap-1" onClick={onClear}>
                <X className="w-3 h-3" /> Limpar carrinho
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
