import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { ImageIcon, Link as LinkIcon, Pencil, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { AdminSectionHeader } from "./AdminSectionHeader";
import type { AdminBanner } from "./adminTypes";
import { CATALOG_BANNERS_TABLE } from "@/lib/catalogBanners";
import { deleteStorageImage, uploadProductImageFile } from "@/lib/productImageStorage";
import { ADMIN_TEXT_LIMITS } from "@/lib/adminTextLimits";
import { cn } from "@/lib/utils";
import { useCatalogBanners } from "@/hooks/useCatalogBanners";

type BannerFormState = {
  id?: string;
  label: string;
  imageUrl: string;
  linkUrl: string;
  sortOrder: string;
  active: boolean;
};

const DEFAULT_SORT_STEP = 10;

function getNextSortOrder(banners: AdminBanner[]): string {
  if (banners.length === 0) return "0";
  const maxOrder = Math.max(...banners.map((banner) => banner.sort_order));
  return String(maxOrder + DEFAULT_SORT_STEP);
}

function normalizeLinkUrl(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function AdminBannersSection() {
  const queryClient = useQueryClient();
  const { data: banners = [], isLoading } = useCatalogBanners({ activeOnly: false });
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<BannerFormState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      imageUrl: "",
      linkUrl: "",
      sortOrder: getNextSortOrder(sortedBanners),
      active: true,
    });
    setEditorOpen(true);
  };

  const openEdit = (banner: AdminBanner) => {
    setDraft({
      id: banner.id,
      label: banner.label,
      imageUrl: banner.image_url,
      linkUrl: banner.link_url ?? "",
      sortOrder: String(banner.sort_order),
      active: banner.active,
    });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    const result = await uploadProductImageFile(file);
    setUploading(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setDraft((current) => {
      if (!current) return current;
      return { ...current, imageUrl: result.publicUrl };
    });
    toast.success("Imagem enviada!");
  };

  const saveBanner = async () => {
    if (!draft) return;

    const label = draft.label.trim();
    const imageUrl = draft.imageUrl.trim();
    if (!label || !imageUrl) {
      toast.error("Preencha o nome do banner e a imagem.");
      return;
    }

    const sortOrder = Number.isFinite(Number(draft.sortOrder)) ? Math.trunc(Number(draft.sortOrder)) : 0;
    const payload = {
      label,
      image_url: imageUrl,
      link_url: normalizeLinkUrl(draft.linkUrl),
      sort_order: sortOrder,
      active: draft.active,
    };

    setSaving(true);
    const { error } = draft.id
      ? await supabase.from(CATALOG_BANNERS_TABLE).update(payload).eq("id", draft.id)
      : await supabase.from(CATALOG_BANNERS_TABLE).insert(payload);
    setSaving(false);

    if (error) {
      console.error("Erro ao salvar banner", error);
      toast.error("Erro ao salvar banner.");
      return;
    }

    toast.success(draft.id ? "Banner atualizado." : "Banner adicionado.");
    setEditorOpen(false);
    setDraft(null);
    await refresh();
  };

  const deleteBanner = async (id: string) => {
    const banner = banners.find((b) => b.id === id);
    if (banner?.image_url) {
      await deleteStorageImage(banner.image_url);
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
        title="Hero do catálogo sob controle do admin"
        description="Cadastre, reordene e desative banners sem depender de arquivos fixos na aplicação."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[11px] text-primary">
              {sortedBanners.filter((banner) => banner.active).length} ativo(s)
            </Badge>
            <Button type="button" className="h-10 rounded-2xl px-4 text-sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Novo banner
            </Button>
          </div>
        }
      />

      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-foreground">O catálogo usa apenas os banners marcados como ativos, em ordem crescente.</p>
            <p className="text-xs text-muted-foreground">As imagens podem ser enviadas do computador ou coladas por URL.</p>
          </div>
          <Badge variant="outline" className="rounded-full border-border/70 px-3 py-1 text-[11px] font-medium">
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
                <div className="aspect-[1024/266] bg-muted/20">
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
                      <p className="truncate text-[15px] font-semibold text-foreground">{banner.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ordem {banner.sort_order}
                        {banner.link_url ? " • com link" : " • sem link"}
                      </p>
                    </div>
                    <Badge variant={banner.active ? "secondary" : "outline"} className="rounded-full px-2.5 py-0.5 text-[11px]">
                      {banner.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>

                  {banner.link_url ? (
                    <div className="flex items-center gap-2 rounded-[1rem] border border-border/70 bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
                      <LinkIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{banner.link_url}</span>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 sm:h-9 rounded-full px-3 text-[13px] sm:text-[12px]"
                      onClick={() => openEdit(banner)}
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 sm:h-9 rounded-full px-3 text-[13px] sm:text-[12px]"
                      onClick={() => toggleActive(banner)}
                    >
                      <RefreshCw className="h-4 w-4" />
                      {banner.active ? "Desativar" : "Ativar"}
                    </Button>

                    <ConfirmActionDialog
                      trigger={
                        <Button type="button" variant="outline" className="h-9 rounded-full px-3 text-[12px] text-destructive">
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
        <DialogContent className="max-h-[92vh] w-[min(98vw,1120px)] max-w-[1120px] overflow-hidden rounded-[1.75rem] border-border/70 p-0">
          <div className="flex max-h-[92vh] flex-col overflow-hidden">
            <DialogHeader className="border-b border-border/70 px-5 py-4">
              <DialogTitle className="text-left text-[1.1rem] font-black tracking-[-0.04em] text-foreground">
                {draft?.id ? "Editar banner" : "Novo banner"}
              </DialogTitle>
              <DialogDescription className="text-left text-[13px] text-muted-foreground">
                Ajuste o conteúdo visual que aparece na vitrine principal do catálogo.
              </DialogDescription>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
                {draft ? (
                  <div className="space-y-4 rounded-[1.5rem] border border-border/70 bg-background p-4 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="banner-label" className="text-[13px] font-medium">
                          Nome do banner
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
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
                        <Label htmlFor="banner-image-url" className="text-[13px] font-medium">
                          Imagem
                        </Label>
                        <p className="text-[11px] text-muted-foreground">URL opcional</p>
                      </div>
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
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="banner-link-url" className="text-[13px] font-medium">
                          Link do banner
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
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
                      <div className="space-y-2">
                        <Label htmlFor="banner-sort" className="text-[13px] font-medium">
                          Ordem
                        </Label>
                        <Input
                          id="banner-sort"
                          type="number"
                          value={draft.sortOrder}
                          onChange={(e) => setDraft((current) => (current ? { ...current, sortOrder: e.target.value } : current))}
                          className="h-11 rounded-2xl border-border/70 bg-background"
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Banner ativo
                          </p>
                          <p className="text-sm text-foreground">Exibir no catálogo público</p>
                        </div>
                        <Switch
                          checked={draft.active}
                          onCheckedChange={(checked) =>
                            setDraft((current) => (current ? { ...current, active: checked } : current))
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 overflow-y-auto border-t border-border/70 bg-muted/15 p-4 sm:p-5 lg:border-l lg:border-t-0">
                <div className="flex h-full min-h-[320px] flex-col gap-4">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Pré-visualização
                    </p>
                    <p className="text-sm text-foreground/80">
                      Veja como o banner fica antes de salvar.
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
                    {draft?.imageUrl ? (
                      <img src={draft.imageUrl} alt={draft.label || "Banner"} className="aspect-[1024/266] w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[1024/266] items-center justify-center bg-muted/20">
                        <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="space-y-2 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
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

