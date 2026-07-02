import { type LucideIcon, FlaskConical, ImageIcon, Leaf, Pill, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductDescription } from "@/components/catalogo/ProductDescription";
import { formatBRL, parsePriceInput } from "@/lib/formatMoney";
import { cn } from "@/lib/utils";
import type { AdminProductFormState } from "./adminTypes";

type AdminProductPreviewProps = {
  editing: AdminProductFormState | null;
  mode?: "catalog" | "details";
};

const typeIcons: Record<string, LucideIcon> = {
  Chá: Leaf,
  Cápsula: Pill,
  Solúvel: FlaskConical,
};

const typeColors: Record<string, string> = {
  Chá: "bg-success/10 text-success border-success/20",
  Cápsula: "bg-warm/10 text-warm border-warm/20",
  Solúvel: "bg-primary/10 text-primary border-primary/20",
};

function ProductImage({ src, alt }: { src: string; alt: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain object-center transition-transform duration-300"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-3">
      <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
    </div>
  );
}

function CatalogPreview({
  editing,
  productName,
  productType,
  productFamily,
  coverUrl,
  displayPrice,
}: {
  editing: AdminProductFormState | null;
  productName: string;
  productType: string;
  productFamily: string;
  coverUrl: string;
  displayPrice: string;
}) {
  const TypeIcon = typeIcons[editing?.type || ""] || Leaf;
  const hasDescription = Boolean(editing?.description?.trim());

  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[1.5rem] border border-border/70 bg-background p-3 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
      <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-border bg-card transition-all duration-300">
        <div className="aspect-[4/3] overflow-hidden border-b border-border/70 bg-background p-3 sm:p-4">
          <ProductImage src={coverUrl} alt={productName} />
        </div>

        <div className="flex flex-1 flex-col px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className={cn(typeColors[productType] || "", "text-xs font-medium")}>
              <TypeIcon className="mr-1 h-3 w-3" />
              {productType}
            </Badge>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {productFamily}
            </Badge>
            {editing?.is_promotion ? (
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-primary">
                Promoção
              </Badge>
            ) : null}
          </div>

          <h3 className="line-clamp-2 min-h-[3.25rem] text-base font-semibold leading-tight text-card-foreground sm:text-[1.05rem]">
            {productName}
          </h3>

          <div className="mt-2 min-h-[3.5rem]">
            {hasDescription ? (
              <ProductDescription
                html={editing?.description || ""}
                plainPreview
                lineClamp={2}
                className="text-sm leading-6 text-muted-foreground"
              />
            ) : (
              <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                Descreva o produto para visualizar exatamente como ele vai aparecer no catálogo.
              </p>
            )}
          </div>

          <p className="mt-3 mb-1 text-base font-semibold tabular-nums text-foreground sm:text-lg">{displayPrice}</p>
        </div>

        <div className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
          <Button type="button" disabled className="h-10 w-full gap-1.5 text-xs sm:text-sm" size="sm">
            <Plus className="h-4 w-4" />
            <span>Adicionar ao carrinho</span>
          </Button>
        </div>
      </article>
    </div>
  );
}

function ExpandedPreview({
  editing,
  productName,
  productType,
  productFamily,
  coverUrl,
  displayPrice,
}: {
  editing: AdminProductFormState | null;
  productName: string;
  productType: string;
  productFamily: string;
  coverUrl: string;
  displayPrice: string;
}) {
  const TypeIcon = typeIcons[editing?.type || ""] || Leaf;
  const description = editing?.description?.trim();
  const productCode = editing?.productCode?.trim();

  return (
    <div className="w-full max-w-[920px] rounded-[1.5rem] border border-border/70 bg-background p-3 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)] xl:items-stretch">
        <div className="overflow-hidden rounded-[1.25rem] border border-border bg-card">
          <div className="border-b border-border/70 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Pré-visualização aberta
                </p>
                <p className="text-[11px] leading-none text-muted-foreground">Como o cliente vê ao abrir o produto</p>
              </div>
              <Badge variant="outline" className="rounded-full border-border/70 bg-background text-[10px] font-medium">
                Detalhes
              </Badge>
            </div>
          </div>

          <div className="flex min-h-[440px] items-center justify-center bg-background p-5 sm:min-h-[520px] sm:p-8">
            <div className="flex w-full max-w-[540px] items-center justify-center">
              <ProductImage src={coverUrl} alt={productName} />
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <div className="rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={cn(typeColors[productType] || "", "text-xs font-medium")}>
                <TypeIcon className="mr-1 h-3 w-3" />
                {productType}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {productFamily}
              </Badge>
              {editing?.is_promotion ? (
                <Badge variant="outline" className="text-xs border-primary/20 bg-primary/5 text-primary">
                  Promoção
                </Badge>
              ) : null}
              {productCode ? (
                <Badge variant="outline" className="text-xs">
                  Código {productCode}
                </Badge>
              ) : null}
            </div>

            <div className="mt-4 space-y-2">
              <h3 className="text-[1.4rem] font-black leading-tight tracking-[-0.04em] text-card-foreground sm:text-[1.65rem]">
                {productName}
              </h3>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Visualização expandida
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Preço</p>
                <p className="text-3xl font-semibold text-primary tabular-nums">{displayPrice}</p>
              </div>

              <Button type="button" disabled className="h-11 gap-2 rounded-2xl px-4 text-sm">
                <Plus className="h-4 w-4" />
                Adicionar ao carrinho
              </Button>
            </div>
          </div>

          <div className="grid gap-3 rounded-[1.5rem] border border-border/70 bg-background p-4 shadow-sm sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Tipo</p>
              <p className="mt-1 text-sm font-medium text-foreground">{productType}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Família</p>
              <p className="mt-1 text-sm font-medium text-foreground">{productFamily}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Preço</p>
              <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{displayPrice}</p>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-border/70 bg-background p-4 shadow-sm sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Descrição</p>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 text-sm leading-7 text-foreground/90">
              {description ? (
                <ProductDescription html={editing?.description || ""} className="text-sm leading-7 text-foreground/90" />
              ) : (
                <p className="text-muted-foreground">Sem descrição disponível para este produto.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminProductPreview({ editing, mode = "catalog" }: AdminProductPreviewProps) {
  const coverUrl = editing?.image_urls.find((url) => url.trim() !== "") ?? "";
  const priceValue = editing ? parsePriceInput(editing.priceInput) : 0;
  const displayPrice = formatBRL(Math.max(0, Number.isFinite(priceValue) ? priceValue : 0));
  const productName = editing?.name?.trim() || "Nome do produto";
  const productType = editing?.type?.trim() || "Tipo";
  const productFamily = editing?.family?.trim() || "Família";

  return mode === "details" ? (
    <ExpandedPreview
      editing={editing}
      productName={productName}
      productType={productType}
      productFamily={productFamily}
      coverUrl={coverUrl}
      displayPrice={displayPrice}
    />
  ) : (
    <CatalogPreview
      editing={editing}
      productName={productName}
      productType={productType}
      productFamily={productFamily}
      coverUrl={coverUrl}
      displayPrice={displayPrice}
    />
  );
}
