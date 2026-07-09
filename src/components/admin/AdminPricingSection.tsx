import { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, Loader2, RotateCcw, Save, Search, WandSparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, coercePrice, parsePriceInput, priceToAdminInput } from "@/lib/formatMoney";
import { supabase } from "@/integrations/supabase/client";
import { CUSTOMER_PRICE_OVERRIDES_TABLE, CUSTOMER_TYPES, CUSTOMER_TYPE_LABELS, type CustomerType } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { AdminSectionHeader } from "./AdminSectionHeader";
import type { AdminProduct } from "./adminTypes";

type PricingScopeMode = "customer_type" | "proxis_tpr_id";

type PriceOverrideRow = {
  id: string;
  customer_type: CustomerType;
  proxis_tpr_id: number | null;
  product_code: string;
  price: number;
  active: boolean;
};

type AdminPricingSectionProps = {
  products: AdminProduct[];
  onRefreshPricing: () => void;
};

const KNOWN_PROXIS_TABLES = [
  { id: 8728, label: "Compra direto de fábrica", note: "Tabela ERP principal do catálogo" },
  { id: 8745, label: "Representante especial", note: "Tabela comercial especial" },
  { id: 8744, label: "Representante RJ", note: "Tabela do representante do Rio de Janeiro" },
] as const;

function normalizeProductCode(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function resolveRowKey(scopeMode: PricingScopeMode, customerType: CustomerType, proxisTprId: number | null, productCode: string) {
  return `${scopeMode}:${scopeMode === "customer_type" ? customerType : proxisTprId ?? "null"}:${productCode}`;
}

async function loadExistingOverride(scopeMode: PricingScopeMode, customerType: CustomerType, proxisTprId: number | null, productCode: string) {
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

export function AdminPricingSection({ products, onRefreshPricing }: AdminPricingSectionProps) {
  const [scopeMode, setScopeMode] = useState<PricingScopeMode>("customer_type");
  const [customerType, setCustomerType] = useState<CustomerType>("cliente");
  const [tprDraft, setTprDraft] = useState("");
  const [appliedTprId, setAppliedTprId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [draftActive, setDraftActive] = useState<Record<string, boolean>>({});
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const [bulkMode, setBulkMode] = useState<"percent" | "fixed">("percent");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const activeTprId = scopeMode === "proxis_tpr_id" ? appliedTprId : null;
  const scopeReady = scopeMode === "customer_type" || activeTprId !== null;
  const selectedKnownTable = KNOWN_PROXIS_TABLES.find((table) => table.id === Number(tprDraft));
  const scopeLabel =
    scopeMode === "customer_type"
      ? CUSTOMER_TYPE_LABELS[customerType]
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

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return productsWithCode;
    return productsWithCode.filter((product) => {
      const fields = [product.normalizedCode, product.name, product.family, product.type];
      return fields.some((value) => value.toLowerCase().includes(term));
    });
  }, [productsWithCode, search]);

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

  useEffect(() => {
    if (!scopeReady) {
      setDraftPrices({});
      setDraftActive({});
      return;
    }

    const nextPrices: Record<string, string> = {};
    const nextActive: Record<string, boolean> = {};

    for (const product of productsWithCode) {
      const existing = overrideMap.get(product.normalizedCode);
      const basePrice = coercePrice(product.price);
      nextPrices[product.normalizedCode] = priceToAdminInput(existing ? coercePrice(existing.price) : basePrice);
      nextActive[product.normalizedCode] = existing ? existing.active : true;
    }

    setDraftPrices(nextPrices);
    setDraftActive(nextActive);
  }, [overrideMap, productsWithCode, scopeReady, scopeMode, customerType, activeTprId]);

  const loadedCount = overridesQuery.data?.length ?? 0;
  const activeCount = overridesQuery.data?.filter((row) => row.active).length ?? 0;

  const persistRow = async (productCode: string, nextPrice: number, nextActive: boolean) => {
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
          <div className="rounded-[1.25rem] border border-border/70 bg-card p-4">
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
                <Select value={customerType} onValueChange={(value) => setCustomerType(value as CustomerType)}>
                  <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {CUSTOMER_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background">
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
                    className="h-11 rounded-2xl border-border/70 bg-background"
                  />
                  <Button
                    type="button"
                    className="h-11 rounded-2xl px-4"
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
                className="h-11 rounded-2xl border-border/70 bg-background"
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="h-11 rounded-2xl px-4" onClick={() => setSearch("")}>
                  Limpar
                </Button>
                <Button type="button" variant="ghost" className="h-11 rounded-2xl px-4" onClick={reloadScope} disabled={overridesQuery.isFetching}>
                  {overridesQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Recarregar
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[1rem] border border-dashed border-border/70 bg-background/60 p-3">
              <Select value={bulkMode} onValueChange={(value) => setBulkMode(value as "percent" | "fixed")}>
                <SelectTrigger className="h-10 w-[12rem] rounded-2xl border-border/70 bg-background">
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
                className="h-10 w-full rounded-2xl border-border/70 bg-background sm:max-w-[14rem]"
              />
              <Button
                type="button"
                className="h-10 rounded-2xl px-4"
                onClick={applyBulkAdjustment}
                disabled={bulkSaving || !scopeReady}
              >
                {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                Aplicar aos visíveis
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[1.25rem] border border-border/70 bg-primary/5 px-4 py-3 text-[13px] leading-6 text-foreground">
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
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background p-8 text-center text-muted-foreground">
          Nenhum produto encontrado com esse filtro.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((product) => {
            const code = product.normalizedCode;
            const existing = overrideMap.get(code);
            const key = resolveRowKey(scopeMode, customerType, activeTprId, code);
            const currentPrice = coercePrice(existing?.price ?? product.price);

            return (
              <div key={code} className="rounded-[1.25rem] border border-border/70 bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full px-2.5 py-0.5 font-mono text-[11px]">
                        {code}
                      </Badge>
                      <Badge variant={draftActive[code] ? "secondary" : "destructive"} className="rounded-full px-2.5 py-0.5 text-[11px]">
                        {draftActive[code] ? "Ativo" : "Inativo"}
                      </Badge>
                      <span className="text-[12px] text-muted-foreground">
                        {product.type} · {product.family}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-[15px] font-semibold text-foreground">{product.name}</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Base do catálogo: <span className="font-semibold text-foreground">{formatBRL(coercePrice(product.price))}</span>
                      {existing ? " | override já carregado neste escopo." : " | sem override salvo neste escopo."}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[10rem_10rem_auto] lg:w-[34rem] lg:shrink-0">
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Preço</p>
                      <Input
                        value={draftPrices[code] ?? priceToAdminInput(currentPrice)}
                        onChange={(e) =>
                          setDraftPrices((current) => ({
                            ...current,
                            [code]: e.target.value,
                          }))
                        }
                        inputMode="decimal"
                        className="h-11 rounded-2xl border-border/70 bg-background font-mono text-[13px]"
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
                      <Button
                        type="button"
                        className="h-11 rounded-2xl px-4"
                        onClick={() => handleSaveRow(code)}
                        disabled={Boolean(savingKeys[key])}
                      >
                        {savingKeys[key] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Salvar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-2xl px-3 text-destructive hover:bg-destructive/5 hover:text-destructive"
                        onClick={() => handleDeleteRow(code)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
