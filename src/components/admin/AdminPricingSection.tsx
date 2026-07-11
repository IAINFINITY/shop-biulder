import { useMemo, useState } from "react";
import { BadgeDollarSign, ImageIcon, Loader2, Pencil, Plus, RotateCcw, Save, Search, Trash2, Undo2, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, coercePrice, parsePriceInput, priceToAdminInput } from "@/lib/formatMoney";
import { supabase } from "@/integrations/supabase/client";
import { getProductImageUrls } from "@/lib/products";
import { CUSTOMER_PRICE_OVERRIDES_TABLE, customerTypeLabel } from "@/lib/pricing";
import { useCustomerTypes } from "@/hooks/useCustomerTypes";
import { cn } from "@/lib/utils";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { AdminSectionHeader } from "./AdminSectionHeader";
import type { AdminProduct } from "./adminTypes";

type PricingScopeMode = "customer_type" | "proxis_tpr_id";
type PricingFilterMode = "all" | "with_override" | "without_override";

type PriceOverrideRow = {
  id: string;
  customer_type: string;
  proxis_tpr_id: number | null;
  product_code: string;
  price: number;
  active: boolean;
};

type AdminPricingSectionProps = {
  products: AdminProduct[];
  onRefreshPricing: () => void;
  onGoToProduct?: (productCode: string) => void;
};

const KNOWN_PROXIS_TABLES = [
  { id: 8728, label: "Compra direto de fábrica", note: "Tabela ERP principal do catálogo" },
  { id: 8745, label: "Representante especial", note: "Tabela comercial especial" },
  { id: 8744, label: "Representante RJ", note: "Tabela do representante do Rio de Janeiro" },
] as const;

function normalizeProductCode(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function resolveRowKey(scopeMode: PricingScopeMode, customerType: string, proxisTprId: number | null, productCode: string) {
  return `${scopeMode}:${scopeMode === "customer_type" ? customerType : proxisTprId ?? "null"}:${productCode}`;
}

async function loadExistingOverride(scopeMode: PricingScopeMode, customerType: string, proxisTprId: number | null, productCode: string) {
  let query = supabase
    .from(CUSTOMER_PRICE_OVERRIDES_TABLE)
    .select("id")
    .eq("product_code", productCode);

  if (scopeMode === "customer_type") {
    query = query.eq("customer_type", customerType).is("proxis_tpr_id", null);
  } else if (proxisTprId !== null) {
    query = query.eq("proxis_tpr_id", proxisTprId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export function AdminPricingSection({ products, onRefreshPricing, onGoToProduct }: AdminPricingSectionProps) {
  const { options: customerTypes, addCustomType } = useCustomerTypes();
  const [scopeMode, setScopeMode] = useState<PricingScopeMode>("customer_type");
  const [customerType, setCustomerType] = useState<string>("cliente");
  const [tprDraft, setTprDraft] = useState("");
  const [appliedTprId, setAppliedTprId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [priceFilter, setPriceFilter] = useState<PricingFilterMode>("all");
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [draftActive, setDraftActive] = useState<Record<string, boolean>>({});
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const [bulkMode, setBulkMode] = useState<"percent" | "fixed">("percent");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const activeTprId = scopeMode === "proxis_tpr_id" ? appliedTprId : null;
  const scopeReady = scopeMode === "customer_type" || activeTprId !== null;
  const selectedKnownTable = KNOWN_PROXIS_TABLES.find((table) => table.id === Number(tprDraft));
  const scopeLabel =
    scopeMode === "customer_type"
      ? customerTypeLabel(customerType)
      : activeTprId !== null
        ? (() => {
            const match = KNOWN_PROXIS_TABLES.find((table) => table.id === activeTprId);
            return match ? `${match.label} (TPR ${match.id})` : `TPR ${activeTprId}`;
          })()
        : "Tabela Proxsys";

  const productsWithCode = useMemo(
    () =>
      products
        .map((product) => ({ ...product, normalizedCode: normalizeProductCode(product.product_code) }))
        .filter((product) => product.normalizedCode),
    [products],
  );

  const overridesQuery = useQuery({
    queryKey: ["admin-price-overrides", scopeMode, customerType, activeTprId],
    enabled: scopeReady,
    staleTime: 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from(CUSTOMER_PRICE_OVERRIDES_TABLE)
        .select("id, customer_type, proxis_tpr_id, product_code, price, active")
        .order("product_code", { ascending: true });

      if (scopeMode === "customer_type") {
        query = query.eq("customer_type", customerType).is("proxis_tpr_id", null);
      } else if (activeTprId !== null) {
        query = query.eq("proxis_tpr_id", activeTprId);
      }

      const { data, error } = await query;
      if (error) throw error;
        return (data ?? []) as PriceOverrideRow[];
    },
  });

  const overrideMap = useMemo(() => {
    const map = new Map<string, PriceOverrideRow>();
    for (const row of overridesQuery.data ?? []) {
      map.set(normalizeProductCode(row.product_code), row);
    }
    return map;
  }, [overridesQuery.data]);

  const searchedProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return productsWithCode;
    return productsWithCode.filter((product) => {
      const fields = [product.normalizedCode, product.name, product.family, product.type];
      return fields.some((value) => value.toLowerCase().includes(term));
    });
  }, [productsWithCode, search]);

  const filteredProducts = useMemo(() => {
    switch (priceFilter) {
      case "with_override":
        return searchedProducts.filter((product) => overrideMap.has(product.normalizedCode));
      case "without_override":
        return searchedProducts.filter((product) => !overrideMap.has(product.normalizedCode));
      default:
        return searchedProducts;
    }
  }, [searchedProducts, priceFilter, overrideMap]);

  const loadedCount = overridesQuery.data?.length ?? 0;
  const activeCount = overridesQuery.data?.filter((row) => row.active).length ?? 0;

  const persistRow = async (productCode: string, nextPrice?: number, nextActive?: boolean) => {
    const normalizedCode = normalizeProductCode(productCode);
    if (!normalizedCode) return;

    const price =
      typeof nextPrice === "number"
        ? Math.max(0, Math.round(nextPrice * 100) / 100)
        : Math.max(0, parsePriceInput(draftPrices[normalizedCode] ?? ""));
    const active = typeof nextActive === "boolean" ? nextActive : draftActive[normalizedCode] ?? true;
    const existing = await loadExistingOverride(scopeMode, customerType, activeTprId, normalizedCode);

    const payload = {
      customer_type: customerType,
      proxis_tpr_id: activeTprId,
      product_code: normalizedCode,
      price,
      active,
    };

    const { error } = existing
      ? await supabase.from(CUSTOMER_PRICE_OVERRIDES_TABLE).update(payload).eq("id", existing.id)
      : await supabase.from(CUSTOMER_PRICE_OVERRIDES_TABLE).insert(payload);

    if (error) throw error;
  };

  const handleSaveRow = async (productCode: string) => {
    const key = resolveRowKey(scopeMode, customerType, activeTprId, productCode);
    setSavingKeys((current) => ({ ...current, [key]: true }));
    try {
      await persistRow(productCode);
      toast.success(`Preço salvo para ${productCode}.`);
      onRefreshPricing();
    } catch (error) {
      console.error("Erro ao salvar preço", error);
      toast.error("Não foi possível salvar o preço.");
    } finally {
      setSavingKeys((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  };

  const handleDeleteRow = async (productCode: string) => {
    const normalizedCode = normalizeProductCode(productCode);
    const existing = await loadExistingOverride(scopeMode, customerType, activeTprId, normalizedCode);
    if (!existing) {
      toast("Essa linha ainda não tem uma tabela salva.");
      return;
    }

    const { error } = await supabase.from(CUSTOMER_PRICE_OVERRIDES_TABLE).delete().eq("id", existing.id);
    if (error) {
      console.error("Erro ao remover preço", error);
      toast.error("Erro ao remover preço.");
      return;
    }

    toast.success(`Preço removido de ${normalizedCode}.`);
    onRefreshPricing();
  };

  const handleResetRow = (productCode: string, basePrice: number) => {
    const code = normalizeProductCode(productCode);
    setDraftPrices((current) => ({ ...current, [code]: priceToAdminInput(basePrice) }));
  };

  const applyBulkAdjustment = async () => {
    const value = parsePriceInput(bulkValue);
    if (!Number.isFinite(value) || value === 0) {
      toast.error("Informe um ajuste válido para aplicar em massa.");
      return;
    }

    if (filteredProducts.length === 0) {
      toast.error("Nenhum produto visível para aplicar o ajuste.");
      return;
    }

    setBulkSaving(true);
    try {
      for (const product of filteredProducts) {
        const code = product.normalizedCode;
        const currentPrice = parsePriceInput(draftPrices[code] ?? "");
        const nextPrice =
          bulkMode === "percent"
            ? Math.max(0, Math.round(currentPrice * (1 + value / 100) * 100) / 100)
            : Math.max(0, Math.round((currentPrice + value) * 100) / 100);

        setDraftPrices((current) => ({ ...current, [code]: priceToAdminInput(nextPrice) }));
        await persistRow(code, nextPrice, draftActive[code] ?? true);
      }

      toast.success("Ajuste em massa aplicado com sucesso.");
      onRefreshPricing();
    } catch (error) {
      console.error("Erro ao aplicar ajuste em massa", error);
      toast.error("Não foi possível aplicar o ajuste em massa.");
    } finally {
      setBulkSaving(false);
    }
  };

  const reloadScope = async () => {
    await overridesQuery.refetch();
    onRefreshPricing();
  };

  const bulkLabel = bulkMode === "percent" ? `${bulkValue}%` : `R$ ${bulkValue}`;
  const filterTabs: Array<{ id: PricingFilterMode; label: string; count: number }> = [
    { id: "all", label: "Todos", count: searchedProducts.length },
    { id: "with_override", label: "Com override", count: searchedProducts.filter((p) => overrideMap.has(p.normalizedCode)).length },
    { id: "without_override", label: "Sem override", count: searchedProducts.filter((p) => !overrideMap.has(p.normalizedCode)).length },
  ];

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Preços"
        title="Tabela de preços por cliente ou tabela ERP"
        description="Carregue uma tabela por tipo de cliente ou por TPR do Proxsys, edite valores e aplique ajustes em lote."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[11px] text-primary">
              {loadedCount} item(ns)
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
              {activeCount} ativos
            </Badge>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="rounded-[1.25rem] border border-border/70 bg-card p-3 sm:p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <BadgeDollarSign className="h-4 w-4 text-primary" />
              Escopo da tabela
            </div>

            <div className="mt-4 inline-flex rounded-full border border-border/70 bg-background p-1">
              <Button
                type="button"
                      variant={scopeMode === "customer_type" ? "default" : "ghost"}
                className="h-10 sm:h-9 rounded-full px-3 text-xs"
                onClick={() => setScopeMode("customer_type")}
              >
                Por tipo de cliente
              </Button>
              <Button
                type="button"
                      variant={scopeMode === "proxis_tpr_id" ? "default" : "ghost"}
                className="h-10 sm:h-9 rounded-full px-3 text-xs"
                onClick={() => setScopeMode("proxis_tpr_id")}
              >
                Por tabela Proxsys
              </Button>
            </div>

            {scopeMode === "customer_type" ? (
              <div className="mt-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Tipo de cliente
                </p>
                <div className="flex gap-2">
                  <Select value={customerType} onValueChange={(value) => setCustomerType(value)}>
                    <SelectTrigger className="h-10 sm:h-11 rounded-2xl border-border/70 bg-background flex-1">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {customerTypes.map((type) => (
                        <SelectItem key={type.name} value={type.name}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 sm:h-11 w-10 sm:w-11 rounded-2xl shrink-0"
                    onClick={() => {
                      setNewTypeName("");
                      setNewTypeOpen(true);
                    }}
                    title="Adicionar novo tipo de cliente"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Tabela ERP do Proxsys
                </p>
                <div className="flex flex-col gap-2">
                  <Select
                    value={selectedKnownTable ? String(selectedKnownTable.id) : "custom"}
                    onValueChange={(value) => {
                      if (value === "custom") {
                        setTprDraft("");
                        setAppliedTprId(null);
                        return;
                      }

                      const parsed = Number(value);
                      if (!Number.isFinite(parsed) || parsed <= 0) return;
                      setTprDraft(String(Math.trunc(parsed)));
                      setAppliedTprId(Math.trunc(parsed));
                    }}
                  >
                    <SelectTrigger className="h-10 sm:h-11 rounded-2xl border-border/70 bg-background">
                      <SelectValue placeholder="Escolha uma tabela conhecida ou digite manualmente" />
                    </SelectTrigger>
                    <SelectContent>
                      {KNOWN_PROXIS_TABLES.map((table) => (
                        <SelectItem key={table.id} value={String(table.id)}>
                          {table.label} - TPR {table.id}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Informar código manualmente</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    inputMode="numeric"
                    placeholder="Ex.: 8728"
                    value={tprDraft}
                    onChange={(e) => setTprDraft(e.target.value.replace(/[^\d]/g, ""))}
                    className="h-10 sm:h-11 rounded-2xl border-border/70 bg-background"
                  />
                  <Button
                    type="button"
                    className="h-10 sm:h-11 rounded-2xl px-4"
                    onClick={() => {
                      const parsed = Number(tprDraft);
                      if (!Number.isFinite(parsed) || parsed <= 0) {
                        toast.error("Informe um TPR válido.");
                        return;
                      }
                      setAppliedTprId(Math.trunc(parsed));
                    }}
                  >
                    Carregar tabela ERP
                  </Button>
                </div>
                <p className="text-[12px] leading-5 text-muted-foreground">
                  Se a tabela já for conhecida, selecione pelo nome. Se não, informe o código técnico do Proxsys.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-[1.25rem] border border-border/70 bg-card p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Search className="h-4 w-4 text-primary" />
              Busca e ajuste rápido
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                placeholder="Pesquisar produto por código, nome, família ou tipo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 sm:h-11 rounded-2xl border-border/70 bg-background"
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="h-10 sm:h-11 rounded-2xl px-4" onClick={() => setSearch("")}>
                  Limpar
                </Button>
                <Button type="button" variant="ghost" className="h-10 sm:h-11 rounded-2xl px-4" onClick={reloadScope} disabled={overridesQuery.isFetching}>
                  {overridesQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Recarregar
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 rounded-[1rem] border border-dashed border-border/70 bg-background/60 p-3">
              <Select value={bulkMode} onValueChange={(value) => setBulkMode(value as "percent" | "fixed")}>
                <SelectTrigger className="h-10 sm:h-11 w-full sm:w-[12rem] rounded-2xl border-border/70 bg-background">
                  <SelectValue placeholder="Tipo de ajuste" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
              <Input
                      placeholder={bulkMode === "percent" ? "Ex.: 5 para +5%" : "Ex.: 1,50 para somar"}
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                className="h-10 w-full rounded-2xl border-border/70 bg-background sm:w-auto sm:flex-1"
              />
              <ConfirmActionDialog
                trigger={
                  <Button
                    type="button"
                    className="h-10 rounded-2xl px-4"
                    disabled={!scopeReady}
                  >
                    {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                    Aplicar aos visíveis
                  </Button>
                }
                title="Aplicar ajuste em massa"
                description={
                  <span>
                    Deseja aplicar <strong>{bulkLabel}</strong> em{" "}
                    <strong>{filteredProducts.length} produto(s)</strong> visíveis?
                    <br />
                    Essa ação salva cada preço individualmente.
                  </span>
                }
                confirmLabel="Aplicar"
                onConfirm={applyBulkAdjustment}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[1.25rem] border border-border/70 bg-primary/5 px-3 sm:px-4 py-3 text-[12px] sm:text-[13px] leading-5 sm:leading-6 text-foreground">
          Escopo atual: <span className="font-semibold">{scopeLabel}</span>. Os preços são salvos por produto e respeitam a tabela ERP quando houver TPR vinculado.
        </div>

      {!scopeReady ? (
        <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background p-8 text-center text-muted-foreground">
          Selecione uma tabela Proxsys para carregar os preços.
        </div>
      ) : overridesQuery.isLoading ? (
        <div className="space-y-3 rounded-[1.25rem] border border-dashed border-border/70 bg-background p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rounded-[1rem] border border-border/60 bg-card p-4">
              <Skeleton className="h-4 w-48 rounded-md" />
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_8rem]">
                <Skeleton className="h-11 rounded-2xl" />
                <Skeleton className="h-11 rounded-2xl" />
                <Skeleton className="h-11 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {filterTabs.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                variant={priceFilter === tab.id ? "default" : "outline"}
                className="h-10 sm:h-9 rounded-full px-3 text-[13px] sm:text-[12px]"
                onClick={() => setPriceFilter(tab.id)}
              >
                {tab.label}
                <Badge variant="secondary" className="ml-1.5 rounded-full px-1.5 py-0 text-[10px] leading-none">
                  {tab.count}
                </Badge>
              </Button>
            ))}
          </div>

          <div className="min-h-[12rem]">
          {filteredProducts.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background p-8 text-center text-muted-foreground">
              {priceFilter === "with_override"
                ? "Nenhum produto com override salvo neste escopo."
                : priceFilter === "without_override"
                  ? "Todos os produtos já possuem override neste escopo."
                  : "Nenhum produto encontrado com esse filtro."}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map((product) => {
                const code = product.normalizedCode;
                const existing = overrideMap.get(code);
                const key = resolveRowKey(scopeMode, customerType, activeTprId, code);
                const basePrice = coercePrice(product.price);
                const draftPrice = parsePriceInput(draftPrices[code] ?? "");
                const delta = draftPrice - basePrice;
                const hasDelta = draftPrice > 0 && Math.abs(delta) >= 0.01;
                const showDeltaPercent = hasDelta && basePrice > 0;
                const thumb = getProductImageUrls(product)[0];

                return (
                  <div
                    key={code}
                    className={cn(
                      "rounded-[1.25rem] border bg-card p-3 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors",
                      existing
                        ? "border-primary/25 bg-primary/[0.02]"
                        : "border-border/70",
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center">
                      <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-border bg-background">
                          {thumb ? (
                            <img src={thumb} alt={product.name} className="h-full w-full object-contain p-1.5" />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-muted-foreground/35" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 font-mono text-[11px]">
                              {code}
                            </Badge>
                            <Badge variant={draftActive[code] ? "secondary" : "destructive"} className="rounded-full px-2.5 py-0.5 text-[11px]">
                              {draftActive[code] ? "Ativo" : "Inativo"}
                            </Badge>
                            {existing ? (
                              <Badge className="rounded-full border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] text-primary">
                                Override salvo
                              </Badge>
                            ) : null}
                            <span className="text-[12px] text-muted-foreground">
                              {product.type} · {product.family}
                            </span>
                          </div>
                          <p className="mt-2 truncate text-[15px] font-semibold text-foreground">{product.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                            <span>
                              Base do catálogo: <span className="font-semibold text-foreground">{formatBRL(basePrice)}</span>
                            </span>
                            {hasDelta ? (
                              <span className={cn("font-medium tabular-nums", delta > 0 ? "text-emerald-600" : "text-red-500")}>
                                {delta > 0 ? "+" : ""}{formatBRL(delta)}
                                {showDeltaPercent ? ` (${delta > 0 ? "+" : ""}${((delta / basePrice) * 100).toFixed(0)}%)` : null}
                              </span>
                            ) : existing ? (
                              <span className="text-muted-foreground">Sem alteração</span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[10rem_auto_auto_auto] gap-2 sm:gap-3 lg:w-[38rem] lg:shrink-0">
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Preço</p>
                          <Input
                            value={draftPrices[code] ?? priceToAdminInput(basePrice)}
                            onChange={(e) =>
                              setDraftPrices((current) => ({
                                ...current,
                                [code]: e.target.value,
                              }))
                            }
                            inputMode="decimal"
                            className={cn(
                              "h-11 rounded-2xl border-border/70 bg-background font-mono text-[13px]",
                              hasDelta && "border-primary/30",
                            )}
                          />
                        </div>

                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "h-11 w-full rounded-2xl px-3 text-[13px]",
                              draftActive[code] ? "border-primary/20 bg-primary/5 text-primary" : "border-destructive/20 bg-destructive/5 text-destructive",
                            )}
                            onClick={() => setDraftActive((current) => ({ ...current, [code]: !(current[code] ?? true) }))}
                          >
                            {draftActive[code] ? "Desativar" : "Ativar"}
                          </Button>
                        </div>

                        <div className="flex items-end gap-2">
                          {hasDelta ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 rounded-2xl text-muted-foreground hover:text-foreground"
                              onClick={() => handleResetRow(code, basePrice)}
                              title="Resetar ao preço base"
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            className="h-11 rounded-2xl px-4"
                            onClick={() => handleSaveRow(code)}
                            disabled={Boolean(savingKeys[key])}
                          >
                            {savingKeys[key] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Salvar
                          </Button>
                          <ConfirmActionDialog
                            trigger={
                              <Button
                                type="button"
                                variant="outline"
                                className="h-11 rounded-2xl px-3 text-destructive hover:bg-destructive/5 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            }
                            title="Remover preço"
                            description={`Deseja remover o preço customizado de "${product.name}" (${code}) neste escopo? O produto voltará ao preço base do catálogo.`}
                            confirmLabel="Remover"
                            destructive
                            onConfirm={() => handleDeleteRow(code)}
                          />
                          {onGoToProduct ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 rounded-2xl text-muted-foreground hover:text-foreground"
                              onClick={() => onGoToProduct(code)}
                              title="Editar produto no catálogo"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      )}

      <Dialog open={newTypeOpen} onOpenChange={setNewTypeOpen}>
        <DialogContent className="max-w-[26rem] rounded-[1.5rem] border-border/70">
          <DialogHeader>
            <DialogTitle className="text-[1.05rem] font-black tracking-[-0.04em]">Novo tipo de cliente</DialogTitle>
            <DialogDescription className="text-[13px] leading-6 text-muted-foreground">
              Crie um novo tipo que ficará disponível para tabelas de preço e classificação de clientes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pricing-new-type-name">Nome do tipo</Label>
              <Input
                id="pricing-new-type-name"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="Ex.: Atacadista"
                className="h-11 rounded-2xl border-border/70 bg-background"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTypeName.trim()) {
                    addCustomType(newTypeName);
                    setCustomerType(newTypeName.trim().toLowerCase());
                    setNewTypeName("");
                    setNewTypeOpen(false);
                  }
                }}
              />
              {newTypeName.trim() ? (
                <p className="text-[12px] text-muted-foreground">
                  Será salvo como: <span className="font-semibold text-foreground">{newTypeName.trim().toLowerCase()}</span>
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="mt-0 rounded-2xl px-4 text-sm" onClick={() => { setNewTypeOpen(false); setNewTypeName(""); }}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="mt-0 rounded-2xl px-4 text-sm"
              disabled={!newTypeName.trim()}
              onClick={() => {
                addCustomType(newTypeName);
                setCustomerType(newTypeName.trim().toLowerCase());
                setNewTypeName("");
                setNewTypeOpen(false);
              }}
            >
              Criar tipo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
