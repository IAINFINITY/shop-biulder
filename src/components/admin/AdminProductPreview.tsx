import { useEffect, useMemo, useState } from "react";
import { type LucideIcon, ChevronLeft, ChevronRight, FlaskConical, GitCompare, Heart, ImageIcon, Leaf, Minus, Package, Pill, Plus, Share2, ShieldCheck, Star, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductDescription } from "@/components/catalogo/ProductDescription";
import { formatBRL, parsePriceInput } from "@/lib/formatMoney";
import { stripHtml } from "@/lib/richTextPure";
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

function buildPreviewBullets(description: string) {
  if (!description) return [];
  return description
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);
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
  priceValue,
}: {
  editing: AdminProductFormState | null;
  productName: string;
  productType: string;
  productFamily: string;
  coverUrl: string;
  priceValue: number;
}) {
  const TypeIcon = typeIcons[editing?.type || ""] || Leaf;
  const descriptionHtml = editing?.description?.trim() ?? "";
  const descriptionText = useMemo(() => stripHtml(descriptionHtml).replace(/\s+/g, " ").trim(), [descriptionHtml]);
  const summaryBullets = useMemo(() => buildPreviewBullets(descriptionText), [descriptionText]);
  const productCode = editing?.productCode?.trim();
  const galleryUrls = useMemo(() => editing?.image_urls.filter((url) => url.trim() !== "") ?? [], [editing?.image_urls]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setSelectedImageIndex(0);
    setQuantity(1);
  }, [editing?.id, galleryUrls.length]);

  const selectedImage = galleryUrls[selectedImageIndex] ?? galleryUrls[0] ?? coverUrl;
  const selectedTotalPrice = priceValue * quantity;
  const selectedPixPrice = selectedTotalPrice * 0.9;
  const selectedInstallmentPrice = selectedTotalPrice / 10;

  return (
    <div className="w-full max-w-[1360px] rounded-[1.5rem] border border-border/70 bg-background p-3 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] xl:items-start">
        <div className="self-start xl:sticky xl:top-5">
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm">
              <div className="flex min-h-[520px] items-center justify-center bg-background p-5 sm:min-h-[620px] sm:p-8">
                {selectedImage ? (
                  <div className="group relative flex h-full w-full cursor-zoom-in items-center justify-center">
                    <img
                      src={selectedImage}
                      alt={productName}
                      className="h-full max-h-[560px] w-full max-w-[620px] object-contain object-center"
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-end justify-start p-5 opacity-100 xl:opacity-0 xl:transition-opacity xl:duration-150 xl:group-hover:opacity-100">
                      <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/95 px-3 py-2 text-[11px] font-medium text-foreground shadow-sm">
                        <ImageIcon className="h-4 w-4 text-primary" />
                        Clique para ampliar
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-background p-8">
                    <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            </div>

            <div className="hidden xl:flex items-center justify-center gap-4 py-1">
              <button
                type="button"
                onClick={() => setSelectedImageIndex((index) => Math.max(0, index - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:text-primary disabled:opacity-30"
                disabled={galleryUrls.length <= 1 || selectedImageIndex <= 0}
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setSelectedImageIndex((index) => Math.min(galleryUrls.length - 1, index + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:text-primary disabled:opacity-30"
                disabled={galleryUrls.length <= 1 || selectedImageIndex >= galleryUrls.length - 1}
                aria-label="Próxima imagem"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {galleryUrls.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-0 [scrollbar-width:none]">
                {galleryUrls.map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    className={cn(
                      "h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-background p-1.5 shadow-sm transition-all",
                      index === selectedImageIndex ? "border-primary ring-2 ring-primary/20" : "border-border/70 hover:border-primary/40",
                    )}
                    aria-label={`Ver imagem ${index + 1}`}
                  >
                    <img src={src} alt="" className="h-full w-full rounded-lg object-contain" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="space-y-2 p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={cn(typeColors[productType] || "", "text-xs font-medium")}>
                      <TypeIcon className="mr-1 h-3 w-3" />
                      {productType}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {productFamily}
                    </Badge>
                    {editing?.is_promotion ? <Badge className="bg-primary text-primary-foreground text-xs font-semibold">Promoção</Badge> : null}
                    {productCode ? (
                      <Badge variant="outline" className="text-xs">
                        Código {productCode}
                      </Badge>
                    ) : null}
                  </div>

                  <CardTitle className="text-xl leading-tight tracking-tight sm:text-2xl">{productName}</CardTitle>
                </div>

                <div className="flex flex-wrap justify-end gap-2 lg:pt-1">
                  <Button type="button" disabled variant="outline" size="sm" className="gap-2 rounded-full">
                    <Heart className="h-3.5 w-3.5" />
                    Favoritar
                  </Button>
                  <Button type="button" disabled variant="outline" size="sm" className="gap-2 rounded-full">
                    <GitCompare className="h-3.5 w-3.5" />
                    Comparar
                  </Button>
                  <Button type="button" disabled variant="outline" size="sm" className="gap-2 rounded-full">
                    <Share2 className="h-3.5 w-3.5" />
                    Compartilhar
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <div className="flex items-center gap-0.5 text-amber-400">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-3.5 w-3.5 fill-current text-amber-400" />
                  ))}
                </div>
                <span className="font-semibold text-foreground tabular-nums">(0)</span>
                <span className="text-muted-foreground">Sem avaliações</span>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-3 xl:grid-cols-2 xl:items-stretch">
            <Card className="overflow-hidden border-border/70 shadow-sm">
              <CardContent className="flex h-full flex-col p-4 sm:p-5">
                <div className="flex items-center gap-2 pb-3">
                  <Package className="h-4 w-4 text-primary" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Sobre o produto</p>
                  <span className="ml-auto rounded-full border border-border/60 bg-card px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Resumo rápido
                  </span>
                </div>

                <div className="flex flex-1 flex-col rounded-2xl border border-border/60 bg-card p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Sobre o produto</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                    {(summaryBullets.length > 0 ? summaryBullets : [descriptionText || "Descrição indisponível."]).map((item, index) => (
                      <li key={`${index}-${item}`} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/70 shadow-sm">
              <CardContent className="flex h-full flex-col p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Preço</p>
                    <p className="text-3xl font-semibold leading-none text-foreground tabular-nums">{formatBRL(selectedTotalPrice)}</p>
                    <p className="text-sm font-medium text-foreground tabular-nums">{formatBRL(selectedPixPrice)}</p>
                    <p className="text-sm text-muted-foreground">
                      Total para {quantity} unidade{quantity === 1 ? "" : "s"}.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatBRL(selectedTotalPrice)} em até 10x de {formatBRL(selectedInstallmentPrice)} sem juros ou 1x com 10% de desconto no cartão
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Estoque</p>
                    <div className="mt-2 flex justify-end">
                      <Badge variant="outline" className="rounded-full border-border/70 bg-background text-xs font-medium text-muted-foreground">
                        Consulte cadastro
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center rounded-xl border border-border/60 bg-card px-3 py-2 text-[11px] text-muted-foreground">
                  <Truck className="mr-2 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>Frete e prazo são confirmados na finalização do pedido.</span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center rounded-full border border-border/60 bg-background shadow-sm">
                    <button
                      type="button"
                      onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                      disabled={quantity <= 1}
                      className="flex h-8 w-8 items-center justify-center rounded-l-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="flex h-8 min-w-[2rem] items-center justify-center text-sm font-semibold tabular-nums text-foreground">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((current) => current + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-r-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Pagamento seguro</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <Button disabled className="h-10 gap-1.5 text-sm w-full">
                    Comprar agora
                  </Button>
                  <Button disabled variant="outline" className="h-10 gap-1.5 text-sm w-full">
                    <Plus className="h-4 w-4" />
                    Adicionar ao carrinho
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      <div className="mt-4 w-full rounded-[1.5rem] border border-border/70 bg-background p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Descrição do produto</p>
        <div className="mt-3 w-full text-sm leading-7 text-foreground/90">
          {descriptionHtml ? (
            <ProductDescription html={descriptionHtml} className="w-full text-sm leading-7 text-foreground/90" />
          ) : (
            <p className="text-muted-foreground">Sem descrição disponível para este produto.</p>
          )}
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
      priceValue={Math.max(0, Number.isFinite(priceValue) ? priceValue : 0)}
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
