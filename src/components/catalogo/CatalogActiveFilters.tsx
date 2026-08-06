import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Filtros aplicados, acima da grade.
 *
 * Com o painel na lateral (ou fechado, no celular), o que esta filtrando sai do
 * campo de visao de quem esta olhando os produtos. Repetir aqui evita o caso
 * classico de achar que o catalogo "sumiu" quando na verdade ha filtro ativo —
 * e cada chip remove o proprio filtro, sem precisar voltar ao painel.
 */
export type CatalogActiveFilter = {
  id: string;
  label: string;
  value: string;
  onRemove: () => void;
};

export function CatalogActiveFilters({
  filters,
  onClearAll,
}: {
  filters: CatalogActiveFilter[];
  onClearAll: () => void;
}) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={filter.onRemove}
          className="group flex h-10 sm:h-8 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 pl-3 pr-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          aria-label={`Remover filtro ${filter.label}: ${filter.value}`}
        >
          <span className="opacity-70">{filter.label}:</span>
          <span className="max-w-[12rem] truncate">{filter.value}</span>
          <X className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
        </button>
      ))}

      {filters.length > 1 ? (
        <Button
          type="button"
          variant="ghost"
          className="h-10 sm:h-8 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={onClearAll}
        >
          Limpar tudo
        </Button>
      ) : null}
    </div>
  );
}
