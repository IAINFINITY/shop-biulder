import { parsePriceInput } from "@/lib/formatMoney";
import type { Product } from "@/lib/products";
import type { AdminProductFormState } from "@/components/admin/adminTypes";

/**
 * Converte o formulario do admin num `Product`, para o preview poder renderizar
 * os componentes reais da vitrine.
 *
 * Antes o preview era uma reproducao feita a mao do card e da pagina do produto
 * — mais de 400 linhas de marcacao paralela. Toda mudanca no catalogo precisava
 * ser copiada para ca, e quando isso nao acontecia o preview passava a mostrar
 * uma loja que nao existe mais. Renderizando o componente de verdade, o preview
 * acompanha o catalogo sozinho.
 */
export function buildPreviewProduct(state: AdminProductFormState | null): Product | null {
  if (!state) return null;

  const gallery = state.image_urls.map((url) => url.trim()).filter(Boolean);
  const price = parsePriceInput(state.priceInput);
  const compareAt = state.compareAtPriceInput.trim() === "" ? null : parsePriceInput(state.compareAtPriceInput);
  const stock = state.stockInput.trim() === "" ? null : Number.parseInt(state.stockInput, 10);

  return {
    id: state.id ?? "preview",
    name: state.name.trim() || "Nome do produto",
    description: state.description,
    brand: state.brand.trim() || null,
    type: state.type,
    family: state.family.trim(),
    image_url: gallery[0] ?? null,
    image_urls: gallery.length > 0 ? gallery : null,
    image_alts: state.image_alts.length > 0 ? state.image_alts : null,
    image_fit: state.image_fit,
    image_width: null,
    image_height: null,
    active: state.active,
    is_promotion: state.is_promotion,
    is_featured: state.is_featured,
    price,
    // Preco "de" menor ou igual ao atual nao e desconto: o banco barra, e aqui
    // tambem, senao o preview mostraria um risco que nunca vai existir na loja.
    compare_at_price: compareAt !== null && compareAt > price ? compareAt : null,
    // A previa do admin mostra o produto como a loja mostra, entao a promocao
    // precisa vir junto — inclusive a janela, para o preview refletir se ela
    // esta valendo hoje ou nao.
    promo_percent: state.promoPercentInput.trim() === "" ? null : parsePriceInput(state.promoPercentInput),
    promo_starts_at: state.promoStartsAtInput.trim() === "" ? null : state.promoStartsAtInput,
    promo_ends_at: state.promoEndsAtInput.trim() === "" ? null : state.promoEndsAtInput,
    stock: Number.isInteger(stock) ? stock : null,
    product_code: state.productCode.trim() || null,
    visible_to: state.visible_to.length > 0 ? state.visible_to : null,
    created_at: "",
    updated_at: "",
    // Avaliacao vem de quem compra: no preview nao ha o que mostrar, e inventar
    // estrelas daria a impressao de que o produto ja tem reputacao.
    average_rating: 0,
    review_count: 0,
  };
}
