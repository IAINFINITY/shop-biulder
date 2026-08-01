import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PackageCheck, PackageMinus, PackageX } from "lucide-react";

type StockBadgeProps = {
  stock: number | null | undefined;
  className?: string;
};

export function StockBadge({ stock, className }: StockBadgeProps) {
  if (stock == null) return null;

  const isLow = stock <= 10 && stock > 0;
  const isOut = stock <= 0;

  // Vermelho, ambar e verde do **tema** (`destructive`, `warm`, `success`), e nao
  // da paleta crua do Tailwind. A semantica de estoque continua a mesma; o que
  // muda e a cor acompanhar o projeto em vez de ser um tom proprio.
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
        isOut && "border-destructive/20 bg-destructive/5 text-destructive",
        isLow && "border-warm/25 bg-warm/10 text-warm",
        !isLow && !isOut && "border-success/20 bg-success/5 text-success",
        className,
      )}
    >
      {isOut ? <PackageX className="h-3 w-3" /> : isLow ? <PackageMinus className="h-3 w-3" /> : <PackageCheck className="h-3 w-3" />}
      {isOut ? "Indisponível" : isLow ? `${stock} un.` : `${stock} em estoque`}
    </Badge>
  );
}
