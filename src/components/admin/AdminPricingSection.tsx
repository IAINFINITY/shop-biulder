import { useMemo, useState } from "react";
import { BadgeDollarSign, ImageIcon, Loader2, Pencil, Plus, RotateCcw, Save, Search, Trash2, Undo2, WandSparkles, Info } from "lucide-react";
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
import { CUSTOMER_PRICE_OVERRIDES_TABLE, customerTypeLabel, linhaDePrecoAtiva } from "@/lib/pricing";
import { useCustomerTypes } from "@/hooks/useCustomerTypes";
import { cn } from "@/lib/utils";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { AdminSectionHeader } from "./AdminSectionHeader";
import { AdminProxisPriceTables } from "./AdminProxisPriceTables";
import type { AdminProduct } from "./adminTypes";
import { apiFetch } from "@/lib/apiFetch";

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

function normalizeProductCode(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function resolveRowKey(scopeMode: PricingScopeMode, customerType: string, proxisTprId: number | null, productCode: string) {
  return `${scopeMode}:${scopeMode === "customer_type" ? customerType : proxisTprId ?? "null"}:${productCode}`;
}

// `active` junto com o `id`, e nao so o `id`.
//
// `persistRow` precisa saber se a linha esta ligada no banco para nao religar
// uma que o admin desligou de proposito. Trazendo so o `id`, `existing.active`
// vinha `undefined`, caia no padrao `true`, e salvar um ajuste de preco
// reativava a linha em silencio.
async function loadExistingOverride(scopeMode: PricingScopeMode, customerType: string, proxisTprId: number | null, productCode: string) {
  let query = supabase
    .from(CUSTOMER_PRICE_OVERRIDES_TABLE)
    .select("id, active")
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

  // As tabelas vem do Proxis, nao de uma lista escrita aqui: uma lista fixa
  // envelhece calada — a 8729 existia no ERP com 170 itens e nao aparecia.
  const proxisTablesQuery = useQuery({
    queryKey: ["proxis-price-tables"],
    queryFn: async () => {
      const res = await apiFetch("/api/proxis-price-tables");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { tables: { tprId: number; description: string; usedByCustomers: boolean }[] };
    },
    staleTime: 60_000,
    retry: false,
  });
  const proxisTables = proxisTablesQuery.data?.tables ?? [];

  const activeTprId = scopeMode === "proxis_tpr_id" ? appliedTprId : null;
  const scopeReady = scopeMode === "customer_type" || activeTprId !== null;
  const selectedProxisTable = proxisTables.find((table) => table.tprId === activeTprId) ?? null;

  // Tabela do Proxis e espelho, nao original.
  //
  // A API do ProManager expoe `ObterTabelasPreco` para ler, mas nao tem metodo
  // de gravacao de preco — `SalvarTabelaPreco`, `SalvarItemTabelaPreco` e
  // `AtualizarTabelaPreco` respondem "method not found". Sem caminho de volta,
  // deixar editar aqui criaria a divergencia que a integracao existe para
  // evitar: o site mostraria um preco que o ERP desconhece, e a proxima
  // importacao apagaria a alteracao sem aviso.
  //
  // Editavel continua sendo a tabela geral do tipo de cliente, que e nossa.
  const isProxisTable = scopeMode === "proxis_tpr_id";
  const scopeLabel =
    scopeMode === "customer_type"
      ? customerTypeLabel(customerType)
      : activeTprId !== null
        ? selectedProxisTable
          ? `${selectedProxisTable.description} (TPR ${activeTprId})`
          : `TPR ${activeTprId}`
        : "Tabela do Proxis";

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
    // `existing` vem antes do `active` de proposito: sem ele, uma linha que esta
    // desligada no banco e que o admin nao tocou seria **religada** ao salvar um
    // ajuste de preco. O `?? true` de antes so acertava por acidente, porque
    // nada estava desligado.
    const existing = await loadExistingOverride(scopeMode, customerType, activeTprId, normalizedCode);
    const active =
      typeof nextActive === "boolean"
        ? nextActive
        : linhaDePrecoAtiva(draftActive[normalizedCode], existing?.active);

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
        // Sem terceiro argumento: quem resolve o "ativo" e o `persistRow`, que
        // ja consulta o que esta gravado. Repetir a regra aqui era o que fazia
        // o ajuste em massa religar linha desligada.
        await persistRow(code, nextPrice);
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
    { id: "with_override", label: "Preço da tabela", count: searchedProducts.filter((p) => overrideMap.has(p.normalizedCode)).length },
    { id: "without_override", label: "Preço de cadastro", count: searchedProducts.filter((p) => !overrideMap.has(p.normalizedCode)).length },
  ];

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Preços"
        title="Preços por tabela"
        description="As tabelas vêm do Proxis. O que uma tabela não precifica cai na tabela geral do tipo de cliente, e só depois no preço de cadastro."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[0.6875rem] text-primary">
              {loadedCount} item(ns)
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[0.6875rem]">
              {activeCount} ativos
            </Badge>
          </div>
        }
      />

      {/* Origem dos precos, no topo: a tabela do ERP e a fonte, e a edicao
          manual abaixo e a excecao. Invertido, quem abria a tela via primeiro a
          lista de produtos e nao tinha como saber se ela estava em dia. */}
      {/* So no modo Proxis: vendo tabela por tipo de cliente, a lista de tabelas
          do ERP nao tem o que fazer ali e confunde a origem do que se edita. */}
      {isProxisTable ? (
        <AdminProxisPriceTables
          onImported={() => overridesQuery.refetch()}
          activeTprId={activeTprId}
          onSelectTable={(tprId) => setAppliedTprId(tprId)}
        />
      ) : null}

      {isProxisTable ? (
        <div className="flex items-start gap-2.5 rounded-[1.25rem] border border-sky-200 bg-sky-50/60 px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
          <p className="text-[0.8125rem] leading-6 text-sky-900">
            <strong className="font-medium">Esta tabela é do Proxis e não pode ser editada aqui.</strong> A API do ERP
            permite ler os preços, mas não gravar — se a alteração fosse aceita neste lado, o site passaria a mostrar um
            valor que o Proxis desconhece, e a próxima importação a apagaria sem aviso. Altere no Proxis e use{" "}
            <strong className="font-medium">Importar</strong> acima. Para preço próprio, use a tabela por tipo de cliente.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="rounded-[1.25rem] border border-border/70 bg-card p-3 sm:p-4">
            <div className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Tabela ERP do Proxsys
                </p>
                <div className="flex flex-col gap-2">
                  <p className="text-[0.8125rem] leading-6 text-muted-foreground">
                    {selectedProxisTable
                      ? `${selectedProxisTable.tprId} — ${selectedProxisTable.description}`
                      : "Escolha uma tabela na lista acima para ver os preços dela."}
                  </p>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Se a tabela já for conhecida, selecione pelo nome. Se não, informe o código técnico do Proxsys.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-[1.25rem] border border-border/70 bg-card p-4">
            <div className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Search className="h-4 w-4 text-primary" />
              Busca e ajuste rápido
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  placeholder="Buscar por código, nome, subcategoria ou categoria"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 rounded-full border-border/70 bg-background pl-10 sm:h-11"
                />
              </div>
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

        <div className="mt-4 rounded-[1.25rem] border border-border/70 bg-primary/5 px-3 sm:px-4 py-3 text-xs sm:text-[0.8125rem] leading-5 sm:leading-6 text-foreground">
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
                className="h-10 sm:h-9 rounded-full px-3 text-[0.8125rem] sm:text-xs"
                onClick={() => setPriceFilter(tab.id)}
              >
                {tab.label}
                <Badge variant="secondary" className="ml-1.5 rounded-full px-1.5 py-0 text-[0.625rem] leading-none">
                  {tab.count}
                </Badge>
              </Button>
            ))}
          </div>

          <div className="rounded-[1rem] border border-dashed border-border/70 bg-background/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
            Produto com <span className="font-medium text-foreground">preço da tabela</span> aparece destacado. Os
            demais saem pelo preço de cadastro do catálogo — a tabela não os precifica.
          </div>

          <div className="min-h-[12rem]">
          {filteredProducts.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background p-8 text-center text-muted-foreground">
              {priceFilter === "with_override"
                ? "Nenhum produto tem preço nesta tabela. Importe a tabela do Proxis acima."
                : priceFilter === "without_override"
                  ? "Esta tabela precifica todos os produtos do catálogo."
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
                // Uma fonte so para o selo, o botao e a gravacao. Ler
                // `draftActive[code]` cru era o que mostrava "Preco desligado"
                // em tudo: o rascunho comeca vazio e `undefined` e falso.
                const estaAtivo = linhaDePrecoAtiva(draftActive[code], existing?.active);
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
                            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 font-mono text-[0.6875rem]">
                              {code}
                            </Badge>
                            {/* "Inativo" so faz sentido quando existe linha de
                                preco nesta tabela: sem linha, o selo dizia
                                "Inativo" ao lado de um produto ativo na loja e
                                lia-se como produto desativado. O estado do
                                produto no catalogo e outro campo, na tela de
                                produtos. */}
                            {existing ? (
                              <Badge
                                variant={estaAtivo ? "secondary" : "destructive"}
                                className="rounded-full px-2.5 py-0.5 text-[0.6875rem]"
                                title={estaAtivo ? "Preço em vigor nesta tabela" : "Preço desligado nesta tabela"}
                              >
                                {estaAtivo ? "Preço ativo" : "Preço desligado"}
                              </Badge>
                            ) : null}
                            {/* Origem do preco deste produto nesta tabela. Sem
                                isso nao havia como saber, olhando a lista, se o
                                valor veio do ERP ou e o de cadastro — e era
                                justamente essa diferenca que passava batida. */}
                            {existing ? (
                              <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[0.6875rem] text-emerald-800">
                                Preço da tabela
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="rounded-full border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[0.6875rem] text-amber-800"
                                title="Esta tabela não precifica o produto. Ele sai pelo preço de cadastro do catálogo."
                              >
                                Preço de cadastro
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {product.type} · {product.family}
                            </span>
                          </div>
                          <p className="mt-2 truncate text-sm font-semibold text-foreground">{product.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[10rem_auto_auto_auto] lg:w-[38rem] lg:shrink-0">
                        <div>
                          <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Preço</p>
                          <Input
                            value={draftPrices[code] ?? priceToAdminInput(basePrice)}
                            onChange={(e) =>
                              setDraftPrices((current) => ({
                                ...current,
                                [code]: e.target.value,
                              }))
                            }
                            readOnly={isProxisTable}
                            title={isProxisTable ? "Preço vem do Proxis. Altere no ERP e importe de novo." : undefined}
                            inputMode="decimal"
                            className={cn(
                              "h-11 rounded-2xl border-border/70 bg-background font-mono text-[0.8125rem]",
                              hasDelta && "border-primary/30",
                            )}
                          />
                        </div>

                        <div>
                          <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "h-11 w-full rounded-2xl px-3 text-[0.8125rem]",
                              estaAtivo ? "border-primary/20 bg-primary/5 text-primary" : "border-destructive/20 bg-destructive/5 text-destructive",
                            )}
                            onClick={() =>
                              setDraftActive((current) => ({
                                ...current,
                                [code]: !linhaDePrecoAtiva(current[code], existing?.active),
                              }))
                            }
                          >
                            {estaAtivo ? "Desativar" : "Ativar"}
                          </Button>
                        </div>

                        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
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
                            disabled={Boolean(savingKeys[key]) || isProxisTable}
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
            <DialogTitle className="text-base font-semibold tracking-tight">Novo tipo de cliente</DialogTitle>
            <DialogDescription className="text-[0.8125rem] leading-6 text-muted-foreground">
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
                <p className="text-xs text-muted-foreground">
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
