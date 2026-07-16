import { GitCompare, ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/products";
import { getProductImageUrls } from "@/lib/products";

type CompareBarProps = {
  products: Product[];
  compareIds: string[];
  max: number;
  onRemove: (id: string) => void;
  onClear: () => void;
  onCompare: () => void;
};

export function CompareBar({ products, compareIds, max, onRemove, onClear, onCompare }: CompareBarProps) {
  const compareProducts = products.filter((p) => compareIds.includes(p.id));
  const compareLabel = compareIds.length < 2 ? `Adicione mais ${2 - compareIds.length}` : "Comparar agora";

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1rem)] max-w-[44rem] -translate-x-1/2 rounded-2xl border border-border bg-card/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur sm:bottom-6 sm:w-[calc(100%-3rem)] sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-start gap-2 text-foreground">
          <GitCompare className="h-4 w-4 text-primary" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-5">Comparação</p>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Selecione até {max} produtos para comparar lado a lado.
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center gap-3 overflow-x-auto py-1">
          {compareProducts.map((product) => {
            const imgUrl = getProductImageUrls(product)[0];
            return (
              <div key={product.id} className="relative shrink-0">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border bg-background sm:h-14 sm:w-14">
                  {imgUrl ? (
                    <img src={imgUrl} alt={product.name} className="h-full w-full object-contain p-1" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(product.id)}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background shadow ring-1 ring-background hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  aria-label={`Remover ${product.name} da comparação`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 sm:ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-[11px]"
            onClick={onClear}
          >
            Limpar seleção
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-full px-3 text-[11px]"
            disabled={compareIds.length < 2}
            onClick={onCompare}
          >
            {compareLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
