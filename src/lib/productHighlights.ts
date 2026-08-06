import type { Product } from "@/lib/products";
import { promocaoAtiva, type ProdutoComPromocao } from "@/lib/promocao";

/**
 * O selo que um produto carrega, onde quer que ele apareca.
 *
 * Antes cada prateleira desenhava o proprio selo, entao a informacao existia so
 * dentro do carrossel dela: o mesmo produto aparecia como "Promocao" na
 * prateleira e sem selo nenhum na grade, nos favoritos, nos vistos recentemente
 * e nos relacionados. Quem visse primeiro pela grade nao ficava sabendo.
 */
export type HighlightTone = "primary" | "success" | "destructive" | "warm";

export type ProductHighlight = {
  label: string;
  tone: HighlightTone;
};

const PROMOCAO: ProductHighlight = { label: "Promoção", tone: "destructive" };
const DESTAQUE: ProductHighlight = { label: "Destaque", tone: "warm" };
const MAIS_VENDIDO: ProductHighlight = { label: "Mais vendido", tone: "success" };

/**
 * Um selo por card, na ordem em que interessam a quem compra.
 *
 * Empilhar dois ou tres roubaria a leitura de relance que o selo existe para
 * dar. A escolha e por utilidade: preco reduzido muda a decisao de compra na
 * hora; curadoria e uma recomendacao; mais vendido e contexto. Um produto que e
 * as tres coisas mostra "Promocao", que e a que faz agir.
 */
export function highlightForProduct(
  product: Pick<Product, "id" | "is_promotion" | "is_featured"> & Partial<ProdutoComPromocao>,
  maisVendidos: ReadonlySet<string>,
  agora: Date = new Date(),
): ProductHighlight | null {
  // O selo segue a promocao **ativa**, e nao mais o booleano `is_promotion`.
  //
  // Aquele booleano nao tocava em preco: os 4 produtos marcados apareciam com
  // "PROMOCAO" e o valor cheio, prometendo um desconto que nao existia. Agora o
  // selo so acende quando ha percentual valendo dentro da janela — nao ha como
  // anunciar promocao sem promocao.
  if (promocaoAtiva({
    promo_percent: product.promo_percent ?? null,
    promo_starts_at: product.promo_starts_at ?? null,
    promo_ends_at: product.promo_ends_at ?? null,
  }, agora)) {
    return PROMOCAO;
  }
  if (product.is_featured) return DESTAQUE;
  if (maisVendidos.has(product.id)) return MAIS_VENDIDO;
  return null;
}

/**
 * Classes do selo.
 *
 * As tres se distinguem por **peso**, e nao por matiz: solido, tinta e grafite.
 * Antes eram vermelho, ambar e verde — tres matizes num projeto que e vermelho
 * de ponta a ponta, e os selos pareciam vir de outro sistema.
 *
 * Cuidado com o nome `"primary"`: e o valor de reserva, e o de reserva e cinza.
 * A cor da marca esta em `"destructive"`.
 */
export function highlightBadgeClassName(tone: HighlightTone | undefined): string {
  if (tone === "success") {
    // Grafite. "Mais vendido" e constatacao, nao oferta — tratar como promocao
    // daria a ele um tom de anuncio que o dado nao tem.
    return "border-foreground bg-foreground text-background";
  }
  if (tone === "destructive") return "border-primary bg-primary text-primary-foreground";
  if (tone === "warm") return "border-primary/25 bg-primary/10 text-primary";
  return "border-border/80 bg-muted text-muted-foreground";
}
