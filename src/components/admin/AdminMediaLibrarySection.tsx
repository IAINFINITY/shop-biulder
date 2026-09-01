import { useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image as ImageIcon, ImageOff, Layers, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { supabase } from "@/integrations/supabase/client";
import { deleteStorageImage } from "@/lib/productImageStorage";
import { getProductImageUrls, type Product } from "@/lib/products";
import { useCatalogBanners } from "@/hooks/useCatalogBanners";
import { useCatalogNotifications } from "@/hooks/useCatalogNotifications";
import {
  classifyMediaFiles,
  formatBytes,
  summarizeMediaFiles,
  type ClassifiedMediaFile,
  type MediaStatus,
  type UsageSource,
} from "@/lib/mediaLibrary";
import { TEXT } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { AdminPaginacao } from "./AdminPaginacao";
import { ITENS_POR_PAGINA_EM_GRADE, paginar } from "@/lib/paginacao";

const BUCKET = "product-images";

type StorageListItem = {
  id: string | null;
  name: string;
  created_at: string | null;
  metadata?: { size?: number } | null;
};

async function listBucketFiles(path = ""): Promise<
  { name: string; publicUrl: string; sizeBytes: number | null; createdAt: string | null }[]
> {
  const collected: { name: string; publicUrl: string; sizeBytes: number | null; createdAt: string | null }[] = [];
  const pageSize = 100;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage.from(BUCKET).list(path, { limit: pageSize, offset });
    if (error) throw error;

    const page = ((data ?? []) as StorageListItem[]).filter((item) => typeof item.name === "string" && item.name.trim().length > 0);
    if (page.length === 0) break;

    for (const item of page) {
      if (item.id === null) {
        const nestedPath = path ? `${path}/${item.name}` : item.name;
        const nested = await listBucketFiles(nestedPath);
        collected.push(...nested);
        continue;
      }

      const fullPath = path ? `${path}/${item.name}` : item.name;
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(fullPath);
      collected.push({
        name: fullPath,
        publicUrl,
        sizeBytes: typeof item.metadata?.size === "number" ? (item.metadata.size as number) : null,
        createdAt: item.created_at ?? null,
      });
    }

    if (page.length < pageSize) break;
  }

  return collected;
}

/**
 * Os tres estados sao filtro e legenda ao mesmo tempo.
 *
 * "Sem uso" sozinho nao dizia o que fazer: um arquivo pode nao aparecer na loja
 * porque e sobra de verdade, ou porque e o original de uma foto reenquadrada —
 * e nesse segundo caso ele e visualmente identico ao que esta no ar, o que fazia
 * o aviso parecer erro do sistema.
 */
const STATUS_META: Record<MediaStatus, { label: string; help: string; tone: string }> = {
  "em-uso": {
    label: "Em uso",
    help: "Aparecem na loja agora, em produto, banner ou aviso.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  substituida: {
    label: "Versão antiga",
    help: "Foto original de um produto que já foi reenquadrada. A versão nova é a que está no ar — estas podem ser apagadas.",
    tone: "border-sky-200 bg-sky-50 text-sky-800",
  },
  "sem-uso": {
    label: "Sem uso",
    help: "Não aparecem em lugar nenhum. Costumam sobrar de troca de foto ou produto excluído.",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
  },
};

const FILTERS: { key: MediaStatus | "todas"; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "em-uso", label: STATUS_META["em-uso"].label },
  { key: "substituida", label: STATUS_META.substituida.label },
  { key: "sem-uso", label: STATUS_META["sem-uso"].label },
];

type Props = {
  products: Product[];
};

export function AdminMediaLibrarySection({ products }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MediaStatus | "todas">("todas");
  const [isCleaning, setIsCleaning] = useState(false);

  const { data: banners = [] } = useCatalogBanners();
  const { data: notifications = [] } = useCatalogNotifications();

  const {
    data: files = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-media-library"],
    staleTime: 60_000,
    queryFn: async () => {
      return listBucketFiles("");
    },
  });

  const sources = useMemo<UsageSource[]>(() => {
    const list: UsageSource[] = products.map((product) => ({
      kind: "produto",
      label: product.name,
      urls: getProductImageUrls(product),
    }));

    for (const banner of banners) {
      list.push({ kind: "banner", label: banner.label || "Banner", urls: [banner.image_url] });
    }
    for (const notification of notifications) {
      list.push({ kind: "notificacao", label: notification.title || "Aviso", urls: [notification.image_url] });
    }

    return list;
  }, [products, banners, notifications]);

  const classified = useMemo(() => classifyMediaFiles(files, sources, BUCKET), [files, sources]);
  const totals = useMemo(() => summarizeMediaFiles(classified), [classified]);

  const [pagina, setPagina] = useState(0);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtrados = classified.filter((file) => {
      if (statusFilter !== "todas" && file.status !== statusFilter) return false;
      if (!term) return true;
      return (
        file.name.toLowerCase().includes(term) ||
        file.usedBy.some((usage) => usage.label.toLowerCase().includes(term))
      );
    });

    /**
     * Ordem de chegada, do mais novo para o mais antigo.
     *
     * O `storage.list()` nao recebia `sortBy`, entao vinha o padrao do Supabase:
     * nome em ordem alfabetica. Depois que as fotos passaram a se chamar pelo
     * codigo do produto, isso virou "ordem por codigo" — quem acabou de enviar
     * um arquivo tinha de garimpar onde ele caiu no meio da lista.
     *
     * Mais novo primeiro, e nao mais antigo: numa biblioteca de midia quem abre
     * a tela quase sempre quer ver o que acabou de subir.
     *
     * Arquivo sem data cai para o fim e desempata por nome, para a ordem nao
     * mudar a cada carregamento.
     */
    return filtrados.sort((esquerda, direita) => {
      const a = esquerda.createdAt ? Date.parse(esquerda.createdAt) : NaN;
      const b = direita.createdAt ? Date.parse(direita.createdAt) : NaN;
      const temA = Number.isFinite(a);
      const temB = Number.isFinite(b);
      if (temA && temB && a !== b) return b - a;
      if (temA !== temB) return temA ? -1 : 1;
      return esquerda.name.localeCompare(direita.name, "pt-BR");
    });
  }, [classified, statusFilter, search]);

  /**
   * A biblioteca desenhava todos os arquivos numa grade só.
   *
   * São 5 colunas; com algumas centenas de imagens o navegador monta tudo de uma
   * vez e a rolagem fica longa demais para achar qualquer coisa. Mesma regra de
   * Produtos e Pedidos, com a mesma função.
   */
  const paginaDeArquivos = useMemo(() => paginar(visible, pagina, ITENS_POR_PAGINA_EM_GRADE), [visible, pagina]);

  const removable = useMemo(
    () => classified.filter((file) => file.status === "substituida"),
    [classified],
  );

  /**
   * Selecao por nome do arquivo, e nao por URL.
   *
   * A mesma imagem aparece ora com query de cache, ora com escape diferente na
   * URL — comparar URL inteira faria o mesmo arquivo entrar duas vezes.
   */
  const [selecionadas, setSelecionadas] = useState<ReadonlySet<string>>(() => new Set());

  const alternar = (nome: string) => {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(nome)) proximo.delete(nome);
      else proximo.add(nome);
      return proximo;
    });
  };

  const visiveisSelecionadas = visible.filter((file) => selecionadas.has(file.name));
  const todasVisiveisMarcadas = visible.length > 0 && visiveisSelecionadas.length === visible.length;

  const alternarTodas = () => {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (todasVisiveisMarcadas) visible.forEach((file) => proximo.delete(file.name));
      else visible.forEach((file) => proximo.add(file.name));
      return proximo;
    });
  };

  const emUsoSelecionadas = visiveisSelecionadas.filter((file) => file.usedBy.length > 0);

  const apagarSelecionadas = async () => {
    setIsCleaning(true);
    let apagadas = 0;
    let falhas = 0;
    for (const file of visiveisSelecionadas) {
      const result = await deleteStorageImage(file.publicUrl);
      if (result.ok) apagadas += 1;
      else falhas += 1;
    }
    setIsCleaning(false);
    setSelecionadas(new Set());
    await refetch();
    if (falhas > 0) toast.warning(`${apagadas} apagada(s), ${falhas} falhou/falharam.`);
    else toast.success(`${apagadas} arquivo(s) apagado(s).`);
  };

  const removeFile = async (file: ClassifiedMediaFile) => {
    const result = await deleteStorageImage(file.publicUrl);
    if (!result.ok) {
      toast.error(`Não foi possível remover: ${result.message}`);
      return;
    }
    toast.success("Arquivo removido.");
    await refetch();
  };

  const removeAllReplaced = async () => {
    setIsCleaning(true);
    let removed = 0;
    let failed = 0;
    for (const file of removable) {
      const result = await deleteStorageImage(file.publicUrl);
      if (result.ok) removed += 1;
      else failed += 1;
    }
    setIsCleaning(false);
    await refetch();
    if (failed > 0) toast.warning(`${removed} removida(s), ${failed} falhou/falharam.`);
    else toast.success(`${removed} versão(ões) antiga(s) removida(s).`);
  };

  return (
    <div className="space-y-6">
      {/* Ver a nota em AdminBulkImagesSection: o cabeçalho é da seção, não da aba. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Tudo que já foi enviado, com o lugar da loja onde cada arquivo aparece.
        </p>
        <Badge variant="outline" className={cn(TEXT.caption, "rounded-full border-border/70 bg-background px-3 py-1")}>
          {totals.total.count} arquivo(s) · {formatBytes(totals.total.bytes)}
        </Badge>
      </div>

      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Buscar pelo nome do arquivo ou do produto"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={cn(TEXT.compact, "h-11 rounded-full border-border/70 bg-background pl-10")}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const count = filter.key === "todas" ? totals.total.count : totals[filter.key].count;
            const isActive = statusFilter === filter.key;
            return (
              <Button
                key={filter.key}
                type="button"
                variant={isActive ? "default" : "outline"}
                className={cn(TEXT.compact, "h-10 sm:h-9 gap-2 rounded-full px-3.5")}
                onClick={() => setStatusFilter(filter.key)}
              >
                {filter.label}
                <Badge variant="secondary" className={cn(TEXT.badge, "rounded-full px-1.5 py-0 leading-none")}>
                  {count}
                </Badge>
              </Button>
            );
          })}
        </div>

        {visible.length > 0 ? (
          <button
            type="button"
            onClick={alternarTodas}
            className={cn(TEXT.caption, "mt-3 font-medium text-primary transition-colors hover:text-primary/80")}
          >
            {todasVisiveisMarcadas ? "Desmarcar todos" : `Selecionar os ${visible.length} visíveis`}
          </button>
        ) : null}

        {statusFilter !== "todas" ? (
          <p className={cn(TEXT.caption, "mt-3 leading-5 text-muted-foreground")}>
            {STATUS_META[statusFilter].help}
          </p>
        ) : null}

        {/* Barra de selecao. Aparece so quando ha algo marcado, para nao ocupar
            espaco no uso normal da tela. */}
        {visiveisSelecionadas.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] px-4 py-3">
            <div className="min-w-0">
              <p className={cn(TEXT.compact, "font-medium leading-5 text-foreground")}>
                {visiveisSelecionadas.length} arquivo(s) selecionado(s)
              </p>
              {emUsoSelecionadas.length > 0 ? (
                <p className={cn(TEXT.caption, "mt-0.5 leading-4 text-warm")}>
                  {emUsoSelecionadas.length} está(ão) em uso na loja e vai(ão) sumir de onde aparece(m).
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className={cn(TEXT.compact, "h-10 sm:h-9 rounded-full px-3")}
                onClick={() => setSelecionadas(new Set())}
              >
                Limpar seleção
              </Button>
              <ConfirmActionDialog
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isCleaning}
                    className={cn(TEXT.compact, "h-10 sm:h-9 gap-1.5 rounded-full border-destructive/30 px-4 text-destructive")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isCleaning ? "Apagando…" : "Apagar selecionados"}
                  </Button>
                }
                title={`Apagar ${visiveisSelecionadas.length} arquivo(s)`}
                description={
                  emUsoSelecionadas.length > 0
                    ? `${emUsoSelecionadas.length} dos arquivos selecionados aparece(m) na loja agora. Apagar vai deixar o produto, banner ou aviso sem essa imagem. A ação é permanente.`
                    : "Nenhum dos arquivos selecionados aparece na loja. A ação é permanente."
                }
                confirmLabel="Apagar"
                destructive
                onConfirm={apagarSelecionadas}
              />
            </div>
          </div>
        ) : null}

        {removable.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50/60 px-4 py-3">
            <p className={cn(TEXT.compact, "leading-5 text-sky-900")}>
              <Layers className="mr-1.5 inline h-3.5 w-3.5" />
              {removable.length} foto(s) na versão antiga ocupando {formatBytes(totals.substituida.bytes)}. A versão
              nova de cada uma já está no ar.
            </p>
            <ConfirmActionDialog
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  disabled={isCleaning}
                  className={cn(TEXT.compact, "h-10 sm:h-9 gap-1.5 rounded-full border-sky-300 bg-background px-4 text-sky-900")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isCleaning ? "Removendo…" : "Apagar as versões antigas"}
                </Button>
              }
              title="Apagar as versões antigas"
              description={`${removable.length} arquivo(s) serão apagados. São as fotos originais dos produtos que já foram reenquadradas — a versão que aparece na loja não é afetada. A ação é permanente.`}
              confirmLabel="Apagar"
              destructive
              onConfirm={removeAllReplaced}
            />
          </div>
        ) : null}

        {isError ? (
          <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <p className="font-medium">Não consegui ler o bucket `product-images`.</p>
            <p className="mt-1 text-destructive/80">
              {error instanceof Error ? error.message : "O Storage retornou erro ao listar os arquivos."}
            </p>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/5] rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-background px-6 py-14 text-center">
          <ImageOff className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className={cn(TEXT.bodyStrong, "mt-3 text-foreground")}>Nenhum arquivo encontrado</p>
          <p className={cn(TEXT.compact, "mt-1 text-muted-foreground")}>
            {search.trim() ? "Nada corresponde à busca." : "Não há arquivos neste filtro."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {paginaDeArquivos.itens.map((file) => {
            const meta = STATUS_META[file.status];
            return (
              <div
                key={file.name}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-background shadow-sm transition-colors",
                  selecionadas.has(file.name) ? "border-primary ring-1 ring-primary/30" : "border-border/70",
                )}
              >
                {/* A miniatura inteira alterna a selecao: alvo pequeno demais
                    obrigaria a mirar na caixinha para marcar dezenas de arquivos. */}
                <button
                  type="button"
                  onClick={() => alternar(file.name)}
                  aria-pressed={selecionadas.has(file.name)}
                  aria-label={`Selecionar ${file.name}`}
                  className="relative block aspect-[4/5] w-full bg-muted/20 text-left"
                >
                  {/* Sem `loading="lazy"`.
                      Com a lista paginada em 24, a preguiça deixou de pagar: o
                      navegador não refaz a busca de uma imagem cuja `src` troca
                      enquanto ela está fora da vista, e a última do grid ficava
                      em branco ao mudar de página. A `key` no `src` garante um
                      elemento novo a cada troca, em vez de reaproveitar um que o
                      navegador considera resolvido. */}
                  <img
                    key={file.publicUrl}
                    src={file.publicUrl}
                    alt=""
                    decoding="async"
                    className="h-full w-full object-contain p-1.5"
                  />
                  <Badge className={cn(TEXT.badge, "absolute left-2 top-2 rounded-full border px-2 py-0.5", meta.tone)}>
                    {meta.label}
                  </Badge>
                  <span className="absolute right-2 top-2 rounded-md bg-background/90 p-0.5 shadow-sm">
                    <Checkbox checked={selecionadas.has(file.name)} aria-hidden tabIndex={-1} />
                  </span>
                </button>

                {/* Altura fixa no rodapé do cartão.
                    O nome do produto ocupa uma ou duas linhas conforme o
                    tamanho, então as linhas da grade tinham alturas diferentes e
                    a página inteira mudava de altura ao paginar — a rolagem
                    escorregava sozinha, mesmo sem ninguém mandar rolar. Com
                    `min-h` o cartão tem sempre a mesma medida. */}
                <div className="min-h-[4.75rem] space-y-1.5 border-t border-border/70 p-2.5">
                  <p className={cn(TEXT.caption, "truncate text-muted-foreground")}>{formatBytes(file.sizeBytes)}</p>

                  {file.usedBy.length > 0 ? (
                    <p
                      className={cn(TEXT.caption, "line-clamp-2 leading-4 text-foreground")}
                      title={file.usedBy.map((usage) => `${usage.kind}: ${usage.label}`).join("\n")}
                    >
                      <ImageIcon className="mr-1 inline h-3 w-3 text-muted-foreground" />
                      {file.usedBy[0].label}
                      {file.usedBy.length > 1 ? ` +${file.usedBy.length - 1}` : ""}
                    </p>
                  ) : (
                    <ConfirmActionDialog
                      trigger={
                        <Button
                          type="button"
                          variant="ghost"
                          className={cn(TEXT.caption, "h-10 sm:h-8 w-full gap-1 rounded-full px-2 text-destructive")}
                        >
                          <Trash2 className="h-3 w-3" />
                          Apagar
                        </Button>
                      }
                      title="Apagar arquivo"
                      description={
                        file.status === "substituida"
                          ? "Esta é a versão antiga de uma foto que já foi reenquadrada. A que aparece na loja não é afetada. A ação é permanente."
                          : "Este arquivo não aparece em nenhum produto, banner ou aviso. A ação é permanente."
                      }
                      confirmLabel="Apagar"
                      destructive
                      onConfirm={() => removeFile(file)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AdminPaginacao pagina={paginaDeArquivos} onMudarPagina={setPagina} />
    </div>
  );
}
