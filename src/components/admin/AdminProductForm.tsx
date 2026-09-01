import { useMemo, useState, type ChangeEvent, type ReactNode, type RefObject } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Save, Sparkles, X } from "lucide-react";
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
import { isRichTextEmpty, stripHtml } from "@/lib/richTextPure";
import { useCustomerTypes } from "@/hooks/useCustomerTypes";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";
import { MAX_ITENS, MIN_ITENS, resumoParaTexto } from "@/lib/resumoDeProduto";
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
  const [gerandoResumo, setGerandoResumo] = useState(false);

  /**
   * Pede o resumo a rota e coloca no campo — **sem salvar**.
   *
   * O texto chega como rascunho: quem esta editando le, corrige e so entao
   * grava. E o unico ponto do fluxo em que uma pessoa ve o texto antes de ele
   * virar conteudo publico, e para suplemento isso nao e conforto — a regra da
   * ANVISA proibe alegacao de cura, tratamento ou prevencao, e a validacao do
   * servidor pega o termo obvio, nao a insinuacao.
   */
  const gerarResumo = async () => {
    setGerandoResumo(true);
    try {
      const resposta = await apiFetch("/api/resumo-produto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing.name,
          description: editing.description,
          type: editing.type,
          brand: editing.brand,
        }),
      });
      const dados = (await resposta.json().catch(() => ({}))) as {
        itens?: string[];
        error?: string;
      };
      if (!resposta.ok || !dados.itens) {
        toast.error(dados.error ?? "Não foi possível gerar o resumo.");
        return;
      }
      onChange({ ...editing, aiSummaryInput: resumoParaTexto(dados.itens) });
      toast.success("Resumo gerado. Confira o texto antes de salvar.");
    } catch (error) {
      console.error("[admin] falha ao gerar resumo:", error);
      toast.error("Não foi possível falar com o servidor.");
    } finally {
      setGerandoResumo(false);
    }
  };

  // Descricao curta demais nao rende resumo, e a rota recusa. Barrar aqui evita
  // a ida ao servidor so para voltar com erro.
  const descricaoEmTexto = stripHtml(editing.description).trim();
  const podeGerarResumo = editing.name.trim().length > 0 && descricaoEmTexto.length >= 80;

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

  const saveLabel = editing.id ? "Salvar alterações" : "Adicionar produto";

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!editing.name.trim()) missing.push("Nome");
    if (!editing.brand.trim()) missing.push("Marca");
    if (editing.families.length === 0) missing.push("Subcategoria");
    if (isRichTextEmpty(editing.description)) missing.push("Descrição");
    if (!editing.productCode.trim()) missing.push("Código");
    if (parsePriceInput(editing.priceInput) <= 0) missing.push("Preço");
    if (editing.image_urls.length === 0) missing.push("Foto");
    else if (!editing.image_alts.some((alt) => alt.trim())) missing.push("Descrição da foto");
    return missing;
  }, [editing]);

  // As pendencias rastreadas do cadastro.
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

            <Field id="product-code" label="Código" hint="Identifica o produto na plataforma e liga com a foto enviada em lote.">
              <Input
                id="product-code"
                placeholder="Ex: 12336"
                value={editing.productCode}
                onChange={(e) => onChange({ ...editing, productCode: e.target.value.toUpperCase() })}
                maxLength={ADMIN_TEXT_LIMITS.products.code}
                className={cn(inputClass, "font-mono")}
              />
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

            {/* Selecao multipla: um produto pode pertencer a mais de uma
                subcategoria.

                A **ordem importa** — a primeira marcada vira a principal, que e
                a que aparece na etiqueta, na linha do pedido e no payload do
                ERP. Por isso marcar acrescenta no fim em vez de reordenar. */}
            <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3 md:col-span-2">
              <p className={cn(TEXT.body, "font-medium text-foreground")}>Subcategorias</p>
              <p className={cn(TEXT.caption, "mt-0.5 text-muted-foreground")}>
                {editing.families.length > 0
                  ? `Principal: ${editing.families[0]}. Marque outras para o produto aparecer também nos filtros delas.`
                  : "Marque uma ou mais. A primeira vira a principal, usada na etiqueta e no pedido."}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                {familyOptions.map((nome) => {
                  const marcada = editing.families.includes(nome);
                  const principal = editing.families[0] === nome;
                  return (
                    <label
                      key={nome}
                      className={cn(TEXT.compact, "flex cursor-pointer items-center gap-2 text-foreground")}
                    >
                      <Checkbox
                        checked={marcada}
                        onCheckedChange={(estado) => {
                          const marcar = estado === true;
                          onChange({
                            ...editing,
                            families: marcar
                              ? [...editing.families, nome]
                              : editing.families.filter((f) => f !== nome),
                          });
                        }}
                        className="h-4 w-4 border-primary data-[state=checked]:bg-primary"
                      />
                      <span className={cn(principal && "font-semibold text-primary")}>{nome}</span>
                    </label>
                  );
                })}
              </div>
            </div>
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

          {/* O resumo fica **junto da descricao**, e nao numa secao propria: ele e
              derivado dela, e separar os dois faria parecer que sao conteudos
              independentes — o resumo desatualizaria em silencio a cada edicao do
              texto de cima. */}
          <div className="space-y-2 border-t border-border/60 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <Label htmlFor="product-ai-summary" className={cn(TEXT.compact, "font-medium")}>
                  Resumo (card ao lado do preço)
                </Label>
                {/* De onde o texto vem, escrito na tela e nao so no codigo: quem
                    abre o formulario pela primeira vez precisa saber que o botao
                    le a descricao acima, e nao o catalogo ou a internet. Sem
                    isso, a origem do texto e adivinhacao. */}
                <p className={cn(TEXT.caption, "mt-0.5 text-muted-foreground")}>
                  Escrito por IA a partir da descrição acima. Nada é publicado sem você salvar.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={gerarResumo}
                disabled={!podeGerarResumo || gerandoResumo}
                className={cn(TEXT.compact, "h-9 gap-2 rounded-full px-3")}
              >
                {gerandoResumo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {gerandoResumo ? "Gerando…" : "Gerar com IA"}
              </Button>
            </div>
            <Textarea
              id="product-ai-summary"
              value={editing.aiSummaryInput}
              onChange={(e) => onChange({ ...editing, aiSummaryInput: e.target.value })}
              rows={5}
              placeholder={`Um item por linha, ${MIN_ITENS} a ${MAX_ITENS}. Vazio = o card usa as primeiras frases da descrição.`}
              className={cn(inputClass, "min-h-[7rem] resize-y py-2 leading-6")}
            />
            <p className={cn(TEXT.caption, "leading-5 text-muted-foreground")}>
              {podeGerarResumo
                ? `Um item por linha, ${MIN_ITENS} a ${MAX_ITENS} (o normal é ${MAX_ITENS}). Leia antes de salvar: o texto não pode prometer cura, tratamento ou emagrecimento, e deve manter as restrições da descrição — alérgeno, idade mínima, origem animal.`
                : "Preencha o nome e uma descrição com pelo menos 80 caracteres para liberar a geração."}
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
