import { Eye, EyeOff, ImageIcon, Pencil, Plus, Sparkles, TrendingUp, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatBRL, coercePrice } from "@/lib/formatMoney";
import { supabase } from "@/integrations/supabase/client";
import { getProductImageUrls } from "@/lib/products";
import { PRODUCT_FAMILIES_TABLE, makeProductFamilyKey, type ProductFamily } from "@/lib/productFamilies";
import { cn } from "@/lib/utils";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { AdminSectionHeader } from "./AdminSectionHeader";
import { AdminProductForm } from "./AdminProductForm";
import { AdminProductPreview } from "./AdminProductPreview";
import { useProductFamilies } from "@/hooks/useProductFamilies";
import { toast } from "sonner";
import type { AdminProductFormState, AdminProduct } from "./adminTypes";

type PreviewMode = "catalog" | "details";

type AdminProductsSectionProps = {
  isLoading: boolean;
  allProducts: AdminProduct[];
  filteredProducts: AdminProduct[];
  editing: AdminProductFormState | null;
  isNew: boolean;
  productSearch: string;
  onProductSearchChange: (value: string) => void;
  onStartNew: () => void;
  onStartEdit: (product: AdminProduct) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onRemove: (id: string) => void;
  salesByProductId: Map<string, number>;
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
  allProducts,
  filteredProducts,
  editing,
  isNew,
  productSearch,
  onProductSearchChange,
  onStartNew,
  onStartEdit,
  onToggleActive,
  onRemove,
  salesByProductId,
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
  const [editorPanel, setEditorPanel] = useState<"form" | "preview">("form");
  const [productListFilter, setProductListFilter] = useState<"all" | "promotions" | "best_sellers">("all");
  const [newFamily, setNewFamily] = useState("");
  const [newFamilyTypeId, setNewFamilyTypeId] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [initialEditing, setInitialEditing] = useState<AdminProductFormState | null>(null);
  const editingRef = useRef<AdminProductFormState | null>(null);
  const queryClient = useQueryClient();
  const editingKey = editing ? editing.id ?? "__new__" : "__none__";
  const { data: productFamilies = [] } = useProductFamilies();
  const typeNameById = useMemo(() => new Map(adminTypes.map((type) => [type.id, type.name])), [adminTypes]);
  const typeUsage = useMemo(() => {
    const usage = new Map<string, number>();
    for (const product of allProducts) {
      usage.set(product.type, (usage.get(product.type) ?? 0) + 1);
    }
    return usage;
  }, [allProducts]);
  const familyUsage = useMemo(() => {
    const usage = new Map<string, number>();
    for (const product of allProducts) {
      const family = product.family.trim();
      if (!family) continue;
      const key = makeProductFamilyKey(product.type, family);
      usage.set(key, (usage.get(key) ?? 0) + 1);
    }
    return usage;
  }, [allProducts]);
  const familyGroups = useMemo(() => {
    const grouped = new Map<string, ProductFamily[]>();
    for (const family of productFamilies) {
      const typeId = family.type_id || "__unlinked__";
      if (!grouped.has(typeId)) grouped.set(typeId, []);
      grouped.get(typeId)!.push(family);
    }

    return adminTypes
      .map((type) => ({
        type,
        families: (grouped.get(type.id) ?? []).sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
      }))
      .filter((group) => group.families.length > 0);
  }, [adminTypes, productFamilies]);
  const familyOptionsByTypeName = useMemo(() => {
    const grouped = new Map<string, string[]>();

    for (const type of adminTypes) {
      grouped.set(
        type.name,
        productFamilies
          .filter((family) => family.type_id === type.id)
          .map((family) => family.name.trim())
          .filter(Boolean)
          .sort((left, right) => left.localeCompare(right, "pt-BR")),
      );
    }

    return grouped;
  }, [adminTypes, productFamilies]);
  const familyOptionsForEditing = useMemo(() => {
    if (!editing) return [];
    const currentFamily = editing.family.trim();
    const familyOptions = [...(familyOptionsByTypeName.get(editing.type) ?? [])];

    if (currentFamily && !familyOptions.includes(currentFamily)) {
      familyOptions.unshift(currentFamily);
    }

    return familyOptions;
  }, [editing, familyOptionsByTypeName]);
  const unlinkedFamilies = useMemo(
    () => productFamilies.filter((family) => !family.type_id || !typeNameById.has(family.type_id)),
    [productFamilies, typeNameById],
  );

  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  useEffect(() => {
    setPreviewMode("catalog");
  }, [editingKey]);

  useEffect(() => {
    if (editing) {
      setEditorPanel("form");
    }
  }, [editing, editingKey]);

  useEffect(() => {
    if (newFamilyTypeId) return;
    if (adminTypes.length > 0) setNewFamilyTypeId(adminTypes[0].id);
  }, [adminTypes, newFamilyTypeId]);

  useEffect(() => {
    const currentEditing = editingRef.current;

    if (currentEditing) {
      setInitialEditing({
        ...currentEditing,
        image_urls: [...currentEditing.image_urls],
      });
      return;
    }

    setInitialEditing(null);
    setDiscardOpen(false);
  }, [editingKey]);

  const hasUnsavedChanges = useMemo(() => {
    if (!editing || !initialEditing) return false;
    return (
      editing.name !== initialEditing.name ||
      editing.description !== initialEditing.description ||
      editing.type !== initialEditing.type ||
      editing.family !== initialEditing.family ||
      editing.active !== initialEditing.active ||
      editing.priceInput !== initialEditing.priceInput ||
      editing.productCode !== initialEditing.productCode ||
      editing.image_urls.join("\u0001") !== initialEditing.image_urls.join("\u0001")
    );
  }, [editing, initialEditing]);

  const visibleProducts = useMemo(() => {
    const products = [...filteredProducts];
    if (productListFilter === "promotions") {
      return products.filter((product) => product.is_promotion);
    }
    if (productListFilter === "best_sellers") {
      return products
        .map((product) => ({
          product,
          sales: salesByProductId.get(product.id) ?? 0,
        }))
        .sort((left, right) => right.sales - left.sales || left.product.name.localeCompare(right.product.name, "pt-BR"))
        .map(({ product }) => product);
    }
    return products;
  }, [filteredProducts, productListFilter, salesByProductId]);

  const requestClose = () => {
    if (!editing) return;
    if (hasUnsavedChanges) {
      setDiscardOpen(true);
      return;
    }
    onCancel();
  };

  const refreshFamilies = async () => {
    await queryClient.invalidateQueries({ queryKey: ["product-families"] });
  };

  const addFamily = async () => {
    const name = newFamily.trim();
    const typeId = newFamilyTypeId.trim();
    if (!name || !typeId) {
      toast.error("Informe a categoria principal e o nome da subcategoria.");
      return;
    }

    const { data, error } = await supabase
      .from(PRODUCT_FAMILIES_TABLE)
      .insert({ name, type_id: typeId } as never)
      .select("id,name,type_id,created_at,updated_at")
      .single();
    if (error) {
      console.error("Erro ao adicionar subcategoria", error);
      toast.error("Erro ao adicionar subcategoria.");
      return;
    }

    setNewFamily("");
    setNewFamilyTypeId(typeId);
    toast.success("Subcategoria adicionada.");
    queryClient.setQueryData<ProductFamily[]>(["product-families"], (current = []) => {
      const next = [
        ...current.filter((family) => family.id !== (data?.id ?? "")),
        data ?? {
          id: name,
          name,
          type_id: typeId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      return next.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    });
    await refreshFamilies();
  };

  const deleteFamily = async (family: ProductFamily) => {
    const usage = familyUsage.get(makeProductFamilyKey(typeNameById.get(family.type_id) ?? "", family.name)) ?? 0;
    if (usage > 0) {
      toast.error("Reatribua os produtos dessa subcategoria antes de removê-la.");
      return;
    }

    const { error } = await supabase.from(PRODUCT_FAMILIES_TABLE).delete().eq("id", family.id);
    if (error) {
      console.error("Erro ao remover subcategoria", error);
      toast.error("Erro ao remover subcategoria.");
      return;
    }

    toast.success("Subcategoria removida.");
    queryClient.setQueryData<ProductFamily[]>(["product-families"], (current = []) =>
      current.filter((item) => item.id !== family.id),
    );
    await refreshFamilies();
  };

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Produtos"
        title={title}
        description="Pesquise, atualize e cadastre produtos sem sair da mesma tela."
        actions={
          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[11px] text-primary">
            {visibleProducts.length} produto(s)
          </Badge>
        }
      />

      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Categorias do catálogo
            </p>
            <p className="text-sm text-foreground">Crie e remova as categorias principais usadas no seletor dos produtos.</p>
            <p className="text-xs text-muted-foreground">
              A exclusão remove apenas a opção da lista, não altera os produtos já salvos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1 text-[11px] font-medium">
              {adminTypes.length} categoria(s)
            </Badge>
            <Button type="button" variant="outline" className="h-10 rounded-2xl px-4 text-sm" onClick={onAddType}>
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <Input
            placeholder="Nova categoria"
            value={newType}
            onChange={(e) => onNewTypeChange(e.target.value)}
            className="h-11 rounded-2xl border-border/70 bg-background"
          />

          <div className="flex flex-wrap gap-2">
            {adminTypes.length > 0 ? (
              adminTypes.map((type) => {
                const count = typeUsage.get(type.name) ?? 0;
                return (
                  <ConfirmActionDialog
                    key={type.id}
                    trigger={
                      <Button type="button" variant="secondary" className="h-10 sm:h-9 gap-2 rounded-full px-3 text-[13px] sm:text-[12px]">
                        <span className="max-w-[14rem] truncate">{type.name}</span>
                        <Badge variant="outline" className="rounded-full border-border/70 px-2 py-0.5 text-[10px]">
                          {count}
                        </Badge>
                      </Button>
                    }
                    title="Remover categoria"
                    description={
                      <>
                        <span className="block">Deseja remover a categoria "{type.name}"?</span>
                        <span className="mt-2 block text-muted-foreground">
                          Isso apenas tira a opção do seletor. Produtos já cadastrados continuam com o tipo salvo.
                        </span>
                      </>
                    }
                    confirmLabel="Remover"
                    destructive
                    onConfirm={() => onDeleteType(type.id)}
                  />
                );
              })
            ) : (
              <div className="rounded-full border border-dashed border-border/70 px-4 py-2 text-[12px] text-muted-foreground">
                Nenhuma categoria cadastrada
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Subcategorias do catálogo
            </p>
            <p className="text-sm text-foreground">
              Vincule cada subcategoria a uma categoria principal para deixar a estrutura mais clara.
            </p>
            <p className="text-xs text-muted-foreground">
              Se a subcategoria ainda estiver em uso, remova-a apenas depois de reatribuir os produtos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1 text-[11px] font-medium">
              {productFamilies.length} subcategoria(s)
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_auto] lg:items-center">
          <Input
            placeholder="Nova subcategoria"
            value={newFamily}
            onChange={(e) => setNewFamily(e.target.value)}
            className="h-11 rounded-2xl border-border/70 bg-background"
          />

          <Select value={newFamilyTypeId} onValueChange={setNewFamilyTypeId}>
            <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background text-[13px]">
              <SelectValue placeholder="Categoria principal" />
            </SelectTrigger>
            <SelectContent>
              {adminTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button type="button" variant="outline" className="h-10 rounded-2xl px-4 text-sm" onClick={addFamily}>
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {familyGroups.length > 0 ? (
            familyGroups.map(({ type, families }) => (
              <div key={type.id} className="rounded-[1.35rem] border border-border/70 bg-muted/15 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {type.name}
                    </p>
                    <p className="text-sm text-foreground">{families.length} subcategoria(s) vinculada(s)</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {families.map((family) => {
                    const count = familyUsage.get(makeProductFamilyKey(type.name, family.name)) ?? 0;
                    return (
                      <ConfirmActionDialog
                        key={family.id}
                        trigger={
                          <Button type="button" variant="secondary" className="h-10 sm:h-9 gap-2 rounded-full px-3 text-[13px] sm:text-[12px]">
                            <span className="max-w-[14rem] truncate">{family.name}</span>
                            <Badge variant="outline" className="rounded-full border-border/70 px-2 py-0.5 text-[10px]">
                              {count}
                            </Badge>
                          </Button>
                        }
                        title="Remover subcategoria"
                        description={
                          <>
                            <span className="block">
                              Deseja remover a subcategoria "{family.name}" da categoria "{type.name}"?
                            </span>
                            <span className="mt-2 block text-muted-foreground">
                              {count > 0
                                ? "Ela ainda está em uso. Reatribua os produtos antes de excluir."
                                : "Essa ação remove apenas a opção da lista administrativa."}
                            </span>
                          </>
                        }
                        confirmLabel="Remover"
                        destructive
                        onConfirm={() => deleteFamily(family)}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.35rem] border border-dashed border-border/70 px-4 py-5 text-[12px] text-muted-foreground">
              Nenhuma subcategoria cadastrada
            </div>
          )}
        </div>

        {unlinkedFamilies.length > 0 ? (
          <div className="mt-3 rounded-[1.35rem] border border-amber-200 bg-amber-50/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Subcategorias sem vínculo
            </p>
            <p className="mt-1 text-sm text-amber-900">
              Estas subcategorias ainda não estão ligadas a uma categoria principal.
            </p>
          </div>
        ) : null}
      </div>

      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="relative">
            <Input
              placeholder="Pesquisar produto (nome, família, tipo)"
              value={productSearch}
              onChange={(e) => onProductSearchChange(e.target.value)}
              className="h-11 rounded-2xl border-border/70 bg-background pr-20 text-[13px]"
            />
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] font-medium text-muted-foreground">
              {filteredProducts.length} itens
            </div>
          </div>

          <Button onClick={onStartNew} className="h-10 rounded-2xl px-4 text-sm">
            <Plus className="h-4 w-4" />
            Novo produto
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={productListFilter === "all" ? "default" : "outline"}
            className="h-10 sm:h-9 rounded-full px-3 text-[13px] sm:text-[12px]"
            onClick={() => setProductListFilter("all")}
          >
            Todos
          </Button>
          <Button
            type="button"
            variant={productListFilter === "best_sellers" ? "default" : "outline"}
            className="h-10 sm:h-9 rounded-full px-3 text-[13px] sm:text-[12px]"
            onClick={() => setProductListFilter("best_sellers")}
          >
            <TrendingUp className="h-4 w-4" />
            Mais vendidos
          </Button>
          <Button
            type="button"
            variant={productListFilter === "promotions" ? "default" : "outline"}
            className="h-10 sm:h-9 rounded-full px-3 text-[13px] sm:text-[12px]"
            onClick={() => setProductListFilter("promotions")}
          >
            <Sparkles className="h-4 w-4" />
            Promoções
          </Button>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-foreground">Atualize status, fotos e dados internos com rapidez.</p>
          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[11px] text-primary">
            {visibleProducts.length} produto(s)
          </Badge>
        </div>

        {isLoading ? (
          <div className="space-y-3 rounded-[1.25rem] border border-dashed border-border/70 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 rounded-[1rem] border border-border/60 bg-card p-3">
                <Skeleton className="h-14 w-14 rounded-[1rem]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3 rounded-md" />
                  <Skeleton className="h-3 w-1/2 rounded-md" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-14 rounded-full" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-9 w-9 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="rounded-[1.25rem] border border-dashed border-border/70 p-8 text-center text-muted-foreground">
            Nenhum produto encontrado com esse filtro
          </div>
        ) : (
          <div className="space-y-2">
            {visibleProducts.map((p) => {
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
                        <p className="truncate text-[14px] sm:text-[15px] font-semibold text-foreground">{p.name}</p>
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
                        {p.is_promotion ? (
                          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] text-primary">
                            Promoção
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
                    <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-9 sm:w-9 rounded-full" onClick={() => onToggleActive(p.id, p.active)}>
                      {p.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-9 sm:w-9 rounded-full" onClick={() => onStartEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmActionDialog
                      trigger={
                        <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-9 sm:w-9 rounded-full text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                      title="Excluir produto"
                      description={`Deseja excluir "${p.name}"? Essa ação remove o produto do catálogo.`}
                      confirmLabel="Excluir"
                      destructive
                      onConfirm={() => onRemove(p.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
      >
        <DialogContent className="max-h-[92vh] w-[min(98vw,1720px)] max-w-[1720px] overflow-hidden rounded-[1.75rem] border-border/70 p-0">
          <div className="flex max-h-[92vh] flex-col overflow-hidden">
            <DialogHeader className="border-b border-border/70 px-5 py-4">
              <DialogTitle className="text-left text-[1.1rem] font-black tracking-[-0.04em] text-foreground">
                {isNew ? "Novo Produto" : "Editar Produto"}
              </DialogTitle>
              <DialogDescription className="text-left text-[13px] text-muted-foreground">
                Ajuste os dados do produto sem ocupar a tela inteira do admin
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 lg:hidden">
              <Button
                type="button"
                variant={editorPanel === "form" ? "default" : "ghost"}
                className="h-10 flex-1 rounded-full px-3 text-xs"
                onClick={() => setEditorPanel("form")}
              >
                Formulário
              </Button>
              <Button
                type="button"
                variant={editorPanel === "preview" ? "default" : "ghost"}
                className="h-10 flex-1 rounded-full px-3 text-xs"
                onClick={() => setEditorPanel("preview")}
              >
                Pré-visualização
              </Button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className={cn("min-h-0 overflow-y-auto p-4 sm:p-5", editorPanel !== "form" && "hidden lg:block")}>
                {editing ? (
                  <AdminProductForm
                    editing={editing}
                    typeOptions={typeOptions}
                    familyOptions={familyOptionsForEditing}
                    uploading={uploading}
                    fileInputRef={fileInputRef}
                    onChange={onEditChange}
                    onFileChange={onFileChange}
                    onRemoveImageAt={onRemoveImageAt}
                    onSave={onSave}
                    onCancel={requestClose}
                    className="border-0 bg-transparent p-0 shadow-none"
                  />
                ) : null}
              </div>

              <div className={cn("min-h-0 overflow-y-auto border-t border-border/70 bg-muted/15 p-4 sm:p-5 lg:border-l lg:border-t-0", editorPanel !== "preview" && "hidden lg:block")}>
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
                        className="h-10 sm:h-9 rounded-full px-3 text-xs"
                        onClick={() => setPreviewMode("catalog")}
                      >
                        Catálogo
                      </Button>
                      <Button
                        type="button"
                        variant={previewMode === "details" ? "default" : "ghost"}
                        className="h-10 sm:h-9 rounded-full px-3 text-xs"
                        onClick={() => setPreviewMode("details")}
                      >
                        Aberto
                      </Button>
                    </div>
                  </div>

                  <div
                    className={`flex min-h-0 flex-1 justify-center py-6 ${
                      previewMode === "catalog" ? "items-center" : "items-start"
                    }`}
                  >
                    <AdminProductPreview editing={editing} mode={previewMode} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent className="rounded-[1.5rem] border-border/70">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle className="text-[1.05rem] font-black tracking-[-0.04em] text-foreground">
              Sair sem salvar
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-6 text-muted-foreground">
              Você tem alterações não salvas neste produto. Se sair agora, tudo o que foi editado será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="mt-0 rounded-2xl px-4 text-sm" onClick={() => setDiscardOpen(false)}>
              Continuar editando
            </AlertDialogCancel>
            <AlertDialogAction
              className="mt-0 rounded-2xl bg-destructive px-4 text-sm text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setDiscardOpen(false);
                onCancel();
              }}
            >
              Descartar alterações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
