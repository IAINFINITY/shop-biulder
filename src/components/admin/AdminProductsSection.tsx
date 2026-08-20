import { Eye, EyeOff, ImageIcon, Pencil, Plus, Sparkles, Star, TrendingUp, Trash2 } from "lucide-react";
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
import { PRODUCT_IMAGE_MIN_SIZE } from "@/lib/productImageNormalization";
import { PRODUCT_FAMILIES_TABLE, makeProductFamilyKey, type ProductFamily } from "@/lib/productFamilies";
import { PRODUCT_BRANDS_TABLE, type ProductBrand } from "@/lib/productBrands";
import { cn } from "@/lib/utils";
import { produtoTemSubcategoria, subcategoriasDoProduto } from "@/lib/subcategorias";
import { ChipDeCategoria } from "@/components/admin/ChipDeCategoria";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { AdminSectionHeader } from "./AdminSectionHeader";
import { AdminProductForm } from "./AdminProductForm";
import { AdminProductPreview } from "./AdminProductPreview";
import { useProductFamilies } from "@/hooks/useProductFamilies";
import { useProductBrands } from "@/hooks/useProductBrands";
import { toast } from "sonner";
import type { AdminProductFormState, AdminProduct } from "./adminTypes";
import { MODAL_TELA_CHEIA, MODAL_TELA_CHEIA_CORPO } from "@/lib/modais";

type PreviewMode = "catalog" | "details";

/**
 * Pendencias de cadastro de um produto.
 *
 * A ideia vem do score de completude dos PIM: em vez de descobrir o problema
 * abrindo produto por produto, a lista mostra quantos estao incompletos e
 * filtra direto para eles. Sem isso ninguem conseguia responder "quanto falta?".
 */
type ProductIssue = "sem-imagem" | "imagem-pequena" | "sem-marca" | "sem-codigo" | "sem-descricao-imagem";

const ISSUE_FILTERS: Array<{ id: ProductIssue; label: string }> = [
  { id: "sem-imagem", label: "Sem foto" },
  { id: "imagem-pequena", label: "Foto abaixo do padrão" },
  { id: "sem-descricao-imagem", label: "Sem descrição de imagem" },
  { id: "sem-marca", label: "Sem marca" },
  { id: "sem-codigo", label: "Sem código" },
];

function productIssues(product: AdminProduct): ProductIssue[] {
  const issues: ProductIssue[] = [];
  const images = getProductImageUrls(product);

  if (images.length === 0) issues.push("sem-imagem");
  else {
    const menorLado = Math.min(product.image_width ?? 0, product.image_height ?? 0);
    // Dimensao ausente significa imagem antiga ainda nao medida — nao acusa.
    if (menorLado > 0 && menorLado < PRODUCT_IMAGE_MIN_SIZE) issues.push("imagem-pequena");
    if (!product.image_alts?.some((alt) => alt.trim())) issues.push("sem-descricao-imagem");
  }

  if (!(product.brand ?? "").trim()) issues.push("sem-marca");
  if (!(product.product_code ?? "").trim()) issues.push("sem-codigo");

  return issues;
}

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
  /** `visivel` opcional: a coluna pode nao existir ainda, e ausente = visivel. */
  adminTypes: Array<{ id: string; name: string; visivel?: boolean | null }>;
  uploading: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onEditChange: (next: AdminProductFormState) => void;
  onAddType: () => void;
  onDeleteType: (id: string) => void;
  onToggleTypeVisivel?: (id: string, visivel: boolean) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemoveImageAt: (index: number) => Promise<void>;
  onMoveImageAt: (from: number, to: number) => void;
  onImageAltChange: (index: number, alt: string) => void;
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
  onToggleTypeVisivel,
  onFileChange,
  onRemoveImageAt,
  onMoveImageAt,
  onImageAltChange,
  onSave,
  onCancel,
}: AdminProductsSectionProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("catalog");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [productListFilter, setProductListFilter] = useState<"all" | "promotions" | "featured" | "best_sellers" | ProductIssue>("all");
  /**
   * Filtro por categoria e subcategoria, independente do `productListFilter`.
   *
   * Sao dimensoes diferentes: da para querer "so promocoes" **dentro** de "Chas".
   * Antes o chip so servia para remover — o contador dizia "50" e nao havia como
   * ver quais eram os 50.
   */
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null);
  const [filtroFamilia, setFiltroFamilia] = useState<string | null>(null);
  const [newFamily, setNewFamily] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [initialEditing, setInitialEditing] = useState<AdminProductFormState | null>(null);
  const editingRef = useRef<AdminProductFormState | null>(null);
  const queryClient = useQueryClient();
  const editingKey = editing ? editing.id ?? "__new__" : "__none__";
  const { data: productFamilies = [] } = useProductFamilies();
  const { data: productBrands = [] } = useProductBrands();
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
      // Conta em cada subcategoria a que o produto pertence, para o numero do
      // chip bater com o que o filtro dele mostra.
      for (const sub of subcategoriasDoProduto(product)) {
        const chave = makeProductFamilyKey(sub);
        usage.set(chave, (usage.get(chave) ?? 0) + 1);
      }
      const family = "";
      if (!family) continue;
      const key = makeProductFamilyKey(family);
      usage.set(key, (usage.get(key) ?? 0) + 1);
    }
    return usage;
  }, [allProducts]);
  const brandUsage = useMemo(() => {
    const usage = new Map<string, number>();
    for (const product of allProducts) {
      const brand = (product.brand ?? "").trim().toLowerCase();
      if (!brand) continue;
      usage.set(brand, (usage.get(brand) ?? 0) + 1);
    }
    return usage;
  }, [allProducts]);
  const productsWithoutBrand = useMemo(
    () => allProducts.filter((product) => !(product.brand ?? "").trim()).length,
    [allProducts],
  );
  const issueCounts = useMemo(() => {
    const counts = new Map<ProductIssue, number>();
    for (const product of allProducts) {
      for (const issue of productIssues(product)) {
        counts.set(issue, (counts.get(issue) ?? 0) + 1);
      }
    }
    return counts;
  }, [allProducts]);
  const totalIssueCount = useMemo(
    () => [...issueCounts.values()].reduce((sum, count) => sum + count, 0),
    [issueCounts],
  );
  const familyOptions = useMemo(
    () => productFamilies.map((family) => family.name.trim()).filter(Boolean),
    [productFamilies],
  );
  const familyOptionsForEditing = useMemo(() => {
    if (!editing) return familyOptions;
      // Mantem visiveis as subcategorias ja gravadas mesmo que nao estejam mais
      // no cadastro — editar nao pode apagar o valor. Agora sao varias.
      const ausentes = editing.families.filter((nome) => nome && !familyOptions.includes(nome));
    // Mantem visivel a subcategoria ja gravada no produto mesmo que ela nao
    // esteja mais no cadastro, para editar o produto nao apagar o valor.
      if (ausentes.length > 0) {
        return [...ausentes, ...familyOptions];
    }
    return familyOptions;
  }, [editing, familyOptions]);
  const brandOptionsForEditing = useMemo(() => {
    const options = productBrands.map((brand) => brand.name.trim()).filter(Boolean);
    const currentBrand = editing?.brand.trim() ?? "";
    if (currentBrand && !options.includes(currentBrand)) {
      return [currentBrand, ...options];
    }
    return options;
  }, [editing, productBrands]);

  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  useEffect(() => {
    setPreviewMode("catalog");
  }, [editingKey]);

  useEffect(() => {
    if (!editing) {
      setPreviewOpen(false);
    }
  }, [editing, editingKey]);

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
      editing.brand !== initialEditing.brand ||
      editing.type !== initialEditing.type ||
      editing.families.join("|") !== initialEditing.families.join("|") ||
      editing.stockInput !== initialEditing.stockInput ||
      editing.active !== initialEditing.active ||
      editing.priceInput !== initialEditing.priceInput ||
      editing.compareAtPriceInput !== initialEditing.compareAtPriceInput ||
      editing.productCode !== initialEditing.productCode ||
      editing.image_urls.join("\u0001") !== initialEditing.image_urls.join("\u0001")
    );
  }, [editing, initialEditing]);

  const visibleProducts = useMemo(() => {
    let products = [...filteredProducts];

    // Categoria e subcategoria entram primeiro: elas restringem o conjunto, e os
    // filtros abaixo (promocao, destaque, pendencia) atuam dentro dele.
    if (filtroTipo) {
      products = products.filter((product) => (product.type ?? "").trim() === filtroTipo);
    }
    if (filtroFamilia) {
      products = products.filter((product) => produtoTemSubcategoria(product, filtroFamilia));
    }

    if (productListFilter === "promotions") {
      return products.filter((product) => product.is_promotion);
    }
    if (productListFilter === "featured") {
      return products.filter((product) => product.is_featured);
    }
    if (productListFilter !== "all" && productListFilter !== "best_sellers") {
      return products.filter((product) => productIssues(product).includes(productListFilter));
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
  }, [filteredProducts, filtroFamilia, filtroTipo, productListFilter, salesByProductId]);

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

  const refreshBrands = async () => {
    await queryClient.invalidateQueries({ queryKey: ["product-brands"] });
  };

  const addFamily = async () => {
    const name = newFamily.trim();
    if (!name) {
      toast.error("Informe o nome da subcategoria.");
      return;
    }

    if (familyOptions.some((option) => option.toLowerCase() === name.toLowerCase())) {
      toast.error("Já existe uma subcategoria com esse nome.");
      return;
    }

    const { error } = await supabase.from(PRODUCT_FAMILIES_TABLE).insert({ name } as never);
    if (error) {
      console.error("Erro ao adicionar subcategoria", error);
      toast.error("Erro ao adicionar subcategoria.");
      return;
    }

    setNewFamily("");
    toast.success("Subcategoria adicionada.");
    await refreshFamilies();
  };

  const deleteFamily = async (family: ProductFamily) => {
    const usage = familyUsage.get(makeProductFamilyKey(family.name)) ?? 0;
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
    await refreshFamilies();
  };

  const addBrand = async () => {
    const name = newBrand.trim();
    if (!name) {
      toast.error("Informe o nome da marca.");
      return;
    }

    if (productBrands.some((brand) => brand.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Já existe uma marca com esse nome.");
      return;
    }

    const { error } = await supabase
      .from(PRODUCT_BRANDS_TABLE)
      .insert({ name, sort_order: productBrands.length + 1 } as never);
    if (error) {
      console.error("Erro ao adicionar marca", error);
      toast.error("Erro ao adicionar marca.");
      return;
    }

    setNewBrand("");
    toast.success("Marca adicionada.");
    await refreshBrands();
  };

  const deleteBrand = async (brand: ProductBrand) => {
    const usage = brandUsage.get(brand.name.toLowerCase()) ?? 0;
    if (usage > 0) {
      toast.error("Reatribua os produtos dessa marca antes de removê-la.");
      return;
    }

    const { error } = await supabase.from(PRODUCT_BRANDS_TABLE).delete().eq("id", brand.id);
    if (error) {
      console.error("Erro ao remover marca", error);
      toast.error("Erro ao remover marca.");
      return;
    }

    toast.success("Marca removida.");
    await refreshBrands();
  };

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Produtos"
        title={title}
        description="Pesquise, atualize e cadastre produtos sem sair da mesma tela."
        actions={
          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[0.6875rem] text-primary">
            {visibleProducts.length} produto(s)
          </Badge>
        }
      />

      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Categorias do catálogo
            </p>
            <p className="text-sm text-foreground">Crie e remova as categorias principais usadas no seletor dos produtos.</p>
            <p className="text-xs text-muted-foreground">
              A exclusão remove apenas a opção da lista, não altera os produtos já salvos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1 text-[0.6875rem] font-medium">
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
                const ativo = filtroTipo === type.name.trim();
                return (
                  <ChipDeCategoria
                    key={type.id}
                    nome={type.name}
                    quantidade={count}
                    ativo={ativo}
                    onFiltrar={() => setFiltroTipo(ativo ? null : type.name.trim())}
                    rotuloRemover={`Remover categoria ${type.name}`}
                    tituloRemover="Remover categoria"
                    descricaoRemover={
                      /**
                       * O texto muda conforme a categoria tenha produtos, e a
                       * diferenca e real — nao e enfeite.
                       *
                       * A loja monta a lista de categorias a partir do `type` de
                       * cada produto, e nao desta tabela. Com produtos dentro,
                       * apagar aqui **nao tira a categoria do site**: ela
                       * reaparece derivada deles. Foi exatamente isso que o time
                       * de design viveu antes de perguntar como remover.
                       *
                       * Sem produtos, nao ha de onde derivar, e apagar some
                       * mesmo. Dizer a mesma coisa nos dois casos deixaria um
                       * dos dois errado.
                       */
                      <>
                        <span className="block">Deseja remover a categoria "{type.name}"?</span>
                        {count > 0 ? (
                          <>
                            <span className="mt-2 block text-muted-foreground">
                              Isso tira a opção do seletor de cadastro. Os {count} produto(s) continuam com o
                              tipo salvo — e por isso a categoria <strong className="font-medium text-foreground">continua
                              aparecendo na loja</strong>.
                            </span>
                            <span className="mt-2 block text-muted-foreground">
                              Para sumir com ela da loja sem mexer nos produtos, use o botão de olho no chip.
                            </span>
                          </>
                        ) : (
                          <span className="mt-2 block text-muted-foreground">
                            Nenhum produto usa esta categoria, então ela sai do seletor e também da loja.
                          </span>
                        )}
                      </>
                    }
                    onRemover={() => onDeleteType(type.id)}
                    visivelNaLoja={type.visivel !== false}
                    onAlternarVisibilidade={
                      onToggleTypeVisivel
                        ? () => onToggleTypeVisivel(type.id, type.visivel === false)
                        : undefined
                    }
                  />
                );
              })
            ) : (
              <div className="rounded-full border border-dashed border-border/70 px-4 py-2 text-xs text-muted-foreground">
                Nenhuma categoria cadastrada
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Subcategorias do catálogo
            </p>
            <p className="text-sm text-foreground">
              Descrevem o que o produto é: Camomila, Creatina, Whey.
            </p>
            <p className="text-xs text-muted-foreground">
              A mesma subcategoria serve qualquer categoria — cadastre uma vez só. Remova apenas
              depois de reatribuir os produtos que ainda a usam.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1 text-[0.6875rem] font-medium">
              {productFamilies.length} subcategoria(s)
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <Input
            placeholder="Nova subcategoria"
            value={newFamily}
            onChange={(e) => setNewFamily(e.target.value)}
            className="h-11 rounded-2xl border-border/70 bg-background"
          />

          <Button type="button" variant="outline" className="h-10 rounded-2xl px-4 text-sm" onClick={addFamily}>
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {productFamilies.length > 0 ? (
            productFamilies.map((family) => {
              const count = familyUsage.get(makeProductFamilyKey(family.name)) ?? 0;
              const ativo = filtroFamilia === family.name.trim();
              return (
                <ChipDeCategoria
                  key={family.id}
                  nome={family.name}
                  quantidade={count}
                  ativo={ativo}
                  onFiltrar={() => setFiltroFamilia(ativo ? null : family.name.trim())}
                  rotuloRemover={`Remover subcategoria ${family.name}`}
                  tituloRemover="Remover subcategoria"
                  descricaoRemover={
                    <>
                      <span className="block">Deseja remover a subcategoria "{family.name}"?</span>
                      <span className="mt-2 block text-muted-foreground">
                        {count > 0
                          ? `Ela está em uso por ${count} produto(s). Reatribua antes de excluir.`
                          : "Essa ação remove apenas a opção da lista administrativa."}
                      </span>
                    </>
                  }
                  onRemover={() => deleteFamily(family)}
                />
              );
            })
          ) : (
            <div className="rounded-full border border-dashed border-border/70 px-4 py-2 text-xs text-muted-foreground">
              Nenhuma subcategoria cadastrada
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Marcas do catálogo
            </p>
            <p className="text-sm text-foreground">Quem assina o produto: Chá Mais, Clinic Mais.</p>
            <p className="text-xs text-muted-foreground">
              A marca é independente da categoria — a mesma marca pode ter chá, cápsula e solúvel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1 text-[0.6875rem] font-medium">
              {productBrands.length} marca(s)
            </Badge>
            {productsWithoutBrand > 0 ? (
              <Badge className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[0.6875rem] font-medium text-amber-800">
                {productsWithoutBrand} produto(s) sem marca
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <Input
            placeholder="Nova marca"
            value={newBrand}
            onChange={(e) => setNewBrand(e.target.value)}
            className="h-11 rounded-2xl border-border/70 bg-background"
          />

          <Button type="button" variant="outline" className="h-10 rounded-2xl px-4 text-sm" onClick={addBrand}>
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {productBrands.length > 0 ? (
            productBrands.map((brand) => {
              const count = brandUsage.get(brand.name.toLowerCase()) ?? 0;
              return (
                <ConfirmActionDialog
                  key={brand.id}
                  trigger={
                    <Button type="button" variant="secondary" className="h-10 sm:h-9 gap-2 rounded-full px-3 text-[0.8125rem] sm:text-xs">
                      <span className="max-w-[14rem] truncate">{brand.name}</span>
                      <Badge variant="outline" className="rounded-full border-border/70 px-2 py-0.5 text-[0.625rem]">
                        {count}
                      </Badge>
                    </Button>
                  }
                  title="Remover marca"
                  description={
                    <>
                      <span className="block">Deseja remover a marca "{brand.name}"?</span>
                      <span className="mt-2 block text-muted-foreground">
                        {count > 0
                          ? `Ela está em uso por ${count} produto(s). Reatribua antes de excluir.`
                          : "Essa ação remove apenas a opção da lista administrativa."}
                      </span>
                    </>
                  }
                  confirmLabel="Remover"
                  destructive
                  onConfirm={() => deleteBrand(brand)}
                />
              );
            })
          ) : (
            <div className="rounded-full border border-dashed border-border/70 px-4 py-2 text-xs text-muted-foreground">
              Nenhuma marca cadastrada
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="relative">
            <Input
              placeholder="Pesquisar produto (nome, família, tipo)"
              value={productSearch}
              onChange={(e) => onProductSearchChange(e.target.value)}
              className="h-11 rounded-2xl border-border/70 bg-background pr-20 text-[0.8125rem]"
            />
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[0.6875rem] font-medium text-muted-foreground">
              {visibleProducts.length} itens
            </div>
          </div>

          <Button onClick={onStartNew} className="h-10 rounded-2xl px-4 text-sm">
            <Plus className="h-4 w-4" />
            Novo produto
          </Button>
        </div>

        {/* Sem isto o filtro seria uma armadilha: a lista encolhe e nao ha nada
            na tela dizendo por que, nem como voltar. A faixa nomeia o recorte e
            carrega a saida. */}
        {filtroTipo || filtroFamilia ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="text-[0.8125rem] text-foreground">
              Mostrando{" "}
              <strong>
                {[filtroTipo, filtroFamilia].filter(Boolean).join(" · ")}
              </strong>{" "}
              — {visibleProducts.length} de {filteredProducts.length} produtos
            </span>
            <Button
              type="button"
              variant="ghost"
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => {
                setFiltroTipo(null);
                setFiltroFamilia(null);
              }}
            >
              Limpar filtro
            </Button>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={productListFilter === "all" ? "default" : "outline"}
            className="h-10 sm:h-9 rounded-full px-3 text-[0.8125rem] sm:text-xs"
            onClick={() => setProductListFilter("all")}
          >
            Todos
          </Button>
          <Button
            type="button"
            variant={productListFilter === "best_sellers" ? "default" : "outline"}
            className="h-10 sm:h-9 rounded-full px-3 text-[0.8125rem] sm:text-xs"
            onClick={() => setProductListFilter("best_sellers")}
          >
            <TrendingUp className="h-4 w-4" />
            Mais vendidos
          </Button>
          <Button
            type="button"
            variant={productListFilter === "promotions" ? "default" : "outline"}
            className="h-10 sm:h-9 rounded-full px-3 text-[0.8125rem] sm:text-xs"
            onClick={() => setProductListFilter("promotions")}
          >
            <Sparkles className="h-4 w-4" />
            Promoções
          </Button>
          <Button
            type="button"
            variant={productListFilter === "featured" ? "default" : "outline"}
            className="h-10 sm:h-9 rounded-full px-3 text-[0.8125rem] sm:text-xs"
            onClick={() => setProductListFilter("featured")}
          >
            <Star className="h-4 w-4" />
            Em destaque
          </Button>
        </div>

        {/* Fila de pendencias: mostra o que falta e leva direto para a lista. */}
        <div className="mt-3 border-t border-border/70 pt-3">
          <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Pendências de cadastro
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {ISSUE_FILTERS.map((filter) => {
              const count = issueCounts.get(filter.id) ?? 0;
              const isActive = productListFilter === filter.id;
              return (
                <Button
                  key={filter.id}
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  disabled={count === 0 && !isActive}
                  className={cn(
                    "h-10 gap-1.5 rounded-full px-3 text-[0.8125rem] sm:h-9 sm:text-xs",
                    !isActive && count > 0 && "border-amber-300 text-amber-800 hover:bg-amber-50",
                  )}
                  onClick={() => setProductListFilter(isActive ? "all" : filter.id)}
                >
                  {filter.label}
                  <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[0.625rem] leading-none">
                    {count}
                  </Badge>
                </Button>
              );
            })}
            {totalIssueCount === 0 ? (
              <span className="text-xs text-muted-foreground">Nenhuma pendência no catálogo.</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-foreground">Atualize status, fotos e dados internos com rapidez.</p>
          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[0.6875rem] text-primary">
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
                        <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                        {isEditing ? (
                          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[0.6875rem]">
                            Em edição
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.type} · {p.family}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.product_code ? (
                          <Badge variant="outline" className="rounded-full px-2.5 py-0.5 font-mono text-[0.6875rem]">
                            {p.product_code}
                          </Badge>
                        ) : null}
                        {p.is_promotion ? (
                          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[0.6875rem] text-primary">
                            Promoção
                          </Badge>
                        ) : null}
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium",
                            typeof p.stock === "number" && p.stock > 0
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-red-200 bg-red-50 text-red-700",
                          )}
                        >
                          {typeof p.stock === "number" && p.stock > 0 ? "Em estoque" : "Sem estoque"}
                        </Badge>
                        <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[0.6875rem]">
                          {p.active ? "Ativo" : "Inativo"}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[0.6875rem]">
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
        <DialogContent className={cn(MODAL_TELA_CHEIA, "max-h-[92dvh] w-[min(98vw,1720px)] max-w-[1720px] overflow-hidden rounded-[1.75rem] border-border/70 p-0")}>
          <div className={cn("flex max-h-[92dvh] flex-col overflow-hidden", MODAL_TELA_CHEIA_CORPO)}>
            <DialogHeader className="border-b border-border/70 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3 pr-10 sm:pr-12">
                <div className="space-y-1 text-left">
                  <DialogTitle className="text-left text-lg font-semibold tracking-tight text-foreground">
                    {isNew ? "Novo Produto" : "Editar Produto"}
                  </DialogTitle>
                  <DialogDescription className="text-left text-[0.8125rem] text-muted-foreground">
                    Ajuste os dados do produto sem ocupar a tela inteira do admin
                  </DialogDescription>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-full px-4 text-sm"
                  onClick={() => setPreviewOpen(true)}
                  disabled={!editing}
                >
                  <Eye className="h-4 w-4" />
                  Ver preview
                </Button>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {editing ? (
                <AdminProductForm
                  editing={editing}
                  typeOptions={typeOptions}
                  familyOptions={familyOptionsForEditing}
                  brandOptions={brandOptionsForEditing}
                  uploading={uploading}
                  fileInputRef={fileInputRef}
                  onChange={onEditChange}
                  onFileChange={onFileChange}
                  onRemoveImageAt={onRemoveImageAt}
                  onMoveImageAt={onMoveImageAt}
                  onImageAltChange={onImageAltChange}
                  onSave={onSave}
                  onCancel={requestClose}
                  className="border-0 bg-transparent p-0 shadow-none"
                />
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={previewOpen && Boolean(editing)}
        onOpenChange={(open) => setPreviewOpen(open)}
      >
        <DialogContent className={cn(MODAL_TELA_CHEIA, "max-h-[92dvh] w-[min(96vw,1460px)] max-w-[1460px] overflow-hidden rounded-[1.75rem] border-border/70 p-0")}>
          <div className={cn("flex max-h-[92dvh] flex-col overflow-hidden", MODAL_TELA_CHEIA_CORPO)}>
            <DialogHeader className="border-b border-border/70 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3 pr-10 sm:pr-12">
                <div className="space-y-1 text-left">
                  <DialogTitle className="text-left text-lg font-semibold tracking-tight text-foreground">
                    Pré-visualização do produto
                  </DialogTitle>
                  <DialogDescription className="text-left text-[0.8125rem] text-muted-foreground">
                    Veja como o produto fica no catálogo e na página aberta.
                  </DialogDescription>
                </div>

                <div className="inline-flex rounded-full border border-border/70 bg-background p-1">
                  <Button
                    type="button"
                    variant={previewMode === "catalog" ? "default" : "ghost"}
                    className="h-10 rounded-full px-3 text-xs"
                    onClick={() => setPreviewMode("catalog")}
                  >
                    Catálogo
                  </Button>
                  <Button
                    type="button"
                    variant={previewMode === "details" ? "default" : "ghost"}
                    className="h-10 rounded-full px-3 text-xs"
                    onClick={() => setPreviewMode("details")}
                  >
                    Aberto
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/15 p-4 sm:p-5">
              <div className={`flex min-h-0 justify-center ${previewMode === "catalog" ? "items-center" : "items-start"}`}>
                <AdminProductPreview editing={editing} mode={previewMode} />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent className="rounded-[1.5rem] border-border/70">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle className="text-base font-semibold tracking-tight text-foreground">
              Sair sem salvar
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[0.8125rem] leading-6 text-muted-foreground">
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
