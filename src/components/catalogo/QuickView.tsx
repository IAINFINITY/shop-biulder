import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Minus, Heart, ImageIcon } from "lucide-react";
import type { Product } from "@/lib/products";
import { getProductImageUrls, getProductUnitPrice } from "@/lib/products";
import { formatBRL } from "@/lib/formatMoney";
import { ProductPriceTag } from "@/components/catalogo/ProductPriceTag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [qtyDraft, setQtyDraft] = useState("1");
  const [isQtyEditing, setIsQtyEditing] = useState(false);

  useEffect(() => {
    if (open) {
      setQty(1);
      setQtyDraft("1");
      setIsQtyEditing(false);
    }
  }, [open, product?.id]);

  if (!product) return null;

  const coverUrl = getProductImageUrls(product)[0];
  const displayPrice = Number.isFinite(price) ? price : getProductUnitPrice(product);
  const selectedTotalPrice = displayPrice * qty;

  const decQty = () => setQty((q) => Math.max(1, q - 1));
  const incQty = () => setQty((q) => q + 1);

  const commitQtyDraft = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    setQtyDraft(digits);
    if (digits === "") return;

    const parsed = Number.parseInt(digits, 10);
    if (Number.isFinite(parsed)) {
      setQty(Math.max(1, parsed));
    }
  };

  const handleAdd = () => {
    onAdd(product, qty);
    setQty(1);
    setQtyDraft("1");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Altura maxima + corpo rolavel: sem isso, nome longo ou tela baixa
          empurravam o conteudo para fora do dialogo, e o `overflow-hidden`
          cortava sem deixar rolar. */}
      <DialogContent className="flex max-h-[min(85dvh,44rem)] w-[min(92vw,460px)] flex-col gap-0 overflow-hidden rounded-[1.5rem] border-border/70 p-0 sm:w-[min(88vw,460px)]">
        <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-4 text-left">
          <div className="flex items-start gap-3 pr-9">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-background p-1.5">
              {coverUrl ? (
                <img src={coverUrl} alt={product.name} className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {/* Duas linhas em vez de truncar: cortar o nome do produto no meio
                  tira justamente o que diferencia sabor e apresentacao. */}
              <DialogTitle className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
                {product.name}
              </DialogTitle>
              <DialogDescription className="mt-1 truncate text-xs text-muted-foreground">
                {product.brand ? `${product.brand} · ` : ""}
                {product.type} · {product.family}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total</p>
              <p className="text-2xl font-semibold text-foreground tabular-nums">{formatBRL(selectedTotalPrice)}</p>
              {/* O desconto acompanha o unitario: aplicado ao total ele mudaria
                  de valor a cada clique no seletor de quantidade. */}
              <div className="mt-1 flex items-baseline gap-1.5 text-xs text-muted-foreground">
                <span>Unitário</span>
                <ProductPriceTag product={product} price={displayPrice} size="sm" />
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleWishlist}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                isWishlisted
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border/60 bg-background text-muted-foreground hover:text-primary",
              )}
              aria-label={isWishlisted ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            >
              <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} />
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center rounded-full border border-border/60 bg-background shadow-sm">
              <button
                type="button"
                onClick={decQty}
                disabled={qty <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-l-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <Input
                type="text"
                inputMode="numeric"
                value={isQtyEditing ? qtyDraft : String(qty)}
                onFocus={() => {
                  setIsQtyEditing(true);
                  setQtyDraft(String(qty));
                }}
                onChange={(e) => commitQtyDraft(e.target.value)}
                onBlur={() => {
                  setIsQtyEditing(false);
                  if (qtyDraft.trim() === "") {
                    setQtyDraft(String(qty));
                  }
                }}
                className="h-9 w-20 border-0 bg-transparent px-2 text-center text-sm font-semibold tabular-nums shadow-none focus-visible:ring-0"
              />
              <button
                type="button"
                onClick={incQty}
                className="flex h-9 w-9 items-center justify-center rounded-r-full text-muted-foreground transition-colors hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button onClick={handleAdd} className="w-full gap-2 rounded-full sm:flex-1 sm:min-w-0">
              <Plus className="h-4 w-4" /> {inCart ? "Adicionar mais" : "Adicionar"}
            </Button>
          </div>

          <Link
            to={`/produto/${product.id}`}
            className="block text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Ver detalhes completos
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
