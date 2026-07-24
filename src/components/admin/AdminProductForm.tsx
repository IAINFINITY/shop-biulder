import { type ChangeEvent, type RefObject } from "react";
import { Save, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { ProductImageCarouselEditor } from "@/components/admin/ProductImageCarouselEditor";
import { ADMIN_TEXT_LIMITS, countRichTextCharacters } from "@/lib/adminTextLimits";
import { normalizePriceInputDraft } from "@/lib/formatMoney";
import { cn } from "@/lib/utils";
import { useCustomerTypes } from "@/hooks/useCustomerTypes";
import type { AdminProductFormState } from "./adminTypes";

type ProductTypeOption = string;

type AdminProductFormProps = {
  editing: AdminProductFormState;
  className: string;
  typeOptions: ProductTypeOption[];
  familyOptions: string[];
  uploading: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onChange: (next: AdminProductFormState) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemoveImageAt: (index: number) => Promise<void>;
  onMoveImageAt: (from: number, to: number) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function AdminProductForm({
  editing,
  className,
  typeOptions,
  familyOptions,
  uploading,
  fileInputRef,
  onChange,
  onFileChange,
  onRemoveImageAt,
  onMoveImageAt,
  onSave,
  onCancel,
}: AdminProductFormProps) {
  const { options: customerTypeOptions } = useCustomerTypes();
  const saveLabel = editing.id ? "Salvar alterações" : "Adicionar produto";

  return (
    <div
      className={cn(
        "rounded-[1.5rem] border border-border/70 bg-background p-4 shadow-[0_12px_32px_rgba(16,24,40,0.08)]",
        className,
      )}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="product-name" className="text-[13px] font-medium">
              Nome do produto
            </Label>
            <p className="text-[11px] text-muted-foreground">
              {editing.name.length}/{ADMIN_TEXT_LIMITS.products.name} caracteres
            </p>
          </div>
          <Input
            id="product-name"
            placeholder="Nome do produto"
            value={editing.name}
            onChange={(e) => onChange({ ...editing, name: e.target.value })}
            maxLength={ADMIN_TEXT_LIMITS.products.name}
            className="h-11 rounded-2xl border-border/70 bg-background"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="product-type" className="text-[13px] font-medium">
            Categoria
          </Label>
          <Select value={editing.type} onValueChange={(v) => onChange({ ...editing, type: v, family: "" })}>
            <SelectTrigger id="product-type" className="h-11 w-full rounded-2xl border-border/70 bg-background text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="product-family" className="text-[13px] font-medium">
            Subcategoria
          </Label>
          <p className="text-[11px] leading-5 text-muted-foreground">
            Depende da categoria selecionada.
          </p>
          <Select
            value={editing.family}
            onValueChange={(v) => onChange({ ...editing, family: v })}
            disabled={!editing.type}
          >
            <SelectTrigger id="product-family" className="h-11 w-full rounded-2xl border-border/70 bg-background text-[13px]">
              <SelectValue
                placeholder={
                  editing.type
                    ? familyOptions.length > 0
                      ? "Selecione uma subcategoria"
                      : "Cadastre subcategorias para esta categoria"
                    : "Escolha uma categoria primeiro"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {familyOptions.map((family) => (
                <SelectItem key={family} value={family}>
                  {family}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {editing.type && familyOptions.length === 0 ? (
            <p className="text-[11px] leading-5 text-muted-foreground">
              Não há subcategorias cadastradas para essa categoria.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="product-description" className="text-[13px] font-medium">
            Texto da descrição
          </Label>
          <p className="text-[11px] text-muted-foreground">
            {countRichTextCharacters(editing.description)}/{ADMIN_TEXT_LIMITS.products.description} caracteres
          </p>
        </div>
        <RichTextEditor
          value={editing.description}
          onChange={(html) => onChange({ ...editing, description: html })}
          placeholder="Descreva o produto..."
        />
        <p className="text-[11px] leading-5 text-muted-foreground">
          O texto fica mais legível quando a descrição é direta e objetiva.
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:items-stretch">
        <div className="flex h-full flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="product-code" className="text-[13px] font-medium">
              Código do produto
            </Label>
            <p className="text-[11px] text-muted-foreground">
              {editing.productCode.length}/{ADMIN_TEXT_LIMITS.products.code} caracteres
            </p>
          </div>
          <Input
            id="product-code"
            placeholder="Ex: CHA-001"
            value={editing.productCode}
            onChange={(e) => onChange({ ...editing, productCode: e.target.value.toUpperCase() })}
            maxLength={ADMIN_TEXT_LIMITS.products.code}
            className="h-11 rounded-2xl border-border/70 bg-background font-mono"
          />
          <p className="min-h-[2.5rem] text-[11px] leading-5 text-muted-foreground">Uso interno para pedidos e exportações</p>
        </div>

        <div className="flex h-full flex-col gap-2">
          <Label htmlFor="product-price" className="text-[13px] font-medium">
            Preço (R$)
          </Label>
          <Input
            id="product-price"
            type="text"
            inputMode="decimal"
            placeholder="Ex: 49,90"
            value={editing.priceInput}
            onChange={(e) =>
              onChange({
                ...editing,
                priceInput: normalizePriceInputDraft(e.target.value),
              })
            }
            className="h-11 rounded-2xl border-border/70 bg-background"
          />
          <p className="min-h-[2.5rem] text-[11px] leading-5 text-muted-foreground">
            Use vírgula ou ponto para centavos. O valor precisa ser maior que zero.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:max-w-[18rem]">
        <Label htmlFor="product-stock" className="text-[13px] font-medium">
          Estoque
        </Label>
        <Input
          id="product-stock"
          type="text"
          inputMode="numeric"
          placeholder="Ex: 120"
          value={editing.stockInput}
          onChange={(e) => onChange({ ...editing, stockInput: e.target.value.replace(/[^0-9]/g, "") })}
          className="h-11 rounded-2xl border-border/70 bg-background"
        />
        <p className="text-[11px] leading-5 text-muted-foreground">
          Deixe em branco para não exibir quantidade. Use número inteiro.
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Destaque promocional
              </p>
              <p className="text-sm text-foreground">Exibir no bloco Promoções da home. O produto também precisa estar ativo.</p>
            </div>
            <Switch
              checked={editing.is_promotion}
              onCheckedChange={(checked) => onChange({ ...editing, is_promotion: checked })}
              className="scale-95 origin-center"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Visível para
            </p>
            <p className="text-sm text-foreground">Selecione quais tipos de cliente podem ver este produto no catálogo. Se nenhum for marcado, fica visível para todos.</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          {customerTypeOptions.map((type) => {
            const checked = editing.visible_to.includes(type.name);
            return (
              <label key={type.name} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(checkedState) => {
                    const isChecked = checkedState === true;
                    onChange({
                      ...editing,
                      visible_to: isChecked
                        ? [...editing.visible_to, type.name]
                        : editing.visible_to.filter((t) => t !== type.name),
                    });
                  }}
                  className="h-4 w-4 border-primary data-[state=checked]:bg-primary"
                />
                {type.label}
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <ProductImageCarouselEditor
          urls={editing.image_urls}
          uploading={uploading}
          fileInputRef={fileInputRef}
          onFileChange={onFileChange}
          onRemoveAt={onRemoveImageAt}
          onMoveAt={onMoveImageAt}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Switch checked={editing.active} onCheckedChange={(v) => onChange({ ...editing, active: v })} />
        <Label className="text-[13px] font-medium">{editing.active ? "Ativo no catálogo" : "Inativo"}</Label>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <ConfirmActionDialog
          trigger={
            <Button type="button" className="h-10 gap-2 rounded-2xl px-4 text-sm">
              <Save className="h-4 w-4" />
              {saveLabel}
            </Button>
          }
          title={editing.id ? "Salvar alterações" : "Adicionar produto"}
          description={
            editing.id
              ? "Confirme para salvar as alterações desse produto no catálogo."
              : "Confirme para adicionar esse novo produto ao catálogo."
          }
          confirmLabel={editing.id ? "Salvar" : "Adicionar"}
          onConfirm={onSave}
        />
        <Button onClick={onCancel} variant="outline" className="h-10 gap-2 rounded-2xl px-4 text-sm">
          <X className="h-4 w-4" />
          Cancelar
        </Button>
      </div>
    </div>
  );
}
