import { formatBRL } from "@/lib/formatMoney";
import { getProductDiscount, type Product } from "@/lib/products";
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
  size = "md",
  className,
}: {
  product: Pick<Product, "price" | "compare_at_price">;
  /** Preco ja resolvido — pode vir da tabela do cliente, nao so do cadastro. */
  price: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const discount = getProductDiscount(product, price);

  const priceSize =
    size === "sm" ? "text-sm sm:text-base" : size === "lg" ? "text-lg sm:text-xl" : "text-base sm:text-lg";

  return (
    <div className={className}>
      {discount ? (
        <p className="flex items-center gap-1.5 text-[0.6875rem] leading-none text-muted-foreground">
          <span className="line-through tabular-nums">{formatBRL(discount.from)}</span>
          <span className="font-semibold text-primary">-{discount.percent}%</span>
        </p>
      ) : null}
      <p className={cn("font-semibold tabular-nums text-foreground", discount && "mt-0.5", priceSize)}>
        {formatBRL(price)}
      </p>
    </div>
  );
}
