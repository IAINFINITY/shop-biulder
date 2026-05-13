import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FlaskConical, ImageIcon, Leaf, Pill, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Product } from "@/lib/products";
import { getProductUnitPrice } from "@/lib/products";
import { formatBRL } from "@/lib/formatMoney";

const typeIcons: Record<string, any> = {
  "Chá": Leaf,
  "Cápsula": Pill,
  "Solúvel": FlaskConical,
};

const typeBadgeClasses: Record<string, string> = {
  "Chá": "bg-muted text-foreground border-border",
  "Cápsula": "bg-primary/10 text-primary border-primary/20",
  "Solúvel": "bg-secondary text-secondary-foreground border-border",
};

interface ProductListItemProps {
  product: Product;
  inCart?: boolean;
  currentQuantity?: number;
  onAdd: (product: Product, quantity: number) => void;
}

export function ProductListItem({ product, inCart, currentQuantity, onAdd }: ProductListItemProps) {
  const Icon = typeIcons[product.type] || Leaf;
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (inCart && currentQuantity) {
      setQuantity(currentQuantity);
    }
  }, [inCart, currentQuantity]);

  const quantitySafe = useMemo(() => {
    if (!Number.isFinite(quantity)) return 1;
    return Math.max(1, Math.min(99, quantity));
  }, [quantity]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm transition-shadow hover:shadow-md">
      <div className="flex gap-3 p-3 sm:p-4">
        <Link
          to={`/produto/${product.id}`}
          className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Ver detalhes de ${product.name}`}
        >
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <Badge variant="outline" className={`${typeBadgeClasses[product.type] || ""} text-xs font-medium`}>
              <Icon className="w-3 h-3 mr-1" />
              {product.type}
            </Badge>
            <Badge variant="secondary" className="text-xs bg-muted text-foreground">
              {product.family}
            </Badge>
          </div>

          <Link
            to={`/produto/${product.id}`}
            className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <h3 className="font-semibold text-card-foreground leading-snug line-clamp-2">{product.name}</h3>
          </Link>
          <p className="mt-1 text-muted-foreground text-sm leading-relaxed line-clamp-2 sm:line-clamp-3">
            {product.description}
          </p>
          <p className="mt-2 text-base font-semibold text-foreground tabular-nums">
            {formatBRL(getProductUnitPrice(product))}
          </p>
        </div>

        <div className="shrink-0 flex flex-col justify-center gap-2 items-end">
          <Input
            type="number"
            min={1}
            max={99}
            value={quantitySafe}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-20 h-9 text-center border-border focus-visible:ring-primary/40"
            aria-label="Quantidade"
          />
          <Button
            onClick={() => onAdd(product, quantitySafe)}
            variant={inCart ? "secondary" : "default"}
            className="h-9 px-4 gap-2 min-w-28"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            {inCart ? "Atualizar carrinho" : "Adicionar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

