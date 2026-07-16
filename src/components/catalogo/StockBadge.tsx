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

  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        isOut && "border-red-200 bg-red-50 text-red-700",
        isLow && "border-amber-200 bg-amber-50 text-amber-700",
        !isLow && !isOut && "border-emerald-200 bg-emerald-50 text-emerald-700",
        className,
      )}
    >
      {isOut ? <PackageX className="h-3 w-3" /> : isLow ? <PackageMinus className="h-3 w-3" /> : <PackageCheck className="h-3 w-3" />}
      {isOut ? "Indisponível" : isLow ? `${stock} un.` : `${stock} em estoque`}
    </Badge>
  );
}
