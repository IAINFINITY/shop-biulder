import { coercePrice } from "./formatMoney";

export const PRODUCTS_TABLE = "Clinic+ - Catálogo Front B2B";
export const PRODUCT_TYPES_TABLE = "product_types";

export interface Product {
  id: string;
  name: string;
  description: string;
  type: string;
  family: string;
  image_url: string | null;
  /** URLs ordenadas da galeria; vazio no legado usa só `image_url`. */
  image_urls?: string[] | null;
  active: boolean;
  /** Preço unitário em reais; ausente ou null no legado = 0 */
  price?: number | null;
  /** Código interno — só admin/pedidos; não exibir no catálogo. */
  product_code?: string | null;
  created_at: string;
  updated_at: string;
}

export function getProductUnitPrice(product: Pick<Product, "price">): number {
  return coercePrice(product.price);
}

/** Converte coluna text[] do Postgres (array JS ou string `{a,b}`). */
export function parseSupabaseTextArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.filter((u): u is string => typeof u === "string" && u.trim() !== "");
  }
  if (typeof value !== "string") return [];
  const s = value.trim();
  if (!s) return [];
  if (s.startsWith("{") && s.endsWith("}")) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map((part) => {
        let p = part.trim();
        if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1);
        return p.replace(/\\"/g, '"').trim();
      })
      .filter(Boolean);
  }
  if (s.startsWith("http")) return [s];
  return [];
}

/** URLs da galeria (principal = `image_url`, depois `image_urls` sem duplicar). */
export function resolveProductImageUrls(
  image_url: string | null | undefined,
  image_urls: unknown,
): string[] {
  const primary = typeof image_url === "string" ? image_url.trim() : "";
  const fromArray = parseSupabaseTextArray(image_urls);
  const urls: string[] = [];
  const seen = new Set<string>();
  const add = (u: string) => {
    const t = u.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    urls.push(t);
  };
  if (primary) add(primary);
  for (const u of fromArray) add(u);
  return urls;
}

/** URLs da galeria na ordem de exibição (principal = primeiro). */
export function getProductImageUrls(product: Pick<Product, "image_url" | "image_urls">): string[] {
  return resolveProductImageUrls(product.image_url, product.image_urls);
}

const PRODUCT_SELECT_BASE =
  "id,name,description,type,family,image_url,active,price,created_at,updated_at" as const;

export const PRODUCT_SELECT_COLUMNS =
  `${PRODUCT_SELECT_BASE},image_urls,product_code` as const;

/** Sem galeria; mantém product_code. */
export const PRODUCT_SELECT_COLUMNS_NO_GALLERY =
  `${PRODUCT_SELECT_BASE},product_code` as const;

/** Com galeria; sem product_code (migração parcial). */
export const PRODUCT_SELECT_COLUMNS_NO_CODE =
  `${PRODUCT_SELECT_BASE},image_urls` as const;

export const PRODUCT_SELECT_COLUMNS_LEGACY = PRODUCT_SELECT_BASE;

export function isMissingColumnError(message: string, column: string): boolean {
  return new RegExp(column, "i").test(message) && /(column|schema cache)/i.test(message);
}

/** Erro do PostgREST quando a migração `image_urls` ainda não foi aplicada no Supabase. */
export function isMissingImageUrlsColumnError(message: string): boolean {
  return isMissingColumnError(message, "image_urls");
}

export function isMissingProductCodeColumnError(message: string): boolean {
  return isMissingColumnError(message, "product_code");
}

export function omitProductCode<T extends { product_code?: string | null }>(
  row: T,
): Omit<T, "product_code"> {
  const { product_code: _code, ...rest } = row;
  return rest;
}

export type ProductDbPayloadInput = {
  name: string;
  description: string;
  type: string;
  family: string;
  image_urls: string[];
  active: boolean;
  price: number;
  product_code: string;
};

type ProductDbRow = {
  name: string;
  description: string;
  type: string;
  family: string;
  image_url: string | null;
  active: boolean;
  price: number;
  product_code: string | null;
};

export function buildProductDbPayload(input: ProductDbPayloadInput): {
  withGallery: ProductDbRow & { image_urls: string[] };
  legacyOnly: ProductDbRow;
} {
  const urls = input.image_urls.filter((u) => u.trim() !== "");
  const base: ProductDbRow = {
    name: input.name,
    description: input.description,
    type: input.type,
    family: input.family,
    active: input.active,
    price: input.price,
    image_url: urls[0] ?? null,
    product_code: input.product_code.trim() || null,
  };
  return {
    withGallery: { ...base, image_urls: urls },
    legacyOnly: base,
  };
}

export function normalizeProductFromSupabaseRow(row: Record<string, unknown>): Product {
  const gallery = resolveProductImageUrls(
    row.image_url as string | null | undefined,
    row.image_urls,
  );

  const productCode =
    typeof row.product_code === "string" && row.product_code.trim()
      ? row.product_code.trim()
      : null;

  return {
    ...(row as Product),
    price: coercePrice(row.price),
    image_url: gallery[0] ?? null,
    image_urls: gallery.length > 0 ? gallery : null,
    product_code: productCode,
  };
}

/** Código para pedidos/exportação (cadastro ou fallback curto do ID). */
export function getProductCode(product: Pick<Product, "product_code" | "id">): string {
  const code = product.product_code?.trim();
  if (code) return code;
  return product.id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** Mapa product_id → código atual do catálogo (para enriquecer pedidos antigos). */
export function buildProductCodeLookup(
  products: Pick<Product, "id" | "product_code">[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const product of products) {
    const code = product.product_code?.trim();
    if (code) map.set(product.id, code);
  }
  return map;
}

/** Mapa product_id → preço unitário atual do catálogo (para pedidos sem preço gravado). */
export function buildProductPriceLookup(products: Pick<Product, "id" | "price">[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const product of products) {
    map.set(product.id, getProductUnitPrice(product));
  }
  return map;
}

/** Chave estável para casar nome do produto em pedidos antigos. */
export function normalizeProductNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

export type OrderEnrichmentMaps = {
  codeByProductId: Map<string, string>;
  priceByProductId: Map<string, number>;
  codeByProductName: Map<string, string>;
  priceByProductName: Map<string, number>;
};

export function buildOrderEnrichmentMaps(
  products: Pick<Product, "id" | "name" | "product_code" | "price">[],
): OrderEnrichmentMaps {
  const codeByProductId = new Map<string, string>();
  const priceByProductId = new Map<string, number>();
  const codeByProductName = new Map<string, string>();
  const priceByProductName = new Map<string, number>();

  for (const product of products) {
    const nameKey = normalizeProductNameKey(product.name);
    const code = product.product_code?.trim();
    const price = getProductUnitPrice(product);

    priceByProductId.set(product.id, price);
    if (nameKey) priceByProductName.set(nameKey, price);

    if (code) {
      codeByProductId.set(product.id, code);
      if (nameKey) codeByProductName.set(nameKey, code);
    }
  }

  return { codeByProductId, priceByProductId, codeByProductName, priceByProductName };
}

export function getCartSubtotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + getProductUnitPrice(item.product) * item.quantity, 0);
}

export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
}

const CART_KEY = "clinicplus_cart";

export function getCart(): CartItem[] {
  const stored = localStorage.getItem(CART_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveCart(cart: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function getProductTypes(): string[] {
  return ["Chá", "Cápsula", "Solúvel"];
}
