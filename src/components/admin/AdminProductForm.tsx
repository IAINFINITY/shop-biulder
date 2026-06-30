import { type ChangeEvent, type RefObject } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { ProductImageCarouselEditor } from "@/components/admin/ProductImageCarouselEditor";
import { normalizePriceInputDraft } from "@/lib/formatMoney";
import { cn } from "@/lib/utils";
import type { AdminProductFormState } from "./adminTypes";

type ProductTypeOption = string;

type AdminProductFormProps = {
  editing: AdminProductFormState;
  className: string;
  typeOptions: ProductTypeOption[];
  newType: string;
  onNewTypeChange: (value: string) => void;
  adminTypes: Array<{ id: string; name: string }>;
  uploading: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onChange: (next: AdminProductFormState) => void;
  onAddType: () => void;
  onDeleteType: (id: string) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemoveImageAt: (index: number) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function AdminProductForm({
  editing,
  className,
  typeOptions,
  newType,
  onNewTypeChange,
  adminTypes,
  uploading,
  fileInputRef,
  onChange,
  onAddType,
  onDeleteType,
  onFileChange,
  onRemoveImageAt,
  onSave,
  onCancel,
}: AdminProductFormProps) {
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
          <Label htmlFor="product-name" className="text-[13px] font-medium">
            Nome do produto
          </Label>
          <Input
            id="product-name"
            placeholder="Nome do produto"
            value={editing.name}
            onChange={(e) => onChange({ ...editing, name: e.target.value })}
            className="h-11 rounded-2xl border-border/70 bg-background"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="product-family" className="text-[13px] font-medium">
            Família
          </Label>
          <Input
            id="product-family"
            placeholder="Ex: Detox, Beleza, Chá"
            value={editing.family}
            onChange={(e) => onChange({ ...editing, family: e.target.value })}
            className="h-11 rounded-2xl border-border/70 bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-code" className="text-[13px] font-medium">
            Código do produto
          </Label>
          <Input
            id="product-code"
            placeholder="Ex: CHA-001"
            value={editing.productCode}
            onChange={(e) => onChange({ ...editing, productCode: e.target.value.toUpperCase() })}
            className="h-11 rounded-2xl border-border/70 bg-background font-mono"
          />
          <p className="text-[11px] leading-5 text-muted-foreground">Uso interno para pedidos e exportações</p>
        </div>

        <div className="space-y-2">
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
          <p className="text-[11px] leading-5 text-muted-foreground">Use vírgula ou ponto para centavos</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="product-description" className="text-[13px] font-medium">
          Texto da descrição
        </Label>
        <RichTextEditor
          value={editing.description}
          onChange={(html) => onChange({ ...editing, description: html })}
          placeholder="Descreva o produto..."
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Select value={editing.type} onValueChange={(v) => onChange({ ...editing, type: v })}>
          <SelectTrigger className="h-11 w-full rounded-2xl border-border/70 bg-background text-[13px] sm:w-56">
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
        <div className="flex min-w-[240px] flex-1 items-center gap-2">
          <Input
            placeholder="Novo tipo"
            value={newType}
            onChange={(e) => onNewTypeChange(e.target.value)}
            className="h-11 flex-1 rounded-2xl border-border/70 bg-background text-[13px]"
          />
          <Button type="button" size="sm" variant="outline" onClick={onAddType} className="h-11 rounded-2xl px-4 text-sm">
            Adicionar
          </Button>
        </div>
      </div>

      {adminTypes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {adminTypes.map((t) => (
            <ConfirmActionDialog
              key={t.id}
              trigger={
                <Button type="button" variant="secondary" size="sm" className="h-8 gap-2 rounded-full px-3 text-[12px]">
                  {t.name}
                  <X className="h-3 w-3" />
                </Button>
              }
              title="Remover tipo"
              description={`Deseja remover o tipo "${t.name}" Essa ação altera a organização do catálogo.`}
              confirmLabel="Remover"
              destructive
              onConfirm={() => onDeleteType(t.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-4">
        <ProductImageCarouselEditor
          urls={editing.image_urls}
          uploading={uploading}
          fileInputRef={fileInputRef}
          onFileChange={onFileChange}
          onRemoveAt={onRemoveImageAt}
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
