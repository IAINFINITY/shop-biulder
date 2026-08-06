import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { ImageIcon, Link as LinkIcon, Pencil, Plus, RefreshCw, Trash2, Upload, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { AdminSectionHeader } from "./AdminSectionHeader";
import type { AdminBanner } from "./adminTypes";
import { CATALOG_BANNERS_TABLE } from "@/lib/catalogBanners";
import {
  BANNER_SLOTS,
  descreveAparicoes,
  findBannerSlot,
  slotsDaPagina,
  type BannerPagina,
  type BannerSlot,
  formatEntrega,
  pecasDoSlot,
  totalPecas,
} from "@/lib/bannerSlots";
import { deleteStorageImage, isProductImageStorageUrl, uploadProductImageFile } from "@/lib/productImageStorage";
import { BANNER_IMAGE_MAX_SIZE, BANNER_IMAGE_QUALITY } from "@/lib/productImageNormalization";
import { ADMIN_TEXT_LIMITS } from "@/lib/adminTextLimits";
import { cn } from "@/lib/utils";
import { useCatalogBanners } from "@/hooks/useCatalogBanners";
import { useCustomerTypes } from "@/hooks/useCustomerTypes";
import { MODAL_TELA_CHEIA, MODAL_TELA_CHEIA_CORPO } from "@/lib/modais";

type BannerFormState = {
  id?: string;
  label: string;
  /** Area do site — ver `bannerSlots.ts`. */
  slot: string;
  imageUrl: string;
  /** Arte de celular. So o topo usa; nas outras areas fica vazia. */
  imageUrlMobile: string;
  linkUrl: string;
  sortOrder: string;
  active: boolean;
  visible_to: string[];
};

const DEFAULT_SORT_STEP = 10;
const BANNER_PREVIEW_FRAME_CLASS = "w-full overflow-hidden";
/**
 * Proporcao do quadro de previa.
 *
 * Era `aspect-[4/1]` fixo para todo banner. Com seis areas indo de 16:5 a 21:9,
 * um quadro so mostrava o enquadramento errado em todas elas — justamente o que
 * a previa existe para conferir. Cada area usa a propria.
 */
const previewAspect = (slot: string) => findBannerSlot(slot)?.aspect ?? "aspect-[4/1]";

function getNextSortOrder(banners: AdminBanner[]): string {
  if (banners.length === 0) return "0";
  const maxOrder = Math.max(...banners.map((banner) => banner.sort_order));
  return String(maxOrder + DEFAULT_SORT_STEP);
}

function normalizeLinkUrl(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * As areas de banner do site, com a medida de cada uma.
 *
 * Quem prepara a arte precisava abrir `docs/ESPECIFICACAO-BANNERS.md` para saber
 * o que cabe em cada espaco. A medida agora aparece onde o banner e cadastrado,
 * e sai da mesma lista que a vitrine usa para desenhar o quadro — nao ha como
 * uma mudar sem a outra.
 */
function SlotCard({ slot }: { slot: BannerSlot }) {
  const quadros = pecasDoSlot(slot);

  return (
    <div className="flex flex-col gap-3 rounded-[1.25rem] border border-border/70 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{slot.nome}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {slot.aparicoes.map((a) => a.onde).join(" · ")}
          </p>
        </div>
        {/* A medida e o que a pessoa veio buscar aqui: fica alinhada a direita,
            em bloco proprio, e nao espremida no meio de uma linha de tabela. */}
        <div className="shrink-0 text-right">
          <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-foreground">
            {formatEntrega(slot)}
          </p>
          <p className="text-[0.6875rem] tabular-nums text-muted-foreground">{slot.proporcao}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className="rounded-full border-border/60 px-2 py-0 text-[0.625rem] font-medium text-muted-foreground"
        >
          {quadros === 1 ? "1 quadro" : `${quadros} quadros`}
        </Badge>
        {quadros > 1 ? (
          <Badge
            variant="outline"
            className="rounded-full border-primary/20 bg-primary/5 px-2 py-0 text-[0.625rem] font-medium text-primary"
          >
            artes diferentes em cada
          </Badge>
        ) : null}
        {slot.carrossel ? (
          <Badge
            variant="outline"
            className="rounded-full border-primary/20 bg-primary/5 px-2 py-0 text-[0.625rem] font-medium text-primary"
          >
            gira em carrossel
          </Badge>
        ) : null}
        {slot.sangra ? (
          <Badge
            variant="outline"
            className="rounded-full border-border/60 px-2 py-0 text-[0.625rem] font-medium text-muted-foreground"
          >
            borda a borda
          </Badge>
        ) : null}
      </div>

      {/* A arte de celular nao e uma area a parte — nao se cria nem se remove
          sozinha. E um segundo arquivo dentro deste mesmo banner, com medida
          propria, entao aparece aqui dentro em vez de virar outro cartao. */}
      {slot.arteDeCelular ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-[0.6875rem] leading-snug text-muted-foreground">
            <span className="font-medium text-foreground">Arte de celular</span> (opcional). Sem ela, a de cima é
            cortada no centro.
          </p>
          <p className="shrink-0 text-right text-[0.6875rem] tabular-nums text-muted-foreground">
            <span className="font-medium text-foreground">
              {slot.arteDeCelular.largura} × {slot.arteDeCelular.altura} px
            </span>
            <br />
            {slot.arteDeCelular.proporcao}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * As areas de banner, agrupadas pela pagina em que aparecem.
 *
 * Era uma tabela de cinco colunas com selo, contagem e ressalva empilhados
 * dentro da primeira celula — o Par, que aparece em duas paginas, virava um
 * paragrafo dentro de uma linha. Cartao por area resolve: a medida ganha um
 * bloco proprio, as ressalvas viram selos, e cada pagina abre a propria secao.
 */
function BannerSlotsPanel() {
  const paginas: BannerPagina[] = ["Catálogo", "Produto", "Ajuda"];

  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
      <div className="mb-5 space-y-1">
        <p className="text-sm font-semibold text-foreground">Áreas de banner do site</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Cada área tem uma medida própria. Entregue a arte exatamente no tamanho indicado.
        </p>
      </div>

      <div className="space-y-6">
        {paginas.map((pagina) => {
          const slots = slotsDaPagina(pagina);
          if (slots.length === 0) return null;

          return (
            <section key={pagina}>
              <div className="mb-3 flex items-baseline gap-2 border-b border-border/50 pb-2">
                <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-foreground">
                  {pagina}
                </h3>
                <span className="text-[0.6875rem] tabular-nums text-muted-foreground">
                  {totalPecas(pagina)} {totalPecas(pagina) === 1 ? "peça" : "peças"}
                </span>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {slots.map((slot) => (
                  <SlotCard key={`${pagina}-${slot.id}`} slot={slot} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-6 space-y-2 rounded-xl bg-muted/40 px-4 py-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Por que a medida é maior que o exibido.</span> Arte no
          tamanho exato sai borrada em tela retina — é o mesmo critério da foto de produto, que aparece com ~456px e
          é entregue com 1280px.
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">A arte ocupa o arquivo inteiro.</span> Margem branca
          embutida vira espaço vazio dentro do quadro, e nenhum ajuste de tela resolve.
        </p>
      </div>
    </div>
  );
}

export function AdminBannersSection() {
  const queryClient = useQueryClient();
  const { data: banners = [], isLoading } = useCatalogBanners({ activeOnly: false });
  const { options: customerTypeOptions } = useCustomerTypes();
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<BannerFormState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  const sortedBanners = useMemo(
    () => [...banners].sort((left, right) => left.sort_order - right.sort_order || left.created_at.localeCompare(right.created_at)),
    [banners],
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["catalog-banners"] });
  };

  const openNew = () => {
    setDraft({
      label: "",
      slot: "topo",
      imageUrl: "",
      imageUrlMobile: "",
      linkUrl: "",
      sortOrder: getNextSortOrder(sortedBanners),
      active: true,
      visible_to: [],
    });
    setEditorOpen(true);
  };

  const openEdit = (banner: AdminBanner) => {
    setDraft({
      id: banner.id,
      label: banner.label,
      slot: banner.slot,
      imageUrl: banner.image_url,
      imageUrlMobile: banner.image_url_mobile ?? "",
      linkUrl: banner.link_url ?? "",
      sortOrder: String(banner.sort_order),
      active: banner.active,
      visible_to: banner.visible_to ?? [],
    });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
  };

  /**
   * Arte de celular do banner do topo.
   *
   * A coluna `image_url_mobile` existia no banco desde antes, mas o formulario
   * nunca a preenchia — so um script conseguia. Sem ela a vitrine corta a arte
   * de desktop no centro, e num banner 16:5 reduzido a 5:2 isso costuma comer
   * justamente o texto da campanha.
   */
  const handleMobileFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    // A arte de celular tem medida propria, guardada na propria area.
    const maxSize = findBannerSlot(draft?.slot ?? "topo")?.arteDeCelular?.largura ?? 800;
    const result = await uploadProductImageFile(file, { maxSize, quality: BANNER_IMAGE_QUALITY });
    setUploading(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    const anterior = draft?.imageUrlMobile?.trim();
    if (anterior && isProductImageStorageUrl(anterior)) {
      await deleteStorageImage(anterior);
    }

    setDraft((current) => (current ? { ...current, imageUrlMobile: result.publicUrl } : current));
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    // O teto sai da area escolhida, e nao de um numero unico: a faixa guarda
    // 3840 e o par guarda 1600. Com um teto so, ou as pecas grandes ficavam
    // ampliadas ou as pequenas guardavam o dobro do necessario.
    const maxSize = findBannerSlot(draft?.slot ?? "topo")?.entrega.largura ?? BANNER_IMAGE_MAX_SIZE;
    const result = await uploadProductImageFile(file, { maxSize, quality: BANNER_IMAGE_QUALITY });
    setUploading(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    const previousImage = draft?.imageUrl?.trim();
    if (previousImage && isProductImageStorageUrl(previousImage)) {
      await deleteStorageImage(previousImage);
    }

    setDraft((current) => {
      if (!current) return current;
      return { ...current, imageUrl: result.publicUrl };
    });
    toast.success("Imagem enviada!");
  };

  const saveBanner = async () => {
    if (!draft) return;

    const previousImageUrl = draft.id ? banners.find((banner) => banner.id === draft.id)?.image_url ?? null : null;
    const label = draft.label.trim();
    const imageUrl = draft.imageUrl.trim();
    if (!label || !imageUrl) {
      toast.error("Preencha o nome do banner e a imagem.");
      return;
    }

    const sortOrder = Number.isFinite(Number(draft.sortOrder)) ? Math.trunc(Number(draft.sortOrder)) : 0;
    const slotAtual = findBannerSlot(draft.slot);
    const visibleTo = draft.visible_to.length > 0 ? draft.visible_to.map((t) => t.trim().toLowerCase()) : null;
    const payload = {
      label,
      image_url: imageUrl,
      link_url: normalizeLinkUrl(draft.linkUrl),
      // A ordem vale sempre que a area tem mais de um lugar para a arte cair:
      // no topo ela define a sequencia do carrossel, e no trio e no par define
      // qual arte fica em cada quadro. So area de quadro unico (destaque, faixa)
      // e que nao tem o que ordenar.
      sort_order: slotAtual && (slotAtual.carrossel || pecasDoSlot(slotAtual) > 1) ? sortOrder : 0,
      active: draft.active,
      slot: draft.slot,
      image_url_mobile: slotAtual?.arteDeCelular ? normalizeLinkUrl(draft.imageUrlMobile) : null,
      visible_to: visibleTo,
    };

    setSaving(true);
    // Sem `placement` no payload de proposito.
    //
    // A coluna nao existe no banco — a migration que a cria
    // (20260723120000_catalog_banner_placement.sql) esta entre as pendentes, e o
    // `types.ts` gerado do banco confirma a ausencia. Mandar a coluna fazia o
    // PostgREST recusar a linha inteira, entao nenhum banner salvava. A leitura
    // ja contornava isso em `useCatalogBanners`; a gravacao nao.
    //
    // Omitir tambem continua certo depois que a migration rodar: a coluna nasce
    // com `DEFAULT 'catalog'`, que e exatamente o valor que era enviado aqui.
    const gravar = (dados: typeof payload | Omit<typeof payload, "slot">) =>
      draft.id
        ? supabase.from(CATALOG_BANNERS_TABLE).update(dados).eq("id", draft.id)
        : supabase.from(CATALOG_BANNERS_TABLE).insert(dados);

    let { error } = await gravar(payload);

    // Banco sem a coluna `slot` ainda (migration 20260801120000 pendente): grava
    // o resto em vez de perder o banner inteiro. O PostgREST recusa a linha toda
    // quando uma coluna nao existe — foi assim que a gravacao ficou quebrada por
    // causa de `placement`. Aqui o banner e salvo e a pessoa fica sabendo que a
    // area nao foi guardada, em vez de descobrir depois que tudo virou "Topo".
    let areaNaoGravada = false;
    if (error && /slot/i.test(error.message)) {
      const { slot: _slot, ...semSlot } = payload;
      ({ error } = await gravar(semSlot));
      areaNaoGravada = !error;
    }
    setSaving(false);

    if (error) {
      console.error("Erro ao salvar banner", error);
      toast.error("Erro ao salvar banner.");
      return;
    }

    if (
      draft.id &&
      previousImageUrl &&
      previousImageUrl !== imageUrl &&
      isProductImageStorageUrl(previousImageUrl)
    ) {
      await deleteStorageImage(previousImageUrl);
    }

    if (areaNaoGravada) {
      toast.warning("Banner salvo, mas a área não foi guardada: falta aplicar a migration do campo de área.");
    } else {
      toast.success(draft.id ? "Banner atualizado." : "Banner adicionado.");
    }
    setEditorOpen(false);
    setDraft(null);
    await refresh();
  };

  const deleteBanner = async (id: string) => {
    const banner = banners.find((b) => b.id === id);
    if (banner?.image_url) {
      await deleteStorageImage(banner.image_url);
    }
    // A arte de celular tambem. Antes so a de desktop era apagada — e ate agora
    // isso nao vazava nada, porque o formulario nao tinha como enviar a de
    // celular. Passou a ter, entao o arquivo ficaria orfao no storage.
    if (banner?.image_url_mobile) {
      await deleteStorageImage(banner.image_url_mobile);
    }

    const { error } = await supabase.from(CATALOG_BANNERS_TABLE).delete().eq("id", id);
    if (error) {
      console.error("Erro ao remover banner", error);
      toast.error("Erro ao remover banner.");
      return;
    }
    toast.success("Banner removido.");
    await refresh();
  };

  const toggleActive = async (banner: AdminBanner) => {
    const { error } = await supabase
      .from(CATALOG_BANNERS_TABLE)
      .update({ active: !banner.active })
      .eq("id", banner.id);

    if (error) {
      console.error("Erro ao atualizar banner", error);
      toast.error("Erro ao atualizar banner.");
      return;
    }

    toast.success(banner.active ? "Banner desativado." : "Banner ativado.");
    await refresh();
  };

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Banners"
        title="Banners sob controle do admin"
        description="Cadastre banners para a vitrine principal e confira a medida de cada área."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[0.6875rem] text-primary">
              {sortedBanners.filter((banner) => banner.active).length} ativo(s)
            </Badge>
            <Button type="button" className="h-10 rounded-2xl px-4 text-sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Novo banner
            </Button>
          </div>
        }
      />

      <BannerSlotsPanel />

      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-foreground">Cada área usa apenas seus banners ativos, em ordem crescente.</p>
            <p className="text-xs text-muted-foreground">As imagens podem ser enviadas do computador ou coladas por URL.</p>
          </div>
          <Badge variant="outline" className="rounded-full border-border/70 px-3 py-1 text-[0.6875rem] font-medium">
            {sortedBanners.length} banner(s)
          </Badge>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-[1.25rem] border border-border/70 bg-muted/20" />
            ))}
          </div>
        ) : sortedBanners.length === 0 ? (
          <div className="rounded-[1.25rem] border border-dashed border-border/70 p-8 text-center text-muted-foreground">
            Nenhum banner cadastrado ainda.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedBanners.map((banner) => (
              <div
                key={banner.id}
                className={cn(
                  "overflow-hidden rounded-[1.35rem] border border-border/70 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
                  !banner.active && "opacity-70",
                )}
              >
                {/* A area vem antes da arte: e o que diz onde aquele banner cai
                    na pagina, e com seis areas o nome do banner sozinho nao
                    responde mais isso. */}
                <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                  <span className="truncate text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {findBannerSlot(banner.slot)?.nome ?? banner.slot}
                  </span>
                  <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground/70">
                    {(() => {
                      const slot = findBannerSlot(banner.slot);
                      return slot ? formatEntrega(slot) : "";
                    })()}
                  </span>
                </div>
                <div className={cn(BANNER_PREVIEW_FRAME_CLASS, previewAspect(banner.slot), !banner.image_url && "bg-muted/20")}>
                  {banner.image_url ? (
                    <img src={banner.image_url} alt={banner.label} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{banner.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ordem {banner.sort_order}{banner.link_url ? " • com link" : " • sem link"}
                      </p>
                    </div>
                    <Badge variant={banner.active ? "secondary" : "outline"} className="rounded-full px-2.5 py-0.5 text-[0.6875rem]">
                      {banner.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>

                  {banner.link_url ? (
                    <div className="flex items-center gap-2 rounded-[1rem] border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      <LinkIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{banner.link_url}</span>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 sm:h-9 rounded-full px-3 text-[0.8125rem] sm:text-xs"
                      onClick={() => openEdit(banner)}
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 sm:h-9 rounded-full px-3 text-[0.8125rem] sm:text-xs"
                      onClick={() => toggleActive(banner)}
                    >
                      <RefreshCw className="h-4 w-4" />
                      {banner.active ? "Desativar" : "Ativar"}
                    </Button>

                    <ConfirmActionDialog
                      trigger={
                        <Button type="button" variant="outline" className="h-10 sm:h-9 rounded-full px-3 text-xs text-destructive">
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      }
                      title="Excluir banner"
                      description={`Deseja excluir "${banner.label}"? O banner sairá do catálogo imediatamente.`}
                      confirmLabel="Excluir"
                      destructive
                      onConfirm={() => deleteBanner(banner.id)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={editorOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeEditor();
        }}
      >
        <DialogContent className={cn(MODAL_TELA_CHEIA, "max-h-[92dvh] w-[min(98vw,1120px)] max-w-[1120px] overflow-hidden rounded-[1.75rem] border-border/70 p-0")}>
          <div className={cn("flex max-h-[92dvh] flex-col overflow-hidden", MODAL_TELA_CHEIA_CORPO)}>
            <DialogHeader className="border-b border-border/70 px-5 py-4">
              <DialogTitle className="text-left text-lg font-semibold tracking-tight text-foreground">
                {draft?.id ? "Editar banner" : "Novo banner"}
              </DialogTitle>
              <DialogDescription className="text-left text-[0.8125rem] text-muted-foreground">
                Ajuste o conteúdo visual e escolha em qual área ele será exibido.
              </DialogDescription>
            </DialogHeader>

            {/* Uma rolagem so no celular.

                  Em duas colunas (lg) cada lado rola por conta propria, que e o
                  certo: formulario de um lado, previa do outro, os dois sempre a
                  vista. Empilhados numa coluna, porem, viravam **duas** areas de
                  rolagem dividindo a mesma altura — e a previa ainda reservava
                  320px de piso, entao ela tomava a tela e o formulario ficava
                  numa fresta. Aqui embaixo quem rola e o container, e a previa
                  vem depois do formulario, no fluxo. */}
              <div className="grid min-h-0 flex-1 gap-0 max-lg:overflow-y-auto lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="min-h-0 p-4 sm:p-5 lg:overflow-y-auto">
                {draft ? (
                  <div className="space-y-4 rounded-[1.5rem] border border-border/70 bg-background p-4 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
                    {/* Primeiro campo do formulario de proposito: a area decide a
                        medida da arte, se ha ordem e se ha arte de celular. Escolher
                        depois de enviar a imagem seria descobrir tarde demais que o
                        arquivo tem a proporcao errada. */}
                    <div className="space-y-2">
                      <Label className="text-[0.8125rem] font-medium">Área do site</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {BANNER_SLOTS.map((slot) => {
                          const ativo = draft.slot === slot.id;
                          const quadros = pecasDoSlot(slot);
                          // So o que ja esta salvo. Antes eu descontava tambem o
                          // rascunho aberto, entao o numero caia de 3 para 2 no
                          // instante em que a area era escolhida e voltava para 3
                          // ao escolher outra — parecia defeito, e o banner nem
                          // tinha sido salvo ainda.
                          const jaCadastradas = sortedBanners.filter((banner) => banner.slot === slot.id).length;
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => setDraft((current) => (current ? { ...current, slot: slot.id } : current))}
                              aria-pressed={ativo}
                              className={cn(
                                "flex flex-col gap-0.5 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                                ativo
                                  ? "border-primary/40 bg-primary/[0.07]"
                                  : "border-border/70 bg-background hover:border-primary/25 hover:bg-primary/[0.03]",
                              )}
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span
                                  className={cn(
                                    "text-[0.8125rem] font-medium",
                                    ativo ? "text-primary" : "text-foreground",
                                  )}
                                >
                                  {slot.nome}
                                </span>
                                <span
                                  className={cn(
                                    "shrink-0 text-[0.6875rem] tabular-nums",
                                    ativo ? "text-primary/70" : "text-muted-foreground",
                                  )}
                                >
                                  {formatEntrega(slot)}
                                </span>
                              </span>
                              <span className="text-[0.6875rem] leading-snug text-muted-foreground">
                                {quadros > 1 ? `${quadros} quadros, artes diferentes · ` : ""}
                                {slot.carrossel ? "carrossel · " : ""}
                                {descreveAparicoes(slot)}
                              </span>
                              {quadros > 1 ? (
                                <span
                                  className={cn(
                                    "text-[0.6875rem] font-medium",
                                    jaCadastradas >= quadros ? "text-success" : "text-warm",
                                  )}
                                >
                                  {jaCadastradas} de {quadros} artes cadastradas
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="banner-label" className="text-[0.8125rem] font-medium">
                          Nome do banner
                        </Label>
                        <p className="text-[0.6875rem] text-muted-foreground">
                          {draft.label.length}/{ADMIN_TEXT_LIMITS.banners.label} caracteres
                        </p>
                      </div>
                      <Input
                        id="banner-label"
                        placeholder="Ex: Promoção de verão"
                        value={draft.label}
                        onChange={(e) => setDraft((current) => (current ? { ...current, label: e.target.value } : current))}
                        maxLength={ADMIN_TEXT_LIMITS.banners.label}
                        className="h-11 rounded-2xl border-border/70 bg-background"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="banner-image-url" className="text-[0.8125rem] font-medium">
                          Imagem
                        </Label>
                        <p className="text-[0.6875rem] tabular-nums text-muted-foreground">
                          {(() => {
                            const slot = findBannerSlot(draft.slot);
                            return slot ? `${formatEntrega(slot)} · ${slot.proporcao}` : "";
                          })()}
                        </p>
                      </div>
                      {/* A medida aparece ao lado do rotulo, e nao numa frase
                          embaixo do campo: e a informacao que a pessoa precisa
                          antes de escolher o arquivo, nao depois. */}
                      <Input
                        id="banner-image-url"
                        placeholder="Cole a URL da imagem ou envie um arquivo"
                        value={draft.imageUrl}
                        onChange={(e) => setDraft((current) => (current ? { ...current, imageUrl: e.target.value } : current))}
                        className="h-11 rounded-2xl border-border/70 bg-background"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 rounded-2xl px-4 text-sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          <Upload className="h-4 w-4" />
                          {uploading ? "Enviando..." : "Enviar imagem"}
                        </Button>
                        {draft.imageUrl ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-10 rounded-2xl px-4 text-sm text-destructive"
                            disabled={uploading}
                            onClick={async () => {
                              const currentImage = draft.imageUrl.trim();
                              if (currentImage && isProductImageStorageUrl(currentImage)) {
                                const result = await deleteStorageImage(currentImage);
                                if (!result.ok) {
                                  toast.error(result.message);
                                  return;
                                }
                              }
                              setDraft((current) => (current ? { ...current, imageUrl: "" } : current));
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Remover imagem
                          </Button>
                        ) : null}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </div>
                    </div>

                    {findBannerSlot(draft.slot)?.arteDeCelular ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="banner-image-mobile" className="text-[0.8125rem] font-medium">
                            Arte de celular
                          </Label>
                          <p className="text-[0.6875rem] tabular-nums text-muted-foreground">
                            {(() => {
                              const arte = findBannerSlot(draft.slot)?.arteDeCelular;
                              return arte ? `${arte.largura} × ${arte.altura} px · ${arte.proporcao}` : "";
                            })()}
                          </p>
                        </div>
                        <Input
                          id="banner-image-mobile"
                          placeholder="Opcional — sem ela, a arte de desktop é cortada no centro"
                          value={draft.imageUrlMobile}
                          onChange={(e) =>
                            setDraft((current) => (current ? { ...current, imageUrlMobile: e.target.value } : current))
                          }
                          className="h-11 rounded-2xl border-border/70 bg-background"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-2xl px-4 text-sm"
                            onClick={() => mobileFileInputRef.current?.click()}
                            disabled={uploading}
                          >
                            <Upload className="h-4 w-4" />
                            {uploading ? "Enviando..." : "Enviar arte de celular"}
                          </Button>
                          {draft.imageUrlMobile ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-10 rounded-2xl px-4 text-sm text-destructive"
                              disabled={uploading}
                              onClick={async () => {
                                const atual = draft.imageUrlMobile.trim();
                                if (atual && isProductImageStorageUrl(atual)) {
                                  const result = await deleteStorageImage(atual);
                                  if (!result.ok) return;
                                }
                                setDraft((current) => (current ? { ...current, imageUrlMobile: "" } : current));
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Remover
                            </Button>
                          ) : null}
                          <input
                            ref={mobileFileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleMobileFileChange}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="banner-link-url" className="text-[0.8125rem] font-medium">
                          Link do banner
                        </Label>
                        <p className="text-[0.6875rem] text-muted-foreground">
                          {draft.linkUrl.length}/{ADMIN_TEXT_LIMITS.banners.linkUrl} caracteres
                        </p>
                      </div>
                      <Input
                        id="banner-link-url"
                        placeholder="Ex: /produto/123 ou https://..."
                        value={draft.linkUrl}
                        onChange={(e) => setDraft((current) => (current ? { ...current, linkUrl: e.target.value } : current))}
                        maxLength={ADMIN_TEXT_LIMITS.banners.linkUrl}
                        className="h-11 rounded-2xl border-border/70 bg-background"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Tres situacoes diferentes, e nao duas:
                          - topo: um quadro, varias artes girando em carrossel;
                          - trio e par: varios quadros, uma arte em cada;
                          - destaque e faixa: um quadro e uma arte.
                          Antes o formulario tratava tudo que nao fosse carrossel
                          como quadro unico, e dizia que as demais artes seriam
                          ignoradas — o que e falso no trio, onde as 3 aparecem. */}
                      {(() => {
                        const slot = findBannerSlot(draft.slot);
                        const quadros = slot ? pecasDoSlot(slot) : 1;
                        const temOrdem = Boolean(slot?.carrossel) || quadros > 1;

                        if (!temOrdem) {
                          return (
                            <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-muted/20 px-4 py-3">
                              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Quadro único
                              </p>
                              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                                Uma arte só. Havendo mais de uma ativa, a vitrine usa a primeira.
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <Label htmlFor="banner-sort" className="text-[0.8125rem] font-medium">
                                {slot?.carrossel ? "Ordem no carrossel" : "Posição no bloco"}
                              </Label>
                              <p className="text-[0.6875rem] text-muted-foreground">menor aparece antes</p>
                            </div>
                            <Input
                              id="banner-sort"
                              type="number"
                              value={draft.sortOrder}
                              onChange={(e) => setDraft((current) => (current ? { ...current, sortOrder: e.target.value } : current))}
                              className="h-11 rounded-2xl border-border/70 bg-background"
                            />
                            <p className="text-[0.6875rem] leading-snug text-muted-foreground">
                              {slot?.carrossel
                                ? "As artes desta área giram em carrossel, nesta ordem."
                                : `Esta área tem ${quadros} quadros lado a lado, e cada um recebe uma arte diferente. Cadastre ${quadros} banners aqui; os que faltarem aparecem como exemplo.`}
                            </p>
                          </div>
                        );
                      })()}

                      <div className="flex items-center justify-between rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3">
                        <div>
                          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Banner ativo
                          </p>
                          <p className="text-sm text-foreground">Exibir no catálogo</p>
                        </div>
                        <Switch
                          checked={draft.active}
                          onCheckedChange={(checked) =>
                            setDraft((current) => (current ? { ...current, active: checked } : current))
                          }
                        />
                      </div>
                    </div>

                    <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Visível para
                          </p>
                          <p className="text-sm text-foreground">Selecione quais tipos de cliente podem ver este banner. Se nenhum for marcado, fica visível para todos.</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-4">
                        {customerTypeOptions.map((type) => {
                          const checked = draft.visible_to.includes(type.name);
                          return (
                            <label key={type.name} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(checkedState) => {
                                  const isChecked = checkedState === true;
                                  setDraft((current) =>
                                    current
                                      ? {
                                          ...current,
                                          visible_to: isChecked
                                            ? [...current.visible_to, type.name]
                                            : current.visible_to.filter((t) => t !== type.name),
                                        }
                                      : current,
                                  );
                                }}
                                className="h-4 w-4 border-primary data-[state=checked]:bg-primary"
                              />
                              {type.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 border-t border-border/70 bg-muted/15 p-4 sm:p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
                <div className="flex h-full flex-col gap-4 lg:min-h-[320px]">
                  <div className="space-y-1">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Pré-visualização
                    </p>
                    <p className="text-sm text-foreground/80">
                      Veja como o banner fica antes de salvar.
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
                    {draft?.imageUrl ? (
                      <div className={cn(BANNER_PREVIEW_FRAME_CLASS, previewAspect(draft?.slot ?? "topo"), !draft?.imageUrl && "bg-muted/20")}>
                        <img src={draft.imageUrl} alt={draft.label || "Banner"} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className={cn(BANNER_PREVIEW_FRAME_CLASS, "flex items-center justify-center bg-muted/20")}>
                        <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="space-y-2 p-4">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary">
                        {draft?.active ? "Ativo" : "Inativo"}
                      </p>
                      <p className="text-lg font-semibold text-foreground">{draft?.label || "Nome do banner"}</p>
                      <p className="text-sm text-muted-foreground">
                        {draft?.linkUrl?.trim() ? draft.linkUrl : "Sem link configurado"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 border-t border-border/70 bg-background px-5 py-4 sm:gap-2">
              <Button type="button" variant="outline" className="h-11 rounded-2xl px-5 text-sm" onClick={closeEditor} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" className="h-11 rounded-2xl px-5 text-sm" onClick={saveBanner} disabled={saving}>
                {saving ? "Salvando..." : "Salvar banner"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

