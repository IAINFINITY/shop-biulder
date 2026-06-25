import { Eye, EyeOff, ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type ChangeEvent, type RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatBRL, coercePrice } from "@/lib/formatMoney";
import { getProductImageUrls } from "@/lib/products";
import { cn } from "@/lib/utils";
import { AdminSectionHeader } from "./AdminSectionHeader";
import { AdminProductForm } from "./AdminProductForm";
import { AdminProductPreview } from "./AdminProductPreview";
import type { AdminProductFormState, AdminProduct } from "./adminTypes";

type PreviewMode = "catalog" | "details";

type AdminProductsSectionProps = {
  isLoading: boolean;
  filteredProducts: AdminProduct[];
  editing: AdminProductFormState | null;
  isNew: boolean;
  productSearch: string;
  onProductSearchChange: (value: string) => void;
  onStartNew: () => void;
  onStartEdit: (product: AdminProduct) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onRemove: (id: string) => void;
  title: string;
  typeOptions: string[];
  newType: string;
  onNewTypeChange: (value: string) => void;
  adminTypes: Array<{ id: string; name: string }>;
  uploading: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onEditChange: (next: AdminProductFormState) => void;
  onAddType: () => void;
  onDeleteType: (id: string) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemoveImageAt: (index: number) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function AdminProductsSection({
  isLoading,
  filteredProducts,
  editing,
  isNew,
  productSearch,
  onProductSearchChange,
  onStartNew,
  onStartEdit,
  onToggleActive,
  onRemove,
  title,
  typeOptions,
  newType,
  onNewTypeChange,
  adminTypes,
  uploading,
  fileInputRef,
  onEditChange,
  onAddType,
  onDeleteType,
  onFileChange,
  onRemoveImageAt,
  onSave,
  onCancel,
}: AdminProductsSectionProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("catalog");

  useEffect(() => {
    setPreviewMode("catalog");
  }, [editing?.id]);

  return (
    <div className="space-y-6">
      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <AdminSectionHeader
          eyebrow="Produtos"
          title={title}
          description="Pesquise, atualize e cadastre produtos sem sair da mesma tela."
          actions={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-[360px]">
                <Input
                  placeholder="Pesquisar produto (nome, família, tipo)"
                  value={productSearch}
                  onChange={(e) => onProductSearchChange(e.target.value)}
                  className="h-11 rounded-2xl border-border/70 bg-background pr-20 text-[13px]"
                />
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] font-medium text-muted-foreground">
                  {isLoading ? "..." : `${filteredProducts.length} itens`}
                </div>
              </div>

              <Button onClick={onStartNew} className="h-10 rounded-2xl px-4 text-sm">
                <Plus className="h-4 w-4" />
                Novo produto
              </Button>
            </div>
          }
        />
      </div>

      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-foreground">Atualize status, fotos e dados internos com rapidez.</p>
          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[11px] text-primary">
            {isLoading ? "Carregando" : `${filteredProducts.length} produto(s)`}
          </Badge>
        </div>

        {isLoading ? (
          <div className="rounded-[1.25rem] border border-dashed border-border/70 p-8 text-center text-muted-foreground">
            Carregando produtos...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-[1.25rem] border border-dashed border-border/70 p-8 text-center text-muted-foreground">
            Nenhum produto encontrado com esse filtro
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProducts.map((p) => {
              const thumb = getProductImageUrls(p)[0];
              const isEditing = editing?.id === p.id;

              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex flex-col gap-4 rounded-[1.2rem] border p-4 transition-colors sm:flex-row sm:items-center",
                    isEditing ? "border-primary/30 bg-primary/5" : "border-border/70 bg-card hover:bg-muted/20",
                    !p.active && "opacity-70",
                  )}
                >
                  <div className="flex items-center gap-3 sm:min-w-0 sm:flex-1">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-border bg-background">
                      {thumb ? (
                        <img src={thumb} alt={p.name} className="h-full w-full object-contain p-1.5" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground/35" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[15px] font-semibold text-foreground">{p.name}</p>
                        {isEditing ? (
                          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                            Em edição
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {p.type} · {p.family}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.product_code ? (
                          <Badge variant="outline" className="rounded-full px-2.5 py-0.5 font-mono text-[11px]">
                            {p.product_code}
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px]">
                          {p.active ? "Ativo" : "Inativo"}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                          {formatBRL(coercePrice(p.price))}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => onToggleActive(p.id, p.active)}>
                      {p.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => onStartEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-destructive"
                      onClick={() => onRemove(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && onCancel()}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden rounded-[1.75rem] border-border/70 p-0 sm:max-w-6xl">
          <div className="flex max-h-[92vh] flex-col overflow-hidden">
            <DialogHeader className="border-b border-border/70 px-5 py-4">
              <DialogTitle className="text-left text-[1.1rem] font-black tracking-[-0.04em] text-foreground">
                {isNew ? "Novo Produto" : "Editar Produto"}
              </DialogTitle>
              <DialogDescription className="text-left text-[13px] text-muted-foreground">
                Ajuste os dados do produto sem ocupar a tela inteira do admin
              </DialogDescription>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
                {editing ? (
                  <AdminProductForm
                    editing={editing}
                    typeOptions={typeOptions}
                    newType={newType}
                    onNewTypeChange={onNewTypeChange}
                    adminTypes={adminTypes}
                    uploading={uploading}
                    fileInputRef={fileInputRef}
                    onChange={onEditChange}
                    onAddType={onAddType}
                    onDeleteType={onDeleteType}
                    onFileChange={onFileChange}
                    onRemoveImageAt={onRemoveImageAt}
                    onSave={onSave}
                    onCancel={onCancel}
                    className="border-0 bg-transparent p-0 shadow-none"
                  />
                ) : null}
              </div>

              <div className="min-h-0 overflow-y-auto border-t border-border/70 bg-muted/15 p-4 sm:p-5 lg:border-l lg:border-t-0">
                <div className="flex h-full min-h-[320px] flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Pré-visualização
                      </p>
                      <p className="text-sm text-foreground/80">
                        Alterna entre a miniatura do catálogo e a visão expandida do produto.
                      </p>
                    </div>

                    <div className="inline-flex rounded-full border border-border/70 bg-background p-1">
                      <Button
                        type="button"
                        variant={previewMode === "catalog" ? "default" : "ghost"}
                        className="h-9 rounded-full px-3 text-xs"
                        onClick={() => setPreviewMode("catalog")}
                      >
                        Catálogo
                      </Button>
                      <Button
                        type="button"
                        variant={previewMode === "details" ? "default" : "ghost"}
                        className="h-9 rounded-full px-3 text-xs"
                        onClick={() => setPreviewMode("details")}
                      >
                        Aberto
                      </Button>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 items-center justify-center py-6">
                    <AdminProductPreview editing={editing} mode={previewMode} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
