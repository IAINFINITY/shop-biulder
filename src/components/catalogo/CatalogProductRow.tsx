import { Eye, Heart, ImageIcon, Plus, Star } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductDescription } from "@/components/catalogo/ProductDescription";
import { ProductImageFrame } from "@/components/catalogo/ProductImageFrame";
import { ProductPriceTag } from "@/components/catalogo/ProductPriceTag";
import { StockBadge } from "@/components/catalogo/StockBadge";
import { useTopSellers } from "@/hooks/useTopSellers";
import { formatBRL } from "@/lib/formatMoney";
import { highlightBadgeClassName, highlightForProduct } from "@/lib/productHighlights";
import {
  caminhoDoProduto,
  getProductImageAlt,
  getProductImageUrls,
  getProductUnitPrice,
  type Product,
} from "@/lib/products";
import { cn } from "@/lib/utils";

/**
 * O produto em linha — a visão de quem repõe estoque.
 *
 * ## O que a linha mostra, e por quê
 *
 * A pesquisa de catálogo B2B descreve a linha como uma planilha: **miniatura
 * pequena, código, marca, nome, preço e a ação**, tudo alinhado em colunas para
 * o olho descer a lista comparando o mesmo campo. É o contrário da grade, que
 * põe a foto no comando.
 *
 * O código do produto ganhou destaque de propósito: é por ele que o pedido é
 * conferido com o ERP, e na grade ele não aparecia em lugar nenhum. Quem liga
 * para o atendimento diz "o 7161", não "o dos cinco óleos".
 *
 * ## O alinhamento é a razão de existir
 *
 * Preço e estoque ficam numa coluna de largura fixa à direita, com
 * `tabular-nums`. Se cada linha calculasse a própria largura, os valores
 * dançariam de linha para linha e a comparação — o motivo de usar lista —
 * deixaria de funcionar.
 */

export type CatalogProductRowProps = {
  product: Product;
  price: number;
  /** Preco sem promocao, para a etiqueta desenhar o "de". Ver `ProductPriceTag`. */
  precoBase: number;
  onAdd: (product: Product) => void;
  inCart: boolean;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
  onQuickView?: () => void;
};

export function CatalogProductRow({
  product,
  price,
  precoBase,
  onAdd,
  inCart,
  isWishlisted,
  onToggleWishlist,
  onQuickView,
}: CatalogProductRowProps) {
  const { idsMaisVendidos } = useTopSellers();
  const highlight = highlightForProduct(product, idsMaisVendidos);
  const coverUrl = getProductImageUrls(product)[0];
  const displayPrice = Number.isFinite(price ?? Number.NaN) ? (price as number) : getProductUnitPrice(product);
  const codigo = (product.product_code ?? "").trim();

  return (
    <article className="group relative flex gap-3 rounded-xl bg-background/80 p-3 ring-1 ring-black/5 transition-all duration-200 hover:ring-black/10 hover:shadow-[0_6px_18px_rgba(16,24,40,0.05)] sm:gap-4 sm:p-4">
      {/* A miniatura é pequena de propósito: na lista ela serve para reconhecer
          o que já se conhece, não para decidir a compra. */}
      <Link
        to={caminhoDoProduto(product)}
        viewTransition
        className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        tabIndex={-1}
        aria-hidden
      >
        {coverUrl ? (
          <ProductImageFrame
            src={coverUrl}
            alt={getProductImageAlt(product, 0)}
            fit={product.image_fit}
            width={320}
            height={320}
            loading="lazy"
            className="h-20 w-20 rounded-lg sm:h-24 sm:w-24"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted/20 sm:h-24 sm:w-24">
            <ImageIcon className="h-7 w-7 text-muted-foreground/30" />
          </div>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* O código vem primeiro: é a chave de quem confere pedido. */}
            {codigo ? (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
                {codigo}
              </span>
            ) : null}
            <span className="truncate text-[0.6875rem] font-medium text-muted-foreground">
              {product.brand ? `${product.brand} · ${product.type}` : product.type}
            </span>
            {highlight ? (
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full px-2 py-0 text-[0.625rem] font-semibold uppercase leading-4 tracking-[0.14em]",
                  highlightBadgeClassName(highlight.tone),
                )}
              >
                {highlight.label}
              </Badge>
            ) : null}
          </div>

          <h3 className="mt-1 text-sm font-semibold leading-snug text-card-foreground">
            <Link
              to={caminhoDoProduto(product)}
              viewTransition
              className="line-clamp-2 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {product.name}
            </Link>
          </h3>

          {product.review_count > 0 ? (
            <div className="mt-1 flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={cn(
                      "h-3 w-3",
                      s <= Math.round(product.average_rating) ? "fill-warm text-warm" : "fill-muted text-muted",
                    )}
                  />
                ))}
              </div>
              <span className="text-[0.6875rem] tabular-nums text-muted-foreground">
                {product.average_rating.toFixed(1)} ({product.review_count})
              </span>
            </div>
          ) : null}

          {/* Uma linha só: na lista, a descrição é contexto, não argumento —
              quem quer o texto inteiro abre o produto. */}
          <ProductDescription
            html={product.description}
            plainPreview
            lineClamp={1}
            className="mt-1 hidden text-[0.6875rem] leading-4 text-muted-foreground/80 sm:block"
          />
        </div>

        {/* ⚠️ Largura fixa. É o que mantém os preços numa coluna reta de cima a
            baixo — se cada linha se dimensionasse pelo próprio conteúdo, os
            valores dançariam e a comparação, que é o motivo da lista, morreria. */}
        <div className="flex shrink-0 items-end justify-between gap-3 sm:w-[13.5rem] sm:flex-col sm:items-end sm:justify-start sm:gap-2">
          <div className="sm:text-right">
            <ProductPriceTag product={product} precoBase={precoBase} price={displayPrice} size="sm" />
            <StockBadge stock={product.stock} className="mt-1" />
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {onQuickView ? (
              <button
                type="button"
                onClick={onQuickView}
                aria-label={`Prévia de ${product.name}`}
                title="Prévia"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
              >
                <Eye className="h-4 w-4" />
              </button>
            ) : null}
            {onToggleWishlist ? (
              <button
                type="button"
                onClick={onToggleWishlist}
                aria-label={isWishlisted ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                  isWishlisted ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-primary",
                )}
              >
                <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} />
              </button>
            ) : null}
            <Button
              type="button"
              onClick={() => onAdd(product)}
              variant={inCart ? "secondary" : "default"}
              size="sm"
              className="h-9 gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-medium transition-all active:scale-95 [&_svg]:size-4"
              aria-label={inCart ? `${product.name} já está no carrinho` : `Adicionar ${product.name} ao carrinho`}
            >
              <Plus className="shrink-0" />
              <span className="hidden sm:inline">{inCart ? "No carrinho" : "Adicionar"}</span>
              <span className="sr-only sm:hidden">{inCart ? "No carrinho" : `Adicionar por ${formatBRL(displayPrice)}`}</span>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
