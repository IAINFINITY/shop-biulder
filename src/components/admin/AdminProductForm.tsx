import { useMemo, type ChangeEvent, type ReactNode, type RefObject } from "react";
import { AlertTriangle, CheckCircle2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { PRODUCT_DESCRIPTION_PROSE } from "@/lib/productDescriptionStyles";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { ProductImageCarouselEditor } from "@/components/admin/ProductImageCarouselEditor";
import { ADMIN_TEXT_LIMITS, countRichTextCharacters } from "@/lib/adminTextLimits";
import { normalizePriceInputDraft, parsePriceInput } from "@/lib/formatMoney";
import { aplicarPromocao, motivoParaNaoDestacar, podeDestacarEmPromocao } from "@/lib/promocao";
import { TEXT } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { isRichTextEmpty } from "@/lib/richTextPure";
import { useCustomerTypes } from "@/hooks/useCustomerTypes";
import { useProxisItemCheck } from "@/hooks/useProxisItemCheck";
import type { AdminProductFormState } from "./adminTypes";

type ProductTypeOption = string;

// Radix Select nao aceita item com value vazio, entao "sem marca" precisa de um
// valor sentinela que nunca colide com um nome real de marca.
const NO_BRAND_VALUE = "__sem_marca__";

const inputClass = "h-11 rounded-2xl border-border/70 bg-background";

/**
 * Bloco nomeado do formulario.
 *
 * O formulario era uma lista corrida de doze campos, todos no mesmo nivel, com
 * uma frase de ajuda embaixo de quase todos. Quem chegava para trocar um preco
 * lia sobre marca, subcategoria e visibilidade no caminho. Agrupado, cada
 * assunto vira um bloco que se pode pular de olho.
 */
function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-border/60 pt-5 first:border-t-0 first:pt-0">
      <div className="mb-3">
        <h3 className={cn(TEXT.label, "text-muted-foreground")}>{title}</h3>
        {description ? (
          <p className={cn(TEXT.compact, "mt-1 leading-5 text-muted-foreground")}>{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Campo com rotulo.
 *
 * `hint` so quando o campo nao se explica: "Quem assina o produto" embaixo de
 * "Marca" ocupa uma linha para dizer o que o rotulo ja disse.
 */
function Field({
  id,
  label,
  hint,
  counter,
  className,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  counter?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className={cn(TEXT.compact, "font-medium")}>
          {label}
        </Label>
        {counter ? <span className={cn(TEXT.caption, "tabular-nums text-muted-foreground")}>{counter}</span> : null}
      </div>
      {children}
      {hint ? <p className={cn(TEXT.caption, "leading-5 text-muted-foreground")}>{hint}</p> : null}
    </div>
  );
}

type AdminProductFormProps = {
  editing: AdminProductFormState;
  className: string;
  typeOptions: ProductTypeOption[];
  familyOptions: string[];
  brandOptions: string[];
  uploading: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onChange: (next: AdminProductFormState) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemoveImageAt: (index: number) => Promise<void>;
  onMoveImageAt: (from: number, to: number) => void;
  onImageAltChange: (index: number, alt: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function AdminProductForm({
  editing,
  className,
  typeOptions,
  familyOptions,
  brandOptions,
  uploading,
  fileInputRef,
  onChange,
  onFileChange,
  onRemoveImageAt,
  onMoveImageAt,
  onImageAltChange,
  onSave,
  onCancel,
}: AdminProductFormProps) {
  const { options: customerTypeOptions } = useCustomerTypes();

  // Promocao marcada sem valor anterior utilizavel: ou vazio, ou menor/igual ao
  // preco atual (nesse caso a normalizacao descarta e nao vira desconto).
  /**
   * Previa do desconto, com a **mesma** funcao que a loja usa.
   *
   * Recalcular aqui por conta propria seria a regra escrita duas vezes — e a
   * previa passaria a divergir da vitrine no dia em que uma das duas mudasse.
   */
  /** O percentual como numero, ou nulo quando o campo esta vazio. */
  const percentualDigitado =
    editing.promoPercentInput.trim() === "" ? null : parsePriceInput(editing.promoPercentInput);
  const podeDestacarPromocao = podeDestacarEmPromocao({ promo_percent: percentualDigitado });
  const motivoSemDestaque = motivoParaNaoDestacar({ promo_percent: percentualDigitado });

  const previaPromocao = (() => {
    const base = parsePriceInput(editing.priceInput);
    const resultado = aplicarPromocao(base, {
      promo_percent: percentualDigitado,
      promo_starts_at: editing.promoStartsAtInput.trim() === "" ? null : editing.promoStartsAtInput,
      promo_ends_at: editing.promoEndsAtInput.trim() === "" ? null : editing.promoEndsAtInput,
    });
    if (!resultado) return null;
    return {
      deCatalogo: resultado.de.toFixed(2).replace(".", ","),
      porCatalogo: resultado.por.toFixed(2).replace(".", ","),
      percent: resultado.percent,
    };
  })();

  // Produto sem cadastro no ERP e descartado em silencio no pedido: o cliente
  // pede cinco itens e o Proxis recebe quatro. Conferir aqui evita o problema na
  // origem, enquanto ainda da para corrigir.
  const proxisCheck = useProxisItemCheck(editing.productCode);
  const saveLabel = editing.id ? "Salvar alterações" : "Adicionar produto";

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!editing.name.trim()) missing.push("Nome");
    if (!editing.brand.trim()) missing.push("Marca");
    if (!editing.family.trim()) missing.push("Subcategoria");
    if (isRichTextEmpty(editing.description)) missing.push("Descrição");
    if (!editing.productCode.trim()) missing.push("Código");
    if (parsePriceInput(editing.priceInput) <= 0) missing.push("Preço");
    if (proxisCheck.data?.found === false) missing.push("Código sem cadastro no Proxis");
    if (editing.image_urls.length === 0) missing.push("Foto");
    else if (!editing.image_alts.some((alt) => alt.trim())) missing.push("Descrição da foto");
    return missing;
  }, [editing, proxisCheck.data]);

  // Nove pendencias rastreadas, incluindo a correspondencia no Proxis.
  const TRACKED_FIELDS = 9;
  const completeness = Math.round(((TRACKED_FIELDS - missingFields.length) / TRACKED_FIELDS) * 100);

  return (
    <div
      className={cn(
        "rounded-[1.5rem] border border-border/70 bg-background p-4 shadow-[0_12px_32px_rgba(16,24,40,0.08)] sm:p-5",
        className,
      )}
    >
      {/* Score de completude no nivel do item, como fazem os PIM: o que falta
          neste produto fica visivel antes de salvar, e nao so na lista. */}
      <div className="mb-5 rounded-2xl border border-border/70 bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={cn(TEXT.label, "text-muted-foreground")}>Preenchimento</p>
          <span
            className={cn(
              TEXT.compact,
              "font-semibold tabular-nums",
              missingFields.length === 0 ? "text-emerald-700" : "text-amber-800",
            )}
          >
            {completeness}%
          </span>
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/60">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              missingFields.length === 0 ? "bg-emerald-500" : "bg-amber-500",
            )}
            style={{ width: `${completeness}%` }}
          />
        </div>

        {missingFields.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {missingFields.map((field) => (
              <span
                key={field}
                className={cn(TEXT.caption, "rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800")}
              >
                {field}
              </span>
            ))}
          </div>
        ) : (
          <p className={cn(TEXT.compact, "mt-2 text-emerald-700")}>Tudo preenchido.</p>
        )}
      </div>

      <div className="space-y-5">
        <FormSection title="Identificação">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="product-name"
              label="Nome do produto"
              counter={`${editing.name.length}/${ADMIN_TEXT_LIMITS.products.name}`}
              className="sm:col-span-2"
            >
              <Input
                id="product-name"
                placeholder="Como aparece no catálogo"
                value={editing.name}
                onChange={(e) => onChange({ ...editing, name: e.target.value })}
                maxLength={ADMIN_TEXT_LIMITS.products.name}
                className={inputClass}
              />
            </Field>

            <Field id="product-brand" label="Marca">
              <Select
                value={editing.brand || NO_BRAND_VALUE}
                onValueChange={(v) => onChange({ ...editing, brand: v === NO_BRAND_VALUE ? "" : v })}
              >
                <SelectTrigger id="product-brand" className={cn(inputClass, "w-full", TEXT.compact)}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BRAND_VALUE}>Sem marca</SelectItem>
                  {brandOptions.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field id="product-code" label="Código" hint="Liga o produto ao cadastro no Proxis e à foto enviada em lote.">
              <Input
                id="product-code"
                placeholder="Ex: 12336"
                value={editing.productCode}
                onChange={(e) => onChange({ ...editing, productCode: e.target.value.toUpperCase() })}
                maxLength={ADMIN_TEXT_LIMITS.products.code}
                className={cn(
                  inputClass,
                  "font-mono",
                  proxisCheck.data?.found === false && "border-amber-400 focus-visible:ring-amber-400/30",
                )}
              />
              {editing.productCode.trim() ? (
                <p className={cn(TEXT.caption, "flex items-start gap-1.5 leading-5")}>
                  {proxisCheck.isFetching ? (
                    <span className="text-muted-foreground">Conferindo no Proxis…</span>
                  ) : proxisCheck.data?.found === true ? (
                    <span className="inline-flex items-start gap-1.5 text-emerald-700">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0">Existe no Proxis: {proxisCheck.data.description}</span>
                    </span>
                  ) : proxisCheck.data?.found === false ? (
                    <span className="inline-flex items-start gap-1.5 text-amber-800">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0">
                        Não existe no Proxis. Se ficar ativo, este item será descartado do pedido do cliente.
                      </span>
                    </span>
                  ) : (
                    // `found: null` e "nao deu para saber", nao "nao existe":
                    // barrar aqui reprovaria um cadastro correto so porque o ERP
                    // estava fora do ar.
                    <span className="text-muted-foreground">Não foi possível conferir no Proxis agora.</span>
                  )}
                </p>
              ) : null}
            </Field>

            {/* Trocar a categoria nao limpa a subcategoria: a mesma subcategoria
                serve qualquer categoria desde 31/07/2026. */}
            <Field id="product-type" label="Categoria" hint="Como o produto é consumido.">
              <Select value={editing.type} onValueChange={(v) => onChange({ ...editing, type: v })}>
                <SelectTrigger id="product-type" className={cn(inputClass, "w-full", TEXT.compact)}>
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
            </Field>

            <Field id="product-family" label="Subcategoria" hint="O que o produto é.">
              <Select value={editing.family} onValueChange={(v) => onChange({ ...editing, family: v })}>
                <SelectTrigger id="product-family" className={cn(inputClass, "w-full", TEXT.compact)}>
                  <SelectValue
                    placeholder={
                      familyOptions.length > 0 ? "Selecione" : "Nenhuma cadastrada ainda"
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
            </Field>
          </div>
        </FormSection>

        <FormSection title="Fotos">
          <ProductImageCarouselEditor
            urls={editing.image_urls}
            alts={editing.image_alts}
            imageFit={editing.image_fit}
            uploading={uploading}
            fileInputRef={fileInputRef}
            onFileChange={onFileChange}
            onRemoveAt={onRemoveImageAt}
            onMoveAt={onMoveImageAt}
            onAltChange={onImageAltChange}
            onImageFitChange={(fit) => onChange({ ...editing, image_fit: fit })}
          />
        </FormSection>

        <FormSection title="Descrição">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="product-description" className={cn(TEXT.compact, "font-medium")}>
                Texto que aparece na página do produto
              </Label>
              <span className={cn(TEXT.caption, "tabular-nums text-muted-foreground")}>
                {countRichTextCharacters(editing.description)}/{ADMIN_TEXT_LIMITS.products.description}
              </span>
            </div>
            <RichTextEditor
              value={editing.description}
              onChange={(html) => onChange({ ...editing, description: html })}
              placeholder="Descreva o produto..."
              contentClassName={PRODUCT_DESCRIPTION_PROSE}
            />
            <p className={cn(TEXT.caption, "leading-5 text-muted-foreground")}>
              <strong className="font-medium text-foreground">Enter</strong> começa uma linha nova.{" "}
              <strong className="font-medium text-foreground">Enter duas vezes</strong> abre uma linha em
              branco. <strong className="font-medium text-foreground">Backspace</strong> no início da
              linha desfaz, um passo por vez.
            </p>
          </div>
        </FormSection>

        <FormSection title="Preço e estoque">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="product-price" label="Preço (R$)" hint="Vírgula ou ponto para centavos.">
              <Input
                id="product-price"
                type="text"
                inputMode="decimal"
                placeholder="49,90"
                value={editing.priceInput}
                onChange={(e) => onChange({ ...editing, priceInput: normalizePriceInputDraft(e.target.value) })}
                className={inputClass}
              />
            </Field>

            {/* Promocao percentual, e nao preco promocional fixo.

                Com tabela por cliente (TPR), um valor cravado pode ficar acima
                do que o distribuidor ja paga — a "promocao" viraria aumento.
                Percentual incide sobre a base de cada um, entao o desconto e
                real para todos. Ver `src/lib/promocao.ts`. */}
            <Field
              id="product-promo-percent"
              label="Desconto da promoção (%)"
              hint={
                previaPromocao
                  ? `Catálogo R$ ${previaPromocao.deCatalogo} → R$ ${previaPromocao.porCatalogo}. Quem tem tabela própria recebe os mesmos ${previaPromocao.percent}% sobre o preço dele.`
                  : "Percentual sobre o preço que cada cliente já pagaria. Vazio = sem promoção."
              }
            >
              <Input
                id="product-promo-percent"
                type="text"
                inputMode="decimal"
                placeholder="15"
                value={editing.promoPercentInput}
                onChange={(e) => {
                  const promoPercentInput = normalizePriceInputDraft(e.target.value);
                  const digitado = promoPercentInput.trim() === "" ? null : parsePriceInput(promoPercentInput);
                  onChange({
                    ...editing,
                    promoPercentInput,
                    // Apagar o desconto desliga o destaque na mesma acao. Deixar
                    // a chave ligada e o campo vazio seria o formulario segurando
                    // um estado que a regra proibe — e o erro so apareceria no
                    // salvar, depois de a pessoa achar que estava feito.
                    is_promotion: editing.is_promotion && podeDestacarEmPromocao({ promo_percent: digitado }),
                  });
                }}
                className={inputClass}
              />
            </Field>

            <Field
              id="product-promo-starts"
              label="Início da promoção"
              hint="Vazio = vale desde já."
            >
              <Input
                id="product-promo-starts"
                type="datetime-local"
                value={editing.promoStartsAtInput}
                onChange={(e) => onChange({ ...editing, promoStartsAtInput: e.target.value })}
                className={inputClass}
              />
            </Field>

            <Field
              id="product-promo-ends"
              label="Fim da promoção"
              hint={
                editing.promoPercentInput.trim() !== "" && editing.promoEndsAtInput.trim() === ""
                  ? "Sem data de fim a promoção fica no ar até alguém remover."
                  : "A promoção sai do ar sozinha nesta data."
              }
            >
              <Input
                id="product-promo-ends"
                type="datetime-local"
                value={editing.promoEndsAtInput}
                onChange={(e) => onChange({ ...editing, promoEndsAtInput: e.target.value })}
                className={inputClass}
              />
            </Field>

            <Field id="product-stock" label="Estoque" hint="Vazio = não mostra quantidade.">
              <Input
                id="product-stock"
                type="text"
                inputMode="numeric"
                placeholder="120"
                value={editing.stockInput}
                onChange={(e) => onChange({ ...editing, stockInput: e.target.value.replace(/[^0-9]/g, "") })}
                className={inputClass}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Publicação">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3">
              <div className="min-w-0">
                <p className={cn(TEXT.body, "font-medium text-foreground")}>
                  {editing.active ? "Ativo no catálogo" : "Inativo"}
                </p>
                <p className={cn(TEXT.caption, "mt-0.5 text-muted-foreground")}>
                  Produto inativo não aparece na loja.
                </p>
              </div>
              <Switch checked={editing.active} onCheckedChange={(v) => onChange({ ...editing, active: v })} />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3">
              <div className="min-w-0">
                <p className={cn(TEXT.body, "font-medium text-foreground")}>Destaque em Promoções</p>
                <p id="promo-destaque-motivo" className={cn(TEXT.caption, "mt-0.5 text-muted-foreground")}>
                  {motivoSemDestaque ?? "Entra no carrossel de promoções da home. Precisa estar ativo."}
                </p>
              </div>
              <Switch
                checked={editing.is_promotion && podeDestacarPromocao}
                disabled={!podeDestacarPromocao}
                aria-describedby={motivoSemDestaque ? "promo-destaque-motivo" : undefined}
                onCheckedChange={(checked) =>
                  onChange({ ...editing, is_promotion: checked && podeDestacarPromocao })
                }
              />
            </div>

            {/* Separado de promocao de proposito: promocao e sobre preco
                reduzido, destaque e escolha editorial. Um produto pode ser os
                dois, um so, ou nenhum. */}
            <div className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3">
              <div className="min-w-0">
                <p className={cn(TEXT.body, "font-medium text-foreground")}>Em destaque</p>
                <p className={cn(TEXT.caption, "mt-0.5 text-muted-foreground")}>
                  Entra no carrossel &ldquo;Em destaque&rdquo; da home. Precisa estar ativo.
                </p>
              </div>
              <Switch
                checked={editing.is_featured}
                onCheckedChange={(checked) => onChange({ ...editing, is_featured: checked })}
              />
            </div>

            <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3">
              <p className={cn(TEXT.body, "font-medium text-foreground")}>Visível para</p>
              <p className={cn(TEXT.caption, "mt-0.5 text-muted-foreground")}>
                Sem nenhum marcado — ou com todos marcados — o produto aparece para qualquer visitante. Marque
                alguns para restringir só a eles.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                {customerTypeOptions.map((type) => (
                  <label
                    key={type.name}
                    className={cn(TEXT.compact, "flex cursor-pointer items-center gap-2 text-foreground")}
                  >
                    <Checkbox
                      checked={editing.visible_to.includes(type.name)}
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
                ))}
              </div>
            </div>
          </div>
        </FormSection>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-border/60 pt-5">
        <ConfirmActionDialog
          trigger={
            <Button type="button" className={cn(TEXT.compact, "h-10 gap-2 rounded-full px-4")}>
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
        <Button onClick={onCancel} variant="outline" className={cn(TEXT.compact, "h-10 gap-2 rounded-full px-4")}>
          <X className="h-4 w-4" />
          Cancelar
        </Button>
      </div>
    </div>
  );
}
