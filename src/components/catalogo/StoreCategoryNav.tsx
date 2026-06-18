import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navInner = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

export type StoreCategoryNavProps = {
  categoryTypes: string[];
  selectedType: string | null;
  onTypeChange: (type: string | null) => void;
  onShowAllProducts: () => void;
};

export function StoreCategoryNav({
  categoryTypes,
  selectedType,
  onTypeChange,
  onShowAllProducts,
}: StoreCategoryNavProps) {
  return (
    <nav className="border-b border-border bg-card" aria-label="Categorias">
      <div className={cn(navInner, "py-4 sm:py-5")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5 lg:gap-6 xl:gap-8">
          <Button
            type="button"
            variant="destructive"
            className={cn(
              "h-10 shrink-0 gap-2 self-start rounded-full px-4 text-sm font-semibold sm:h-11 sm:px-5 sm:text-base",
              "shadow-md shadow-primary/15 transition-colors hover:opacity-95",
            )}
            onClick={onShowAllProducts}
          >
            <Menu className="h-4 w-4" strokeWidth={2.25} />
            <span className="normal-case">Todos os produtos</span>
          </Button>

          <div
            className="flex min-h-10 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 overflow-x-auto pb-0.5 sm:flex-nowrap sm:gap-x-5 md:gap-x-6 lg:gap-x-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="list"
          >
            <span className="sr-only">Filtrar por tipo</span>
            {categoryTypes.map((t) => {
              const isActive = selectedType === t;
              const label = t.toLowerCase();
              return (
                <button
                  key={t}
                  type="button"
                  role="listitem"
                  onClick={() => onTypeChange(isActive ? null : t)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors sm:px-4 sm:py-2 sm:text-[0.9375rem]",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/80 bg-background text-foreground/80 hover:border-primary/30 hover:bg-muted/40",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
export type { StoreCategoryNavProps } from "../StoreCategoryNav";
