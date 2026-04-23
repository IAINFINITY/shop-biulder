import { useState } from "react";
import { Search, Filter, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
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
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isFamilyOpen, setIsFamilyOpen] = useState(false);
  const types = useProductTypes();
  const families = useProductFamilies();
  const hasFilters = search || selectedType || selectedFamily;

  return (
    <div className="space-y-5 p-4 bg-gradient-to-b from-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-sm">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produtos..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-white border-slate-300 focus:border-green-500 transition-colors"
        />
      </div>

      <div className="space-y-3">
        <Collapsible open={isTypeOpen} onOpenChange={setIsTypeOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="default"
              className="w-full justify-between flex items-center gap-2 h-11 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <span className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Tipo
              </span>
              <ChevronDown
                className={`w-5 h-5 transition-transform duration-300 ${
                  isTypeOpen ? "rotate-180" : ""
                }`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-wrap gap-3 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
            {types.map((type) => (
              <Badge
                key={type}
                variant={selectedType === type ? "default" : "outline"}
                className={`cursor-pointer transition-all duration-200 text-sm font-medium px-3 py-2 ${
                  selectedType === type
                    ? "shadow-md scale-100"
                    : "hover:shadow-md hover:scale-105 hover:border-green-400"
                }`}
                onClick={() => onTypeChange(selectedType === type ? null : type)}
              >
                {type}
              </Badge>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="space-y-3">
        <Collapsible open={isFamilyOpen} onOpenChange={setIsFamilyOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="default"
              className="w-full justify-between flex items-center gap-2 h-11 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <span className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Família
              </span>
              <ChevronDown
                className={`w-5 h-5 transition-transform duration-300 ${
                  isFamilyOpen ? "rotate-180" : ""
                }`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-wrap gap-3 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
            {families.map((fam) => (
              <Badge
                key={fam}
                variant={selectedFamily === fam ? "default" : "outline"}
                className={`cursor-pointer transition-all duration-200 text-sm font-medium px-3 py-2 ${
                  selectedFamily === fam
                    ? "shadow-md scale-100"
                    : "hover:shadow-md hover:scale-105 hover:border-green-400"
                }`}
                onClick={() => onFamilyChange(selectedFamily === fam ? null : fam)}
              >
                {fam}
              </Badge>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {hasFilters && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-slate-600 hover:text-slate-900 hover:border-slate-400 transition-all duration-200 border-slate-300 font-medium"
          onClick={() => { onSearchChange(""); onTypeChange(null); onFamilyChange(null); }}
        >
          <X className="w-4 h-4" /> Limpar filtros
        </Button>
      )}
    </div>
  );
}
