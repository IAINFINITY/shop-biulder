import { Heart, Plus, Share2, ShieldCheck, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductSummaryCard } from "@/components/catalogo/ProductSummaryCard";
import { StarRating } from "@/components/catalogo/StarRating";
import { formatBRL } from "@/lib/formatMoney";
import { buildProductTags, getProductDiscount, type Product } from "@/lib/products";
import { cn } from "@/lib/utils";

/**
 * Coluna de informacao da pagina do produto: selos, nome, avaliacao, resumo e
 * bloco de preco.
 *
 * Mora aqui porque a previa do admin precisa mostrar exatamente isto. Enquanto
 * a previa remontava a coluna por conta propria, ela vivia atras: faltava o
 * resumo, o preco tinha outro tamanho, os selos vinham em outra ordem. Cada
 * ajuste no catalogo abria uma diferenca nova.
 *
 * A parte interativa entra por `actions`. Sem ela, o painel entende que esta
 * numa previa: os controles aparecem no lugar certo, com o mesmo tamanho, mas
 * desabilitados. E o mesmo componente nos dois lados — nao uma copia parecida.
 *
 * `buildProductTags` fica em `products.ts` para este arquivo exportar so o
 * componente — arquivo com componente e funcao junto quebra o Fast Refresh.
 */

export type ProductInfoActions = {
  quantity: number;
  onQuantityChange: (value: number) => void;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
  onShare: () => void;
  onBuyNow: () => void;
  onAddToCart: () => void;
  isInCart: boolean;
  /** Controle de quantidade da pagina, injetado para nao duplicar o componente. */
  quantityStepper: React.ReactNode;
};

export function ProductInfoPanel({
  product,
  price,
  averageRating,
  reviewCount,
  actions,
  fullDescriptionHref,
  className,
}: {
  product: Product;
  price: number;
  averageRating: number;
  reviewCount: number;
  /** Ausente = previa. */
  actions?: ProductInfoActions;
  fullDescriptionHref?: string;
  className?: string;
}) {
  const tags = buildProductTags(product);
  const discount = getProductDiscount(product, price);
  const quantity = actions?.quantity ?? 1;
  // Sem desconto embutido aqui.
  //
  // Este bloco aplicava 10% sobre o total e chamava o resultado de "preco a
  // vista". Esse desconto nao existia em lugar nenhum: carrinho, formulario de
  // pedido e exportacao para o ERP usam `resolveProductPrice` puro. Um produto
  // de R$ 4,84 aparecia por R$ 4,36 na pagina e voltava a R$ 4,84 no carrinho —
  // e era tambem por isso que o valor divergia do catalogo.
  const total = price * quantity;

  const stockLabel =
    typeof product.stock === "number"
      ? product.stock > 0
        ? "Em estoque"
        : "Sem estoque"
      : "Consulte disponibilidade";
  const stockToneClass =
    typeof product.stock === "number"
      ? product.stock > 0
        ? "border-success/20 bg-success/5 text-success"
        : "border-destructive/20 bg-destructive/5 text-destructive"
      : "border-border/70 bg-background text-muted-foreground";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-xl bg-background ring-1 ring-black/5">
        <div className="space-y-2 p-3 sm:p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-2">
            {/* Sem icone nos selos: dentro de um selo de texto ele vira enfeite
                e ainda desalinha a altura da linha. */}
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {product.is_promotion && (
                <Badge className="bg-primary text-xs font-semibold text-primary-foreground">Promoção</Badge>
              )}
              {tags.map((tag, index) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn(
                    "max-w-[12rem] truncate text-xs",
                    index === 0
                      ? "border-primary/25 bg-primary/5 font-semibold text-primary"
                      : "border-border/60 bg-background font-medium text-muted-foreground",
                  )}
                >
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="flex shrink-0 justify-end gap-1.5 sm:gap-2">
              <Button
                type="button"
                variant={actions?.isWishlisted ? "default" : "outline"}
                size="sm"
                disabled={!actions}
                className={cn(
                  "h-10 w-10 gap-0 rounded-full p-0 sm:w-auto sm:gap-2 sm:px-4",
                  actions?.isWishlisted && "bg-primary text-primary-foreground",
                )}
                onClick={actions?.onToggleWishlist}
                aria-pressed={actions?.isWishlisted}
                aria-label="Favoritar"
              >
                <Heart className={cn("h-3.5 w-3.5", actions?.isWishlisted && "fill-current")} />
                <span className="sr-only sm:not-sr-only">Favoritar</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!actions}
                className="h-10 w-10 gap-0 rounded-full p-0 sm:w-auto sm:gap-2 sm:px-4"
                onClick={actions?.onShare}
                aria-label="Compartilhar"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only">Compartilhar</span>
              </Button>
            </div>

            <h1 className="col-span-2 text-xl font-semibold leading-tight tracking-tight sm:text-2xl lg:col-span-1">
              {product.name}
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <StarRating rating={Math.round(averageRating)} size="sm" />
            <span className="font-semibold tabular-nums text-foreground">
              {reviewCount > 0 ? `(${reviewCount})` : "(0)"}
            </span>
            <span className="text-muted-foreground">
              {averageRating > 0 ? `${averageRating.toFixed(1)} de 5` : "Sem avaliações"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 2xl:grid-cols-2 2xl:items-stretch">
        <ProductSummaryCard description={product.description} fullDescriptionHref={fullDescriptionHref} />

        <div className="overflow-hidden rounded-xl bg-background ring-1 ring-black/5">
          <div className="flex h-full flex-col p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Preço</p>
                {discount ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="line-through tabular-nums">{formatBRL(discount.from * quantity)}</span>
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                      -{discount.percent}%
                    </span>
                  </p>
                ) : null}
                <p className="text-3xl font-semibold leading-none tabular-nums text-foreground">
                  {formatBRL(total)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Total para {quantity} unidade{quantity === 1 ? "" : "s"}.
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-xs font-medium text-muted-foreground">Estoque</p>
                <div className="mt-2 flex justify-end">
                  <Badge
                    variant="outline"
                    className={cn("rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium", stockToneClass)}
                  >
                    {stockLabel}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center rounded-xl border border-border/60 bg-card px-3 py-2 text-[0.6875rem] text-muted-foreground">
              <Truck className="mr-2 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Frete e prazo são confirmados na finalização do pedido.</span>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              {actions?.quantityStepper ?? (
                <div className="flex h-10 items-center rounded-full border border-border/60 bg-background px-4 text-sm font-semibold tabular-nums text-muted-foreground shadow-sm">
                  1
                </div>
              )}

              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Pagamento seguro</span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Button disabled={!actions} onClick={actions?.onBuyNow} className="h-10 w-full gap-1.5 text-sm">
                Comprar agora
              </Button>
              <Button
                disabled={!actions}
                onClick={actions?.onAddToCart}
                variant={actions?.isInCart ? "secondary" : "outline"}
                className="h-10 w-full gap-1.5 text-sm"
              >
                <Plus className="h-4 w-4" />
                {actions?.isInCart ? "No carrinho" : "Adicionar"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
