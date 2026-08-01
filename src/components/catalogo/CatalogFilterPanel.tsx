import { useMemo, useState } from "react";
import { ChevronDown, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FONT_SIZE, TEXT } from "@/lib/typography";
import { cn } from "@/lib/utils";

/**
 * Painel de filtros do catalogo.
 *
 * Substitui a barra horizontal de categorias. A barra funcionava enquanto os
 * filtros cabiam nela, mas o catalogo tem 48 subcategorias — e a partir de certo
 * ponto o padrao horizontal esconde as opcoes atras de popover e rolagem
 * lateral, e o usuario perde a visao geral do que da para filtrar.
 *
 * O mesmo componente serve a coluna fixa do desktop e a gaveta do celular.
 */

export type CatalogFilterOption = {
  value: string;
  count: number;
};

export type CatalogFilterPanelProps = {
  brands: CatalogFilterOption[];
  types: CatalogFilterOption[];
  families: CatalogFilterOption[];
  selectedBrand: string | null;
  selectedType: string | null;
  selectedFamily: string | null;
  onlyPromotions: boolean;
  promotionCount: number;
  onBrandChange: (value: string | null) => void;
  onTypeChange: (value: string | null) => void;
  onFamilyChange: (value: string | null) => void;
  onOnlyPromotionsChange: (value: boolean) => void;
  onClearAll: () => void;
  activeFilterCount: number;
};

/** Acima disso a lista ganha busca e recolhimento, em vez de rolar sem fim. */
const FAMILY_VISIBLE_LIMIT = 8;

/**
 * Grupo recolhivel.
 *
 * Recolhido, o grupo continua mostrando o que esta selecionado nele. Sem isso o
 * recolhimento viraria uma armadilha: o filtro segue valendo e o painel nao
 * conta. A Baymard mede que 20% das lojas perdem os filtros aplicados de vista
 * durante a navegacao, e o caso classico e o usuario achar que o catalogo
 * "sumiu" quando na verdade ha filtro ativo.
 */
function FilterGroup({
  title,
  activeLabel,
  children,
}: {
  title: string;
  activeLabel?: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="border-b border-border/50 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-2 rounded-md py-0.5 text-left"
      >
        <span className={cn(TEXT.label, "text-muted-foreground transition-colors group-hover:text-foreground")}>
          {title}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          {!open && activeLabel ? (
            <span
              className={cn(
                TEXT.caption,
                "max-w-[8rem] truncate rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary",
              )}
            >
              {activeLabel}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-200 group-hover:text-muted-foreground",
              open ? "" : "-rotate-90",
            )}
          />
        </span>
      </button>

      {open ? <div className="mt-2">{children}</div> : null}
    </section>
  );
}

/**
 * Uma opcao de filtro.
 *
 * O indicador e redondo, de radio, e nao quadrado de caixa de selecao. Cada
 * grupo aceita **um** valor por vez — escolher a segunda marca troca a primeira.
 * Quadradinho e a convencao de "posso marcar varios"; usar essa forma aqui seria
 * prometer no visual o que o comportamento nao entrega.
 */
function FilterOptionButton({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        "group flex min-h-[34px] w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-150",
        isActive ? "bg-primary/[0.07] text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border transition-all duration-150",
          isActive ? "border-primary" : "border-border group-hover:border-primary/40",
        )}
      >
        <span
          className={cn(
            "h-[7px] w-[7px] rounded-full bg-primary transition-transform duration-150",
            isActive ? "scale-100" : "scale-0",
          )}
        />
      </span>

      <span className={cn(TEXT.compact, "min-w-0 flex-1 truncate", isActive && "font-medium")}>{label}</span>

      {typeof count === "number" ? (
        <span
          className={cn(
            TEXT.caption,
            "shrink-0 tabular-nums",
            isActive ? "text-primary/70" : "text-muted-foreground/60",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

/** Botao de "ver mais"/"ver menos" da lista de subcategorias. */
function ExpandToggle({
  label,
  expanded,
  onClick,
}: {
  label: string;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        TEXT.caption,
        "mt-1 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 font-medium text-primary transition-colors hover:bg-primary/5",
      )}
    >
      {label}
      <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", expanded && "rotate-180")} />
    </button>
  );
}

export function CatalogFilterPanel({
  brands,
  types,
  families,
  selectedBrand,
  selectedType,
  selectedFamily,
  onlyPromotions,
  promotionCount,
  onBrandChange,
  onTypeChange,
  onFamilyChange,
  onOnlyPromotionsChange,
  onClearAll,
  activeFilterCount,
}: CatalogFilterPanelProps) {
  const [familyQuery, setFamilyQuery] = useState("");
  const [showAllFamilies, setShowAllFamilies] = useState(false);

  const filteredFamilies = useMemo(() => {
    const query = familyQuery.trim().toLowerCase();
    if (!query) return families;
    return families.filter((family) => family.value.toLowerCase().includes(query));
  }, [families, familyQuery]);

  const visibleFamilies = useMemo(() => {
    // A subcategoria escolhida nunca some da lista, mesmo fora do recorte.
    if (showAllFamilies || familyQuery.trim()) return filteredFamilies;

    const head = filteredFamilies.slice(0, FAMILY_VISIBLE_LIMIT);
    if (selectedFamily && !head.some((family) => family.value === selectedFamily)) {
      const selected = filteredFamilies.find((family) => family.value === selectedFamily);
      if (selected) return [selected, ...head];
    }
    return head;
  }, [filteredFamilies, familyQuery, selectedFamily, showAllFamilies]);

  const hiddenFamilyCount = filteredFamilies.length - visibleFamilies.length;

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3">
        <p className={cn(TEXT.bodyStrong, "flex items-center gap-1.5 text-foreground")}>
          Filtros
          {activeFilterCount > 0 ? (
            <span
              className={cn(
                TEXT.badge,
                "flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 tabular-nums text-primary-foreground",
              )}
            >
              {activeFilterCount}
            </span>
          ) : null}
        </p>
        {activeFilterCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            className={cn(TEXT.caption, "h-7 rounded-full px-2 text-muted-foreground hover:text-foreground")}
            onClick={onClearAll}
          >
            Limpar
          </Button>
        ) : null}
      </div>

      {promotionCount > 0 ? (
        <div className="border-b border-border/50 py-3">
          {/* Fora dos grupos de propriedade do produto de proposito: nao e "que
              tipo de produto", e sim um recorte da lista inteira. Ganha o
              tratamento de destaque para nao se perder entre marcas e
              categorias. */}
          <button
            type="button"
            onClick={() => onOnlyPromotionsChange(!onlyPromotions)}
            aria-pressed={onlyPromotions}
            className={cn(
              "group flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all duration-150",
              onlyPromotions
                ? "border-primary/30 bg-primary/[0.07] text-primary"
                : "border-border/60 bg-background text-muted-foreground hover:border-primary/25 hover:bg-primary/[0.03] hover:text-foreground",
            )}
          >
            <Sparkles
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                onlyPromotions ? "text-primary" : "text-muted-foreground/50 group-hover:text-primary/60",
              )}
            />
            <span className={cn(TEXT.compact, "min-w-0 flex-1 truncate", onlyPromotions && "font-medium")}>
              Só promoções
            </span>
            <span className={cn(TEXT.caption, "shrink-0 tabular-nums opacity-60")}>{promotionCount}</span>
          </button>
        </div>
      ) : null}

      {brands.length > 1 ? (
        <FilterGroup title="Marca" activeLabel={selectedBrand}>
          <div className="space-y-0.5">
            <FilterOptionButton label="Todas" isActive={selectedBrand === null} onClick={() => onBrandChange(null)} />
            {brands.map((brand) => (
              <FilterOptionButton
                key={brand.value}
                label={brand.value}
                count={brand.count}
                isActive={selectedBrand === brand.value}
                onClick={() => onBrandChange(selectedBrand === brand.value ? null : brand.value)}
              />
            ))}
          </div>
        </FilterGroup>
      ) : null}

      {types.length > 1 ? (
        <FilterGroup title="Categoria" activeLabel={selectedType}>
          <div className="space-y-0.5">
            <FilterOptionButton label="Todas" isActive={selectedType === null} onClick={() => onTypeChange(null)} />
            {types.map((type) => (
              <FilterOptionButton
                key={type.value}
                label={type.value}
                count={type.count}
                isActive={selectedType === type.value}
                onClick={() => onTypeChange(selectedType === type.value ? null : type.value)}
              />
            ))}
          </div>
        </FilterGroup>
      ) : null}

      {families.length > 1 ? (
        <FilterGroup title="Subcategoria" activeLabel={selectedFamily}>
          {families.length > FAMILY_VISIBLE_LIMIT ? (
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                value={familyQuery}
                onChange={(event) => setFamilyQuery(event.target.value)}
                placeholder="Buscar subcategoria"
                aria-label="Buscar subcategoria"
                className={cn(FONT_SIZE.small, "h-9 rounded-lg border-border/60 bg-muted/30 pl-8 pr-8")}
              />
              {familyQuery ? (
                <button
                  type="button"
                  onClick={() => setFamilyQuery("")}
                  aria-label="Limpar busca de subcategoria"
                  className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-0.5">
            <FilterOptionButton
              label="Todas"
              isActive={selectedFamily === null}
              onClick={() => onFamilyChange(null)}
            />
            {visibleFamilies.map((family) => (
              <FilterOptionButton
                key={family.value}
                label={family.value}
                count={family.count}
                isActive={selectedFamily === family.value}
                onClick={() => onFamilyChange(selectedFamily === family.value ? null : family.value)}
              />
            ))}
          </div>

          {filteredFamilies.length === 0 ? (
            <p className={cn(TEXT.caption, "px-2 py-3 text-center text-muted-foreground")}>
              Nenhuma subcategoria com esse termo.
            </p>
          ) : null}

          {hiddenFamilyCount > 0 ? (
            <ExpandToggle
              label={`Ver mais ${hiddenFamilyCount}`}
              expanded={false}
              onClick={() => setShowAllFamilies(true)}
            />
          ) : null}

          {showAllFamilies && !familyQuery.trim() ? (
            <ExpandToggle label="Ver menos" expanded onClick={() => setShowAllFamilies(false)} />
          ) : null}
        </FilterGroup>
      ) : null}
    </div>
  );
}
