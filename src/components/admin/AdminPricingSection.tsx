import { useCallback, useMemo, useState, useRef } from "react";
import { ArrowLeft, BadgeDollarSign, ImageIcon, Loader2, Pencil, Plus, RotateCcw, Save, Search, Trash2, Undo2, WandSparkles, Eye } from "lucide-react";
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
import {
  CUSTOMER_PRICE_OVERRIDES_TABLE,
  DEFAULT_CUSTOMER_TYPE,
  linhaDePrecoAtiva,
  precoDaLinhaDePreco,
  precoExibidoNaLinha,
} from "@/lib/pricing";
import { useCustomerTypes } from "@/hooks/useCustomerTypes";
import { useEtapaNaUrl } from "@/hooks/useFiltroNaUrl";
import { cn } from "@/lib/utils";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { useTabelasDePreco } from "@/hooks/useTabelasDePreco";
import { CardDeTiposDeConta } from "./CardDeTiposDeConta";
import { CardDeTabelasDePreco } from "./CardDeTabelasDePreco";
import { AdminPriceTablesOverview } from "./AdminPriceTablesOverview";
import { AdminPriceTableAccounts } from "./AdminPriceTableAccounts";
import { AdminPaginacao } from "./AdminPaginacao";
import { paginar } from "@/lib/paginacao";
import {
  filtrarTabelasNegociadas,
  lerChaveDeTabela,
  resumirTabelasNegociadas,
  resumirTabelasPorTipo,
  type OverrideParaResumo,
  type PerfilParaResumo,
  type ResumoDeTabela,
} from "@/lib/tabelasDePreco";
import { CUSTOMER_PROFILES_TABLE } from "@/lib/customerProfile";
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
  /** Abre a seção de Clientes filtrada nesta tabela. */
  onVerContasDaTabela: (chaveDaTabela: string) => void;
};

/** Instância única para "ainda não carregou": `?? []` devolveria array novo a cada render. */
const TABELAS_VAZIAS: { tprId: number; description: string }[] = [];

function normalizeProductCode(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function resolveRowKey(scopeMode: PricingScopeMode, customerType: string, proxisTprId: number | null, productCode: string) {
  return `${scopeMode}:${scopeMode === "customer_type" ? customerType : proxisTprId ?? "null"}:${productCode}`;
}

// `active` e `price` junto com o `id`, e nao so o `id`.
//
// `persistRow` precisa saber se a linha esta ligada no banco para nao religar
// uma que o admin desligou de proposito. Trazendo so o `id`, `existing.active`
// vinha `undefined`, caia no padrao `true`, e salvar um ajuste de preco
// reativava a linha em silencio.
//
// `price` entrou pelo mesmo motivo, um nivel adiante: salvar uma linha sem ter
// digitado nada precisa reescrever o preco que ja esta gravado, e nao zero.
async function loadExistingOverride(scopeMode: PricingScopeMode, customerType: string, proxisTprId: number | null, productCode: string) {
  let query = supabase
    .from(CUSTOMER_PRICE_OVERRIDES_TABLE)
    .select("id, active, price")
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

export function AdminPricingSection({ products, onRefreshPricing, onGoToProduct, onVerContasDaTabela }: AdminPricingSectionProps) {
  const { options: customerTypes, addCustomType } = useCustomerTypes();
  /**
   * Qual tabela está aberta vive na URL, e o escopo é consequência dela.
   *
   * Antes eram quatro `useState` que precisavam ser mantidos coerentes entre si
   * a cada clique. Derivando tudo de um parâmetro só, não há o que divergir — é
   * a mesma razão que fez os filtros do catálogo saírem do `useState` em
   * `useFiltroNaUrl`.
   *
   * E, como é um passo de histórico, o botão "voltar" do mouse fecha a tabela em
   * vez de sair do painel.
   */
  const [chaveDaTabela, definirChaveDaTabela] = useEtapaNaUrl("tabela");
  const [paginaDePreco, setPaginaDePreco] = useState(0);
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

  /**
   * As tabelas cadastradas.
   *
   * ⚠️ **Vem do hook, e não de uma consulta local.**
   *
   * Havia aqui uma `useQuery` com a chave `["price-tables"]` selecionando só
   * `tpr_id, name` — a mesma chave que `useTabelasDePreco` usa, com outro
   * formato. O react-query dedupe por chave: quem povoasse o cache primeiro
   * definia a forma do objeto para os dois. Quando esta ganhava, os cartões do
   * topo recebiam linhas **sem** `ativa` e sem `temPreco`, e liam `undefined`
   * como falso: as quatro tabelas apareciam "Desativada" e "— sem preços",
   * enquanto o banco dizia ativas e com 268 preços.
   *
   * Duas consultas com a mesma chave e formatos diferentes é sempre isso: a
   * ordem de montagem da tela decide o que se vê.
   */
  const tabelasCadastradasQuery = useTabelasDePreco();
  const tabelasCadastradas = useMemo(
    () => tabelasCadastradasQuery.data ?? TABELAS_VAZIAS,
    [tabelasCadastradasQuery.data],
  );

  const escopo = useMemo(() => lerChaveDeTabela(chaveDaTabela), [chaveDaTabela]);
  const scopeMode: PricingScopeMode = escopo?.origem === "negociada" ? "proxis_tpr_id" : "customer_type";
  const customerType = escopo?.customerType ?? DEFAULT_CUSTOMER_TYPE;
  const activeTprId = escopo?.origem === "negociada" ? escopo.tprId : null;
  const scopeReady = escopo !== null;

  /**
   * `scopeMode` distingue as duas camadas de preço, não dois sistemas.
   *
   * `proxis_tpr_id` e `customer_type` são nomes de coluna, e ficam até a
   * renomeação do banco (Fase 4 do plano). O que eles significam hoje é: tabela
   * negociada para um grupo, ou tabela geral do tipo de conta.
   */

  const productsWithCode = useMemo(
    () =>
      products
        .map((product) => ({ ...product, normalizedCode: normalizeProductCode(product.product_code) }))
        .filter((product) => product.normalizedCode),
    [products],
  );

  /** Preço de cadastro por código, para `persistRow` não depender da linha renderizada. */
  const basePriceByCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of productsWithCode) map.set(product.normalizedCode, coercePrice(product.price));
    return map;
  }, [productsWithCode]);

  /**
   * O inventário das tabelas, para a tela de entrada.
   *
   * Duas leituras inteiras — todas as linhas de preço e todos os perfis — em vez
   * de uma contagem por tabela. São ~740 e ~143 linhas, e o custo de trazer tudo
   * é menor que o de uma consulta por tabela num seletor que não sabe de antemão
   * quantas tabelas existem.
   */
  const inventarioQuery = useQuery({
    queryKey: ["admin-price-inventario"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const [precos, perfis] = await Promise.all([
        supabase
          .from(CUSTOMER_PRICE_OVERRIDES_TABLE)
          .select("customer_type, proxis_tpr_id, product_code, active"),
        supabase.from(CUSTOMER_PROFILES_TABLE).select("customer_type, proxis_tpr_id"),
      ]);
      if (precos.error) throw precos.error;
      if (perfis.error) throw perfis.error;
      return {
        overrides: (precos.data ?? []) as OverrideParaResumo[],
        perfis: (perfis.data ?? []) as PerfilParaResumo[],
      };
    },
  });

  const tabelasPorTipo = useMemo(
    () =>
      resumirTabelasPorTipo(
        inventarioQuery.data?.overrides ?? [],
        inventarioQuery.data?.perfis ?? [],
        customerTypes.map((opcao) => opcao.name),
      ),
    [inventarioQuery.data, customerTypes],
  );

  const tabelasNegociadas = useMemo(
    () =>
      filtrarTabelasNegociadas(
        resumirTabelasNegociadas(
          inventarioQuery.data?.overrides ?? [],
          inventarioQuery.data?.perfis ?? [],
          tabelasCadastradas,
        ),
      ),
    [inventarioQuery.data, tabelasCadastradas],
  );

  /** Quantas contas usam cada tabela como **negociação individual**. */
  const contasPorTabela = useMemo(() => {
    const conta = new Map<number, number>();
    for (const perfil of inventarioQuery.data?.perfis ?? []) {
      const tpr = perfil.proxis_tpr_id;
      if (typeof tpr !== "number") continue;
      conta.set(tpr, (conta.get(tpr) ?? 0) + 1);
    }
    return conta;
  }, [inventarioQuery.data]);

  /** Abre a tela de preços de uma tabela, vinda dos cards do topo. */
  const abrirTabelaPorTpr = useCallback(
    (tprId: number) => definirChaveDaTabela(`negociada:${tprId}`),
    [definirChaveDaTabela],
  );

  /** A tabela aberta, só para o cabeçalho. O escopo já saiu da chave, acima. */
  const tabelaAberta = useMemo(
    () =>
      [...tabelasPorTipo, ...tabelasNegociadas.visiveis].find((t) => t.chave === chaveDaTabela) ?? null,
    [tabelasPorTipo, tabelasNegociadas, chaveDaTabela],
  );

  /**
   * Abrir uma tabela é o que define o escopo agora.
   *
   * O seletor de escopo saiu: ele pedia uma escolha sem dizer o que havia em
   * cada opção. Aqui a escolha já foi feita na lista, com os números à vista, e
   * `scopeMode`/`customerType`/`appliedTprId` passam a ser consequência dela.
   *
   * Os rascunhos são limpos junto: preço digitado numa tabela e não salvo não
   * pode reaparecer em outra, onde significaria outra coisa.
   */
  const abrirTabela = (tabela: ResumoDeTabela) => {
    setDraftPrices({});
    setDraftActive({});
    setSearch("");
    setPriceFilter("all");
    definirChaveDaTabela(tabela.chave);
  };

  const voltarParaAsTabelas = () => {
    setDraftPrices({});
    setDraftActive({});
    definirChaveDaTabela(null);
    inventarioQuery.refetch();
  };

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

  /** 147 produtos numa rolagem só era o mesmo problema da tela de Produtos. */
  const paginaDeProdutos = useMemo(() => paginar(filteredProducts, paginaDePreco), [filteredProducts, paginaDePreco]);

  const loadedCount = overridesQuery.data?.length ?? 0;
  const activeCount = overridesQuery.data?.filter((row) => row.active).length ?? 0;

  const persistRow = async (productCode: string, nextPrice?: number, nextActive?: boolean) => {
    const normalizedCode = normalizeProductCode(productCode);
    if (!normalizedCode) return;

    // `existing` vem antes do `active` de proposito: sem ele, uma linha que esta
    // desligada no banco e que o admin nao tocou seria **religada** ao salvar um
    // ajuste de preco. O `?? true` de antes so acertava por acidente, porque
    // nada estava desligado.
    //
    // Agora ele vem antes do **preco** tambem, e pelo mesmo motivo: salvar uma
    // linha sem ter digitado nada gravava `parsePriceInput("")`, que e zero.
    const existing = await loadExistingOverride(scopeMode, customerType, activeTprId, normalizedCode);
    const price =
      typeof nextPrice === "number"
        ? Math.max(0, Math.round(nextPrice * 100) / 100)
        : precoDaLinhaDePreco(
            draftPrices[normalizedCode],
            existing ? coercePrice(existing.price) : null,
            basePriceByCode.get(normalizedCode) ?? 0,
          );
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
        /**
         * O preço de partida vem da mesma regra do campo, e não do rascunho cru.
         *
         * `parsePriceInput(draftPrices[code] ?? "")` é **zero** enquanto ninguém
         * digitou naquela linha — e o rascunho começa vazio. Ou seja: aplicar
         * "+10%" numa tabela recém-aberta calculava `0 * 1,1` e gravava R$ 0,00
         * em todos os produtos filtrados de uma vez; no modo de valor fixo,
         * gravava o próprio incremento como preço.
         *
         * É a mesma raiz do defeito que o campo tinha, um nível acima: aqui
         * escrevia no banco, e em cima da lista inteira.
         */
        const currentPrice = precoDaLinhaDePreco(
          draftPrices[code],
          overrideMap.has(code) ? coercePrice(overrideMap.get(code)!.price) : null,
          basePriceByCode.get(code) ?? 0,
        );
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
    { id: "with_override", label: "Com preço aqui", count: searchedProducts.filter((p) => overrideMap.has(p.normalizedCode)).length },
    { id: "without_override", label: "Sem preço aqui", count: searchedProducts.filter((p) => !overrideMap.has(p.normalizedCode)).length },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Preços"
        title={tabelaAberta ? tabelaAberta.nome : "Tabelas de preço"}
        description={
          tabelaAberta
            ? tabelaAberta.editavel
              ? `Preço próprio do site. ${tabelaAberta.pessoas} conta(s) compram por esta tabela. O produto que ela não precifica sai pelo preço de cadastro.`
              : "Preço negociado para um grupo de contas. Passa por cima da tabela do tipo."
            : "Cada linha é uma tabela de preço, com quantos produtos tem e quantas contas compram por ela."
        }
        actions={
          tabelaAberta ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[0.6875rem] text-primary">
                {loadedCount} item(ns)
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-[0.6875rem]">
                {activeCount} ativos
              </Badge>
              <Button type="button" variant="ghost" className="h-9 rounded-2xl px-3" onClick={voltarParaAsTabelas}>
                <ArrowLeft className="h-4 w-4" />
                Todas as tabelas
              </Button>
            </div>
          ) : null
        }
      />

      {!tabelaAberta ? (
        <>
          {/* ⚠️ Antes da lista, e não depois.
              A hierarquia é de composição: os tipos e as tabelas são **o que
              define** as linhas que aparecem logo abaixo. Ler a lista primeiro e
              encontrar no rodapé o lugar onde ela se monta inverte a ordem — e
              quem chega de Clientes pelo "+" cai no topo da tela, que é onde a
              ação que ele veio fazer precisa estar. */}
          {/* ⚠️ Dois cards, e não um com duas colunas.
              São dois assuntos com ciclos diferentes: um tipo se cria uma vez
              por ano; uma tabela se ativa e desativa. Espremidos lado a lado
              dentro do mesmo cartão, pareciam duas metades da mesma coisa. */}
          <div className="grid gap-4 xl:grid-cols-2">
            <CardDeTiposDeConta />
            <CardDeTabelasDePreco contasPorTabela={contasPorTabela} onAbrirTabela={abrirTabelaPorTpr} />
          </div>
          <AdminPriceTablesOverview
            tabelasPorTipo={tabelasPorTipo}
            tabelasNegociadas={tabelasNegociadas.visiveis}
            ocultasNegociadas={tabelasNegociadas.ocultas}
            carregando={inventarioQuery.isLoading}
            onAbrir={abrirTabela}
          />
        </>
      ) : (
        <>

      {/* "2 contas compram por esta tabela" sem dizer quais deixava a pergunta
          seguinte sem resposta dentro da própria tela. */}
      {tabelaAberta ? (
        <AdminPriceTableAccounts
          chaveDaTabela={tabelaAberta.chave}
          total={tabelaAberta.pessoas}
          onVerContas={onVerContasDaTabela}
        />
      ) : null}


      {/* Busca, abas, lista e paginação no mesmo cartão. Antes a busca era um
          cartão solto acima da lista — a mesma emenda que a tela de Produtos
          tinha, e que fazia os dois blocos parecerem coisas diferentes. */}
      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div>
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

            {/* Sem esta explicação, "Percentual / Valor fixo" era um seletor
                sem assunto: não dizia sobre o que incide, em quantos produtos,
                nem que grava direto. */}
            <div className="mt-4 rounded-[1rem] border border-dashed border-border/70 bg-background/60 p-3">
              <p className="text-[0.8125rem] font-medium text-foreground">Mudar vários preços de uma vez</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                Aplica sobre o preço atual de cada produto <strong className="font-medium text-foreground">desta tabela</strong>,
                nos {filteredProducts.length} que estão no filtro agora — inclusive os das outras páginas.{" "}
                {bulkMode === "percent"
                  ? "Percentual multiplica: 10 aumenta 10%, -10 diminui 10%."
                  : "Valor fixo soma: 1,50 aumenta R$ 1,50 em cada um, -1,50 diminui."}{" "}
                Grava direto, sem passar pelo Salvar de cada linha.
              </p>

              <div className="mt-3 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
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
                    Aplicar aos {filteredProducts.length}
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
        <div className="my-5 border-t border-border/70" />



      {!scopeReady ? (
        <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background p-8 text-center text-muted-foreground">
          Escolha uma tabela na lista para ver e ajustar os preços.
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
                ? "Nenhum produto tem preço nesta tabela. Use a busca acima para achar um produto e definir o preço."
                : priceFilter === "without_override"
                  ? "Esta tabela precifica todos os produtos do catálogo."
                  : "Nenhum produto encontrado com esse filtro."}
            </div>
          ) : (
            <div className="space-y-3">
              {paginaDeProdutos.itens.map((product) => {
                const code = product.normalizedCode;
                const existing = overrideMap.get(code);
                const key = resolveRowKey(scopeMode, customerType, activeTprId, code);
                const basePrice = coercePrice(product.price);
                // O preço gravado NESTA tabela, que é o que a tela precisa
                // mostrar. Antes o campo caía direto no `basePrice` e escondia
                // justamente o número que o admin veio conferir.
                const precoDaTabela = existing ? coercePrice(existing.price) : null;
                const valorNoCampo = precoExibidoNaLinha(draftPrices[code], precoDaTabela, basePrice);
                const draftPrice = parsePriceInput(valorNoCampo);
                const delta = draftPrice - basePrice;
                const hasDelta = draftPrice > 0 && Math.abs(delta) >= 0.01;
                const showDeltaPercent = hasDelta && basePrice > 0;
                // Uma fonte so para o selo, o botao e a gravacao. Ler
                // `draftActive[code]` cru era o que mostrava "Preco desligado"
                // em tudo: o rascunho comeca vazio e `undefined` e falso.
                const estaAtivo = linhaDePrecoAtiva(draftActive[code], existing?.active);
                /**
                 * Nada nesta linha foi ao banco até alguém apertar "Salvar" —
                 * nem o preço digitado, nem o "Desativar", que só marca o
                 * rascunho. A tela não dizia isso: o botão trocava de rótulo na
                 * hora e parecia que já tinha aplicado.
                 */
                const precoSalvo = precoDaLinhaDePreco(undefined, precoDaTabela, basePrice);
                const temPendencia =
                  Math.abs(draftPrice - precoSalvo) >= 0.01 ||
                  (typeof draftActive[code] === "boolean" && draftActive[code] !== (existing?.active ?? true));
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
                            {temPendencia ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-warm/10 px-2 py-0.5 font-medium text-warm">
                                não salvo
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[10rem_9rem_minmax(0,1fr)] lg:w-[34rem] lg:shrink-0">
                        <div>
                          <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Preço</p>
                          <Input
                            value={valorNoCampo}
                            onChange={(e) =>
                              setDraftPrices((current) => ({
                                ...current,
                                [code]: e.target.value,
                              }))
                            }
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

                        <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-1">
                          {/* O slot fica reservado mesmo sem alteração: some,
                              ele empurrava Salvar, excluir e editar para a
                              esquerda só naquela linha, e as linhas deixavam de
                              se alinhar entre si. */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-hidden={!hasDelta}
                            tabIndex={hasDelta ? 0 : -1}
                            className={cn(
                              "h-11 w-11 shrink-0 rounded-2xl text-muted-foreground hover:text-foreground",
                              !hasDelta && "pointer-events-none invisible",
                            )}
                            onClick={() => handleResetRow(code, basePrice)}
                            title="Voltar ao preço do catálogo"
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                          {/* Salvar é o momento em que o preço muda para quem
                              compra — e é o único. O "Desativar" ao lado só
                              marca o rascunho; nada vai ao banco sem passar
                              por aqui. */}
                          <ConfirmActionDialog
                            trigger={
                              <Button
                                type="button"
                                className="h-11 rounded-2xl px-4"
                                disabled={Boolean(savingKeys[key])}
                              >
                                {savingKeys[key] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Salvar
                              </Button>
                            }
                            title="Salvar este preço"
                            description={
                              <span>
                                <strong>{product.name}</strong> passa a custar{" "}
                                <strong>{formatBRL(draftPrice)}</strong> para quem compra por esta tabela
                                {estaAtivo ? "" : ", e o preço fica desligado — o produto sai pelo preço do catálogo"}.
                              </span>
                            }
                            confirmLabel="Salvar"
                            onConfirm={() => handleSaveRow(code)}
                          />
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
                            description={`Remover o preço de "${product.name}" (${code}) desta tabela? Ele volta a sair pelo preço normal do catálogo.`}
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

        <AdminPaginacao pagina={paginaDeProdutos} onMudarPagina={setPaginaDePreco} />
      </div>

        </>
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
                    definirChaveDaTabela(`tipo:${newTypeName.trim().toLowerCase()}`);
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
                definirChaveDaTabela(`tipo:${newTypeName.trim().toLowerCase()}`);
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
