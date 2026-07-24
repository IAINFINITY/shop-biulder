import { useState } from "react";
import { Link } from "react-router-dom";
import { X, Plus, Minus, Heart, ImageIcon } from "lucide-react";
import type { Product } from "@/lib/products";
import { getProductImageUrls, getProductUnitPrice } from "@/lib/products";
import { formatBRL } from "@/lib/formatMoney";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type QuickViewProps = {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  price: number;
  onAdd: (product: Product, quantity?: number) => void;
  inCart: boolean;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
};

export function QuickView({ product, open, onOpenChange, price, onAdd, inCart, isWishlisted, onToggleWishlist }: QuickViewProps) {
  const [qty, setQty] = useState(1);

  if (!product) return null;

  const coverUrl = getProductImageUrls(product)[0];
  const displayPrice = Number.isFinite(price) ? price : getProductUnitPrice(product);

  const decQty = () => setQty((q) => Math.max(1, q - 1));
  const incQty = () => setQty((q) => Math.min(99, q + 1));

  const handleAdd = () => {
    onAdd(product, qty);
    setQty(1);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-lg">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <SheetTitle className="text-base font-bold">Prévia do produto</SheetTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-b from-muted/30 via-background to-background p-6">
            {coverUrl ? (
              <img src={coverUrl} alt={product.name} className="h-full w-full object-contain" />
            ) : (
              <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
            )}
          </div>

          <div className="space-y-4 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{product.type}</p>
              <h3 className="mt-0.5 text-lg font-bold leading-tight text-foreground">{product.name}</h3>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Preço</p>
                <p className="text-2xl font-bold text-foreground tabular-nums">{formatBRL(displayPrice)}</p>
              </div>
              <button
                type="button"
                onClick={onToggleWishlist}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                  isWishlisted
                    ? "border-primary/30 bg-primary/5 text-primary"
                    : "border-border/60 bg-background text-muted-foreground hover:text-primary",
                )}
                aria-label={isWishlisted ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              >
                <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} />
              </button>
            </div>

            {(() => {
              const plain = product.description?.replace(/<[^>]*>/g, "").trim();
              return plain ? (
                <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">{plain}</p>
              ) : null;
            })()}

            <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              <span><strong className="text-foreground">Tipo:</strong> {product.type}</span>
              <span className="text-border/70">|</span>
              <span><strong className="text-foreground">Família:</strong> {product.family}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full border border-border/60 bg-background shadow-sm">
              <button
                type="button"
                onClick={decQty}
                disabled={qty <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-l-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="flex h-9 min-w-[2.5rem] items-center justify-center text-sm font-semibold tabular-nums text-foreground">
                {qty}
              </span>
              <button
                type="button"
                onClick={incQty}
                disabled={qty >= 99}
                className="flex h-9 w-9 items-center justify-center rounded-r-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button onClick={handleAdd} className="flex-1 gap-2">
              <Plus className="h-4 w-4" /> {inCart ? "Já no carrinho" : "Adicionar ao carrinho"}
            </Button>
          </div>
          <Link
            to={`/produto/${product.id}`}
            className="mt-2 block text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Ver detalhes completos
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
