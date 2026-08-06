import { formatBRL } from "@/lib/formatMoney";
import type { Product } from "@/lib/products";
import { aplicarPromocao, type ProdutoComPromocao } from "@/lib/promocao";
import { cn } from "@/lib/utils";

/**
 * Preco do produto, com o valor anterior riscado quando ha desconto.
 *
 * Estava implementado em cada tela por conta propria, e nem todas tinham: o card
 * da grade mostrava o desconto, os carrosseis e a previa rapida mostravam so um
 * numero. O mesmo produto em promocao aparecia com preco cheio na home e com
 * desconto na sua propria pagina, e quem olhava concluia que a promocao nao
 * estava valendo.
 *
 * O valor anterior vai **acima** e menor: o preco que vale e o de agora, e
 * riscar o antigo ao lado competiria com ele na leitura.
 */
export function ProductPriceTag({
  product,
  price,
  precoBase,
  size = "md",
  className,
}: {
  product: Pick<Product, "price"> & Partial<ProdutoComPromocao>;
  /** Preco final, ja com promocao — e o valor que sera cobrado. */
  price: number;
  /**
   * O que a pessoa pagaria sem a promocao: a base **dela**, nao a do catalogo.
   *
   * Vem de fora porque so quem tem o mapa de precos do cliente sabe calcular —
   * derivar de `price` dividindo pelo percentual erraria centavo no
   * arredondamento, e centavo errado num preco e defeito.
   *
   * **Obrigatorio de proposito.** Era opcional, e ai so a grade passava: as
   * prateleiras da home, a previa rapida e os relacionados mostravam o produto em
   * promocao com um numero solto, sem riscado e sem percentual. Quem visse por
   * ali nao ficava sabendo do desconto. Obrigatorio, o compilador cobra de todo
   * ponto de uso — inclusive dos que ainda nao existem.
   */
  precoBase: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const discount = aplicarPromocao(precoBase, {
    promo_percent: product.promo_percent ?? null,
    promo_starts_at: product.promo_starts_at ?? null,
    promo_ends_at: product.promo_ends_at ?? null,
  });

  const priceSize =
    size === "sm" ? "text-sm sm:text-base" : size === "lg" ? "text-lg sm:text-xl" : "text-base sm:text-lg";

  return (
    <div className={className}>
      {discount ? (
        <p className="flex items-center gap-1.5 text-[0.6875rem] leading-none text-muted-foreground">
          <span className="line-through tabular-nums">{formatBRL(discount.de)}</span>
          <span className="font-semibold text-primary">-{discount.percent}%</span>
        </p>
      ) : null}
      <p className={cn("font-semibold tabular-nums text-foreground", discount && "mt-0.5", priceSize)}>
        {formatBRL(price)}
      </p>
    </div>
  );
}
