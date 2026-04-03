import { Search, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProductFamilies, useProductTypes } from "@/hooks/useProducts";

interface FiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  selectedType: string | null;
  onTypeChange: (v: string | null) => void;
  selectedFamily: string | null;
  onFamilyChange: (v: string | null) => void;
}

export function ProductFilters({
  search, onSearchChange, selectedType, onTypeChange, selectedFamily, onFamilyChange,
}: FiltersProps) {
  const types = useProductTypes();
  const families = useProductFamilies();
  const hasFilters = search || selectedType || selectedFamily;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produtos..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="w-4 h-4" />
          Tipo
        </div>
        <div className="flex flex-wrap gap-2">
          {types.map((type) => (
            <Badge
              key={type}
              variant={selectedType === type ? "default" : "outline"}
              className="cursor-pointer transition-colors hover:bg-primary/10"
              onClick={() => onTypeChange(selectedType === type ? null : type)}
            >
              {type}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium text-foreground">Família</div>
        <div className="flex flex-wrap gap-2">
          {families.map((fam) => (
            <Badge
              key={fam}
              variant={selectedFamily === fam ? "default" : "outline"}
              className="cursor-pointer transition-colors hover:bg-primary/10"
              onClick={() => onFamilyChange(selectedFamily === fam ? null : fam)}
            >
              {fam}
            </Badge>
          ))}
        </div>
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          onClick={() => { onSearchChange(""); onTypeChange(null); onFamilyChange(null); }}
        >
          <X className="w-3 h-3" /> Limpar filtros
        </Button>
      )}
    </div>
  );
}
