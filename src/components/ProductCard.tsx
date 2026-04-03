import { Plus, Leaf, Pill, FlaskConical, ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Product } from "@/lib/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const typeIcons: Record<string, any> = {
  "Chá": Leaf,
  "Cápsula": Pill,
  "Solúvel": FlaskConical,
};

const typeColors: Record<string, string> = {
  "Chá": "bg-success/10 text-success border-success/20",
  "Cápsula": "bg-warm/10 text-warm border-warm/20",
  "Solúvel": "bg-primary/10 text-primary border-primary/20",
};

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
  inCart?: boolean;
}

export function ProductCard({ product, onAdd, inCart }: ProductCardProps) {
  const Icon = typeIcons[product.type] || Leaf;

  return (
    <div className="group relative rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 h-full flex flex-col">
      <Link to={`/produto/${product.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 flex-1 flex flex-col">
        {product.image_url ? (
          <div className="aspect-[4/3] overflow-hidden">
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="aspect-[4/3] bg-muted flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}

        <div className="p-5 pb-3 flex flex-col flex-1">
          <div className="flex items-start justify-between mb-3">
            <Badge variant="outline" className={`${typeColors[product.type] || ""} text-xs font-medium`}>
              <Icon className="w-3 h-3 mr-1" />
              {product.type}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {product.family}
            </Badge>
          </div>

          <h3 className="font-semibold text-card-foreground text-lg leading-tight mb-2">
            {product.name}
          </h3>

          <p className="text-muted-foreground text-sm leading-relaxed mb-4 line-clamp-3 flex-1">
            {product.description}
          </p>
        </div>
      </Link>

      <div className="px-5 pb-5">
        <Button
          onClick={() => onAdd(product)}
          variant={inCart ? "secondary" : "default"}
          className="w-full gap-2"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          {inCart ? "Já no carrinho" : "Adicionar ao carrinho"}
        </Button>
      </div>
    </div>
  );
}
