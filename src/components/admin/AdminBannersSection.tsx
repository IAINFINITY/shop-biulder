import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { ImageIcon, Link as LinkIcon, Pencil, Plus, RefreshCw, Trash2, Upload, Users, Eye, Search } from "lucide-react";
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
import { SectionHeader } from "@/components/shared/SectionHeader";
import type { AdminBanner } from "./adminTypes";
import { CATALOG_BANNERS_TABLE, nomeDoArquivoDeBanner } from "@/lib/catalogBanners";
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
import { CARTAO_CLICAVEL, IMAGEM_DO_CARTAO } from "@/lib/interacoes";
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
    // ⚠️ Sem `CARTAO_CLICAVEL` aqui. Este cartão **explica** onde cada área
    // aparece na loja; ele não abre nada. Hover num cartão que não leva a lugar
    // nenhum promete um clique que não existe — ver a nota em `interacoes.ts`.
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
  const [previaAberta, setPreviaAberta] = useState(false);
  const [busca, setBusca] = useState("");

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<BannerFormState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  const sortedBanners = useMemo(
    () => [...banners].sort((left, right) => left.sort_order - right.sort_order || left.created_at.localeCompare(right.created_at)),
    [banners],
  );

  /**
   * A lista com a busca aplicada.
   *
   * Sem ela, achar um banner era rolar a grade inteira — e o nome de arquivo
   * ("Whey Concentrado + Crea_Banner") não é o que a pessoa lembra. A busca
   * cobre também a área do site, que é como se pensa a peça: "o do topo".
   */
  const bannersFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return sortedBanners;
    return sortedBanners.filter((banner) => {
      const area = findBannerSlot(banner.slot)?.nome ?? banner.slot;
      return `${banner.label} ${area}`.toLowerCase().includes(termo);
    });
  }, [sortedBanners, busca]);

  /**
   * Os banners agrupados por area.
   *
   * A lista era uma grade unica ordenada so por `sort_order`, e isso misturava
   * areas na mesma linha. Tres coisas saiam tortas de uma vez:
   *
   * 1. **Alturas diferentes lado a lado.** Cada area tem a propria proporcao —
   *    o topo e 16:5, o par e 5:2, o trio e 16:9. Numa linha com topo e trio
   *    juntos as imagens tinham alturas bem distintas, e a linha parecia
   *    desalinhada mesmo estando correta.
   * 2. **A ordem nao se explicava.** `sort_order` so significa alguma coisa
   *    *dentro* de uma area: "ordem 11" ao lado de "ordem 21" de outra area
   *    sugere uma sequencia que nao existe.
   * 3. A frase no topo da tela diz "cada area usa apenas seus banners ativos",
   *    mas nada na tela mostrava as areas separadas.
   *
   * Agrupando, os cartoes de um grupo compartilham a mesma proporcao e se
   * alinham sozinhos — o problema 1 sai de graca.
   *
   * Area desconhecida (linha antiga, ou `slot` que saiu de `BANNER_SLOTS`) nao
   * pode sumir da tela: um banner invisivel no painel continuaria aparecendo no
   * site sem ninguem conseguir desliga-lo. Ela vai para o fim, com o nome cru.
   */
  const gruposDeBanners = useMemo(() => {
    const porArea = new Map<string, AdminBanner[]>();
    for (const banner of bannersFiltrados) {
      const atual = porArea.get(banner.slot);
      if (atual) atual.push(banner);
      else porArea.set(banner.slot, [banner]);
    }

    const conhecidas = BANNER_SLOTS.filter((slot) => porArea.has(slot.id)).map((slot) => ({
      id: slot.id,
      nome: slot.nome,
      medida: formatEntrega(slot),
      itens: porArea.get(slot.id)!,
    }));

    const desconhecidas = [...porArea.keys()]
      .filter((id) => !BANNER_SLOTS.some((slot) => slot.id === id))
      .map((id) => ({ id, nome: id, medida: "", itens: porArea.get(id)! }));

    return [...conhecidas, ...desconhecidas];
  }, [bannersFiltrados]);

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
    const result = await uploadProductImageFile(file, {
      maxSize,
      quality: BANNER_IMAGE_QUALITY,
      nome: nomeDoArquivoDeBanner({
        label: draft?.label ?? "",
        slot: draft?.slot ?? "topo",
        variante: "celular",
        carimbo: Math.floor(Date.now() / 1000),
      }),
    });
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
    // O nome do arquivo sai do nome do banner. Ver `nomeDoArquivoDeBanner`:
    // sem isso o arquivo caia como UUID e a biblioteca de imagens virava uma
    // parede de nomes que ninguem consegue identificar.
    const result = await uploadProductImageFile(file, {
      maxSize,
      quality: BANNER_IMAGE_QUALITY,
      nome: nomeDoArquivoDeBanner({
        label: draft?.label ?? "",
        slot: draft?.slot ?? "topo",
        carimbo: Math.floor(Date.now() / 1000),
      }),
    });
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

    // O nome do arquivo e decidido no envio, nao no salvamento — renomear
    // depois exigiria mover o objeto no storage. Entao quem enviou a arte antes
    // de nomear o banner precisa saber disso agora, enquanto ainda da para
    // reenviar: depois a arte ja esta la com o nome generico.
    toast.success(
      draft?.label?.trim()
        ? "Imagem enviada!"
        : "Imagem enviada. Para o arquivo receber o nome do banner, preencha o nome antes de enviar a arte.",
    );
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
      <SectionHeader
        eyebrow="Banners"
        title="Banners sob controle do admin"
        description="Cadastre banners para a vitrine principal e confira a medida de cada área."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[0.6875rem] text-primary">
              {sortedBanners.filter((banner) => banner.active).length} ativo(s)
            </Badge>
          </div>
        }
      />

      <BannerSlotsPanel />

      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        {/* Busca e ação no mesmo cartão da lista, como na tela de Produtos. */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou área do site"
              className="h-11 rounded-2xl border-border/70 bg-background pl-9 pr-16 text-[0.8125rem]"
            />
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[0.6875rem] font-medium text-muted-foreground">
              {bannersFiltrados.length}
            </div>
          </div>
          <Button type="button" className="h-11 rounded-2xl px-4 text-sm" onClick={openNew}>
            <Plus className="h-4 w-4" />
            Novo banner
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5">
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
        ) : bannersFiltrados.length === 0 ? (
          <div className="rounded-[1.25rem] border border-dashed border-border/70 p-8 text-center text-muted-foreground">
            {busca.trim() ? "Nenhum banner com esse nome ou área." : "Nenhum banner cadastrado ainda."}
          </div>
        ) : (
          <div className="space-y-8">
            {gruposDeBanners.map((grupo) => (
              <section key={grupo.id} className="space-y-3">
                {/* O nome da area sai do cartao e vira cabecalho do grupo: com
                    os banners ja separados, repeti-lo em cada cartao era ruido,
                    e a medida de entrega e a mesma para o grupo inteiro. */}
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/60 pb-2">
                  <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-foreground">
                    {grupo.nome}
                  </h3>
                  <p className="text-[0.6875rem] text-muted-foreground">
                    {grupo.medida ? `${grupo.medida} · ` : ""}
                    {grupo.itens.length} banner{grupo.itens.length === 1 ? "" : "s"}
                  </p>
                </div>

                {/* `items-stretch` com o cartao em `h-full`: sem isso um cartao
                    com link fica mais alto que o vizinho sem link, e as fileiras
                    de botoes param em alturas diferentes. */}
                <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {grupo.itens.map((banner) => (
                    <div
                      key={banner.id}
                      className={cn(
                        "group flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border/70 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
                        CARTAO_CLICAVEL,
                        !banner.active && "opacity-70",
                      )}
                    >
                      <div className={cn(BANNER_PREVIEW_FRAME_CLASS, previewAspect(banner.slot), !banner.image_url && "bg-muted/20")}>
                        {banner.image_url ? (
                          <img
                            src={banner.image_url}
                            alt={banner.label}
                            className={cn("h-full w-full object-cover", IMAGEM_DO_CARTAO)}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>

                      {/* `flex-1` faz o corpo ocupar a sobra, e o `mt-auto` da
                          fileira de botoes empurra ela para o rodape. E o que
                          alinha os botoes de todos os cartoes da linha, tenham
                          eles link ou nao. */}
                      <div className="flex flex-1 flex-col gap-3 p-4">
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

                        <div className="mt-auto flex flex-wrap gap-2 pt-1">
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
              </section>
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
              <Button
                type="button"
                variant="outline"
                className="absolute right-14 top-3.5 h-10 rounded-full px-4 text-sm sm:right-16"
                onClick={() => setPreviaAberta(true)}
                disabled={!draft}
              >
                <Eye className="h-4 w-4" />
                Ver prévia
              </Button>
              <DialogDescription className="text-left text-[0.8125rem] text-muted-foreground">
                Ajuste o conteúdo visual e escolha em qual área ele será exibido.
              </DialogDescription>
            </DialogHeader>

            {/* Uma coluna, de cima para baixo — a forma da tela de Produtos.

                A prévia dividia a largura com o formulário e as duas ficavam
                apertadas: campo de meia tela ao lado de uma arte reduzida, que é
                justamente o que a prévia existe para não ser. Agora ela abre em
                diálogo próprio, no botão "Ver prévia" do cabeçalho, e usa a
                largura toda. */}
              <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="min-h-0 p-4 sm:p-5">
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

      {/* A prévia num diálogo próprio, e não numa coluna ao lado.
          Banner é peça de largura inteira: reduzida à metade da tela, ela não
          responde à pergunta que a prévia existe para responder. */}
      <Dialog open={previaAberta && Boolean(draft)} onOpenChange={setPreviaAberta}>
        <DialogContent className="max-h-[92dvh] w-[min(98vw,1280px)] max-w-[1280px] overflow-y-auto rounded-[1.75rem] border-border/70">
          <DialogHeader>
            <DialogTitle className="text-left text-lg font-semibold tracking-tight">Prévia do banner</DialogTitle>
            <DialogDescription className="text-left text-[0.8125rem] text-muted-foreground">
              Como a peça vai aparecer no catálogo.
            </DialogDescription>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}

