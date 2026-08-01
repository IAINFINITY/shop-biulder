import { useMemo, useState } from "react";
import { ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CatalogProductCard } from "@/components/catalogo/CatalogProductCard";
import { ProductDescription } from "@/components/catalogo/ProductDescription";
import { ProductMediaGallery } from "@/components/catalogo/ProductMediaGallery";
import { ProductInfoPanel } from "@/components/catalogo/ProductInfoPanel";
import { StockBadge } from "@/components/catalogo/StockBadge";
import { buildPreviewProduct } from "@/lib/adminPreviewProduct";
import { formatBRL } from "@/lib/formatMoney";
import { getProductDiscount, getProductImageUrls, getProductUnitPrice } from "@/lib/products";
import { isRichTextEmpty } from "@/lib/richTextPure";
import { TEXT } from "@/lib/typography";
import { cn } from "@/lib/utils";
import type { AdminProductFormState } from "./adminTypes";

type AdminProductPreviewProps = {
  editing: AdminProductFormState | null;
  mode?: "catalog" | "details";
};

/**
 * Previa do produto, montada com os componentes da propria vitrine.
 *
 * A versao anterior reproduzia o card e a pagina do produto a mao — mais de 400
 * linhas de marcacao paralela que precisavam ser atualizadas junto com o
 * catalogo. Como isso nao acontecia, o preview passou a mostrar uma loja que nao
 * existe mais: tipografia antiga, botao com outro texto, foto com outro
 * enquadramento.
 *
 * Aqui a previa do catalogo e o proprio `CatalogProductCard`, e a da pagina do
 * produto usa a mesma moldura, a mesma descricao e a mesma escala tipografica.
 * Divergir deixou de ser possivel.
 */
export function AdminProductPreview({ editing, mode = "catalog" }: AdminProductPreviewProps) {
  const product = useMemo(() => buildPreviewProduct(editing), [editing]);
  const [selectedImage, setSelectedImage] = useState(0);

  if (!product) {
    return (
      <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-background px-6 py-14 text-center">
        <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <p className={cn(TEXT.compact, "mt-3 text-muted-foreground")}>
          Preencha o formulário para ver a prévia.
        </p>
      </div>
    );
  }

  const price = getProductUnitPrice(product);
  const discount = getProductDiscount(product, price);
  const gallery = getProductImageUrls(product);

  if (mode === "catalog") {
    return (
      <div className="space-y-3">
        <p className={cn(TEXT.caption, "text-muted-foreground")}>
          É assim que o produto aparece na grade do catálogo.
        </p>
        {/* Largura da coluna do catalogo (257px no maior breakpoint): fora dela
            o card estica e a previa deixa de responder "cabe?".

            O clique e barrado porque o card e um link de verdade: sem isso, um
            clique curioso tira quem esta editando de dentro do formulario. O
            hover continua funcionando, que e parte do que se quer conferir. */}
        <div className="mx-auto w-full max-w-[257px]" onClickCapture={(event) => event.preventDefault()}>
          <CatalogProductCard
            product={product}
            price={price}
            onAdd={() => undefined}
            inCart={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className={cn(TEXT.caption, "text-muted-foreground")}>
        É assim que a página do produto se monta.
      </p>

      {/* Mesma divisao de colunas da pagina do produto (34rem para a midia),
          e o mesmo bloco de fotos. O que muda e so a escala do container. */}
      {/* Mesma divisao de colunas da pagina do produto, e os mesmos dois
          componentes. Sem `actions`, o painel entende que esta numa previa:
          os controles aparecem no lugar certo, desabilitados. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        <ProductMediaGallery
          product={product}
          urls={gallery}
          selectedIndex={selectedImage}
          onSelect={setSelectedImage}
        />

        <ProductInfoPanel
          product={product}
          price={price}
          averageRating={product.average_rating}
          reviewCount={product.review_count}
        />
      </div>

      <div className="rounded-[1.35rem] border border-border/70 bg-background p-4 sm:p-5">
        <p className={cn(TEXT.label, "text-muted-foreground")}>Descrição do produto</p>
        <div className="mt-3">
          {isRichTextEmpty(product.description) ? (
            <p className={cn(TEXT.compact, "text-muted-foreground")}>Sem descrição preenchida.</p>
          ) : (
            <ProductDescription html={product.description} />
          )}
        </div>
      </div>
    </div>
  );
}
