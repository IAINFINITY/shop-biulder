import { TIPO_FUNCIONARIO } from "@/lib/funcionario";
import type { CartItem, Product } from "@/lib/products";
import { getProductUnitPrice } from "@/lib/products";
import { precoFinalComPromocao, type ProdutoComPromocao } from "@/lib/promocao";

export const CUSTOMER_TYPES = ["cliente", "lojista", "distribuidor", "funcionario"];

export const DEFAULT_CUSTOMER_TYPE = "cliente";

export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  cliente: "Cliente",
  lojista: "Lojista",
  distribuidor: "Distribuidor",
  funcionario: "Funcionário",
};

export function customerTypeLabel(value: string): string {
  if (CUSTOMER_TYPE_LABELS[value]) return CUSTOMER_TYPE_LABELS[value];
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export const CUSTOMER_PRICE_OVERRIDES_TABLE = "clinic+b2b_customer_price_overrides";

/**
 * Mapa vazio compartilhado, para "ainda nao carregou".
 *
 * Precisa ser uma instancia so. Criar `new Map()` na chamada devolve um objeto
 * novo a cada render — a identidade muda sempre, todo `useMemo` que depende do
 * mapa recalcula, e o ciclo se realimenta ate o React abortar com "Maximum
 * update depth exceeded".
 */
export const EMPTY_PRICE_MAP: ReadonlyMap<string, number> = new Map();

export type CustomerPriceOverride = {
  customer_type: string;
  proxis_tpr_id: number | null;
  product_code: string;
  price: number;
  active: boolean;
};

export function normalizeCustomerType(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim().toLowerCase();
  return DEFAULT_CUSTOMER_TYPE;
}

function normalizeProductCode(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

/**
 * Monta o mapa de precos de UMA tabela.
 *
 * Preco zero e descartado. Numa tabela de preco do Proxis, zero significa
 * "produto nao precificado nesta tabela", nunca "de graca" — e a tabela 8728
 * chegou com 143 dos 156 itens em zero. Aceitando o zero, esses produtos
 * apareciam por R$ 0,00 na vitrine e seguiam por R$ 0,00 para o pedido. Fora do
 * mapa, cada um cai no preco de cadastro, que e o comportamento correto para
 * item sem preco negociado.
 */
export function buildCustomerPriceMap(overrides: Pick<CustomerPriceOverride, "product_code" | "price">[]) {
  const map = new Map<string, number>();
  for (const override of overrides) {
    const code = normalizeProductCode(override.product_code);
    if (!code) continue;
    const price = Number(override.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    map.set(code, Math.round(price * 100) / 100);
  }
  return map;
}

/**
 * Junta a tabela do cliente com a tabela geral, nessa ordem de prioridade.
 *
 * A regra do negocio: quando o cliente tem tabela no Proxis, vale o preco de la;
 * o produto que a tabela dele nao lista cai no preco da tabela "Clientes", que e
 * o cheio. So depois disso o preco de cadastro entra.
 *
 * As tabelas do Proxis sao parciais de proposito — a 8728 lista 138 dos 143
 * produtos, a 8729 lista 132. Sem essa camada, os 5 e os 11 que faltam pulavam
 * direto para o cadastro e saiam por um valor que nao e o da politica comercial.
 */
export function mergePriceLayers(
  general: ReadonlyMap<string, number>,
  customer: ReadonlyMap<string, number>,
): Map<string, number> {
  const merged = new Map(general);
  for (const [code, price] of customer) merged.set(code, price);
  return merged;
}

/**
 * O preco que vale para quem esta olhando.
 *
 * Duas camadas, nesta ordem:
 *
 * 1. **Base do cliente** — tabela do Proxis (TPR), tabela geral ou cadastro.
 * 2. **Promocao** — percentual sobre essa base, se houver janela ativa.
 *
 * A promocao entra aqui, e nao em cada tela, de proposito: sao 19 pontos que
 * pedem preco (vitrine, carrossel, carrinho, checkout, favoritos, historico).
 * Aplicar o desconto num lugar so e o que garante que o preco da etiqueta e o
 * preco cobrado.
 */
export function resolveProductPrice(
  product: Pick<Product, "price" | "product_code"> & Partial<ProdutoComPromocao>,
  priceOverrides: ReadonlyMap<string, number>,
  agora: Date = new Date(),
): number {
  const base = resolvePrecoBase(product, priceOverrides);
  return precoFinalComPromocao(base, promoDe(product), agora);
}

/** A base, sem promocao. E o "de" quando ha desconto. */
export function resolvePrecoBase(
  product: Pick<Product, "price" | "product_code">,
  priceOverrides: ReadonlyMap<string, number>,
): number {
  const code = normalizeProductCode(product.product_code);
  if (code && priceOverrides.has(code)) {
    return priceOverrides.get(code)!;
  }
  return getProductUnitPrice(product);
}

/** Normaliza o produto para a forma que `promocao.ts` espera. */
function promoDe(product: Partial<ProdutoComPromocao>): ProdutoComPromocao {
  return {
    promo_percent: product.promo_percent ?? null,
    promo_starts_at: product.promo_starts_at ?? null,
    promo_ends_at: product.promo_ends_at ?? null,
  };
}

export function calculateCartSubtotal(
  cart: CartItem[],
  priceOverrides: ReadonlyMap<string, number>,
): number {
  return Math.round(
    cart.reduce((sum, item) => sum + resolveProductPrice(item.product, priceOverrides) * item.quantity, 0) * 100,
  ) / 100;
}

/**
 * A tabela do Proxis (TPR) vale para este cliente?
 *
 * Duas respostas "nao", por motivos diferentes:
 *
 * - **Sem TPR** — o cliente nao tem tabela negociada; so a geral do tipo dele.
 * - **Funcionario** — a tabela dele **e** a geral. A Clinic 2026 Funcionarios
 *   nao existe no Proxis (decisao de 25/08/2026: "no PROXIS deixa fora, deixa
 *   manual"), entao qualquer TPR que chegue num perfil de funcionario e resto de
 *   sincronizacao antiga, nao politica comercial.
 *
 * O segundo caso importa porque a camada do TPR fica **acima** da geral em
 * `mergePriceLayers`: um unico 8728 esquecido num perfil apaga a tabela nova
 * item a item, sem erro nenhum — so com o preco errado na etiqueta.
 */
export function deveAplicarTabelaDoProxis(customerType: string, proxisTprId: number | null): boolean {
  if (proxisTprId === null) return false;
  return normalizeCustomerType(customerType) !== TIPO_FUNCIONARIO;
}
