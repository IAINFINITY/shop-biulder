import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { TEXT } from "@/lib/typography";
import { cn } from "@/lib/utils";

/**
 * Tabelas de preco do Proxis, lidas pela integracao.
 *
 * Antes a tabela `customer_price_overrides` era alimentada por fora, sem nada na
 * interface mostrando o que tinha entrado. O resultado passou despercebido: a
 * tabela 8728 ficou com 143 dos 156 itens em preco zero, e a 8729 nunca foi
 * importada apesar de ter cliente apontando para ela.
 *
 * Aqui a origem fica visivel: quantos itens o Proxis tem, quantos batem com o
 * catalogo, quantos ja estao no nosso banco e se algum cliente usa a tabela.
 */

/** Quantas tabelas por pagina: o suficiente para caber sem rolar o bloco. */
const PAGE_SIZE = 8;

/**
 * Lista vazia compartilhada, para "ainda nao carregou".
 *
 * `?? []` na chamada devolve um array novo a cada render, e a identidade muda
 * sempre — o `useMemo` abaixo recalcularia toda vez, e qualquer efeito que
 * dependesse dele entraria em ciclo. E a mesma raiz do "Maximum update depth
 * exceeded" que o mapa de precos causou.
 */
const EMPTY_TABLES: ProxisTableRow[] = [];

type ProxisTableRow = {
  tprId: number;
  description: string;
  active: boolean;
  itemsInProxis: number;
  itemsInCatalog: number;
  catalogWithoutPrice: number;
  importedRows: number;
  importedZeros: number;
  usedByCustomers: boolean;
};

async function fetchTables(): Promise<{ tables: ProxisTableRow[]; catalogSize: number }> {
  const res = await fetch("/api/proxis-price-tables");
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
  return res.json();
}

export function AdminProxisPriceTables({
  onImported,
  activeTprId,
  onSelectTable,
}: {
  onImported?: () => void;
  /** Tabela aberta na lista de produtos abaixo. */
  activeTprId?: number | null;
  onSelectTable?: (tprId: number) => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["proxis-price-tables"],
    queryFn: fetchTables,
    staleTime: 60_000,
    retry: false,
  });

  const importar = useMutation({
    mutationFn: async (tprIds: number[]) => {
      const res = await fetch("/api/proxis-price-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tprIds }),
      });
      const payload = (await res.json()) as { results?: { tprId: number; rows: number; error: string | null }[]; error?: string };
      if (!res.ok) throw new Error(payload.error ?? `HTTP ${res.status}`);
      return payload.results ?? [];
    },
    onSuccess: async (results) => {
      const falhas = results.filter((r) => r.error);
      const linhas = results.reduce((sum, r) => sum + r.rows, 0);
      if (falhas.length > 0) toast.warning(`${linhas} preço(s) importado(s), ${falhas.length} tabela(s) falharam.`);
      else toast.success(`${linhas} preço(s) importado(s) de ${results.length} tabela(s).`);
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["proxis-price-tables"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-pricing"] });
      onImported?.();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao importar."),
  });

  const tables = data?.tables ?? EMPTY_TABLES;

  // Tabela que algum cliente usa vem primeiro: e a que precisa estar correta.
  const ordenadas = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return [...tables]
      .filter((t) => !termo || String(t.tprId).includes(termo) || t.description.toLowerCase().includes(termo))
      .sort((a, b) => {
        if (a.usedByCustomers !== b.usedByCustomers) return a.usedByCustomers ? -1 : 1;
        return b.itemsInCatalog - a.itemsInCatalog;
      });
  }, [tables, search]);

  // O Proxis tem 42 tabelas e a lista inteira nao cabe na tela. Pagina em vez de
  // rolar: o que interessa (as em uso) esta sempre na primeira pagina, pela
  // ordenacao acima.
  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / PAGE_SIZE));
  const paginaAtual = Math.min(page, totalPaginas - 1);
  const visiveis = ordenadas.slice(paginaAtual * PAGE_SIZE, paginaAtual * PAGE_SIZE + PAGE_SIZE);

  const toggle = (tprId: number) =>
    setSelected((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(tprId)) proximo.delete(tprId);
      else proximo.add(tprId);
      return proximo;
    });

  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn(TEXT.label, "text-muted-foreground")}>Tabelas de preço no Proxis</p>
          <p className={cn(TEXT.compact, "mt-1 leading-5 text-muted-foreground")}>
            Lidas direto do ERP. Importar substitui a tabela inteira aqui pelo que está lá.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={cn(TEXT.compact, "h-9 gap-1.5 rounded-full px-3.5")}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Atualizar
          </Button>
          <ConfirmActionDialog
            trigger={
              <Button
                type="button"
                disabled={selected.size === 0 || importar.isPending}
                className={cn(TEXT.compact, "h-9 gap-1.5 rounded-full px-3.5")}
              >
                <Download className="h-3.5 w-3.5" />
                {importar.isPending ? "Importando…" : `Importar ${selected.size || ""}`}
              </Button>
            }
            title="Importar tabelas do Proxis"
            description={`${selected.size} tabela(s) serão substituídas pelo conteúdo do Proxis. Os preços atuais dessas tabelas aqui serão descartados.`}
            confirmLabel="Importar"
            onConfirm={() => importar.mutate([...selected])}
          />
        </div>
      </div>

      {error ? (
        <div className={cn(TEXT.compact, "mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-amber-900")}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Não foi possível ler as tabelas do Proxis: {error instanceof Error ? error.message : "erro desconhecido"}</span>
        </div>
      ) : null}

      {!isLoading && tables.length > 0 ? (
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Buscar por código ou nome da tabela"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            className={cn(TEXT.compact, "h-10 rounded-full border-border/70 bg-background pl-10")}
          />
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : ordenadas.length > 0 ? (
        <div className="mt-3 space-y-2">
          {visiveis.map((table) => {
            const desatualizada = table.importedRows > 0 && table.importedRows !== table.itemsInCatalog;
            return (
              <div
                key={table.tprId}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                  activeTprId === table.tprId
                    ? "border-primary bg-primary/[0.06] ring-1 ring-primary/20"
                    : selected.has(table.tprId)
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/70",
                )}
              >
                {/* Caixa marca para importar; o corpo da linha abre a tabela na
                    lista abaixo. Antes a escolha existia em dois lugares — aqui e
                    num seletor separado — e as duas podiam discordar. */}
                <Checkbox
                  checked={selected.has(table.tprId)}
                  onCheckedChange={() => toggle(table.tprId)}
                  aria-label={`Selecionar tabela ${table.tprId} para importar`}
                  className="mt-0.5 h-4 w-4 border-primary data-[state=checked]:bg-primary"
                />
                <button
                  type="button"
                  onClick={() => onSelectTable?.(table.tprId)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn(TEXT.compact, "font-mono text-muted-foreground")}>{table.tprId}</span>
                    <span className={cn(TEXT.compact, "font-medium text-foreground")}>{table.description}</span>
                    {table.usedByCustomers ? (
                      <Badge className={cn(TEXT.badge, "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800")}>
                        Em uso por clientes
                      </Badge>
                    ) : null}
                    {!table.active ? (
                      <Badge variant="outline" className={cn(TEXT.badge, "rounded-full px-2 py-0.5")}>
                        Inativa no Proxis
                      </Badge>
                    ) : null}
                  </div>

                  <p className={cn(TEXT.caption, "mt-1 text-muted-foreground")}>
                    {table.itemsInProxis} itens nesta tabela ·{" "}
                    <strong className="font-medium text-foreground">{table.itemsInCatalog}</strong> são produtos do
                    catálogo ·{" "}
                    <span title="Existem no ERP, mas esta tabela não define preço para eles. Saem pelo preço de cadastro.">
                      {table.catalogWithoutPrice} do catálogo sem preço aqui
                    </span>
                  </p>

                  <p className={cn(TEXT.caption, "mt-0.5")}>
                    {table.importedRows === 0 ? (
                      <span className="text-amber-700">Nunca importada</span>
                    ) : table.importedZeros > 0 ? (
                      <span className="text-red-700">
                        {table.importedRows} aqui, mas {table.importedZeros} com preço zero — reimporte
                      </span>
                    ) : desatualizada ? (
                      <span className="text-amber-700">{table.importedRows} aqui, {table.itemsInCatalog} no Proxis — desatualizada</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        {table.importedRows} preços em dia
                      </span>
                    )}
                  </p>
                  {activeTprId === table.tprId ? (
                    <p className={cn(TEXT.caption, "mt-1 font-medium text-primary")}>Aberta abaixo</p>
                  ) : null}
                </button>
              </div>
            );
          })}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className={cn(TEXT.caption, "text-muted-foreground")}>
              {ordenadas.length} tabela(s){search.trim() ? " encontradas" : ""} · página {paginaAtual + 1} de {totalPaginas}
              {selected.size > 0 ? ` · ${selected.size} selecionada(s)` : ""}
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                className="h-8 w-8 rounded-full p-0"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={paginaAtual === 0}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 w-8 rounded-full p-0"
                onClick={() => setPage((p) => Math.min(totalPaginas - 1, p + 1))}
                disabled={paginaAtual >= totalPaginas - 1}
                aria-label="Próxima página"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : search.trim() ? (
        <p className={cn(TEXT.compact, "mt-4 text-muted-foreground")}>Nenhuma tabela corresponde à busca.</p>
      ) : null}
    </div>
  );
}
