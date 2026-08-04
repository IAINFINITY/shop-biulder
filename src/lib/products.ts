import { coercePrice } from "./formatMoney";
import { normalizeStoragePublicUrl } from "./storageUrls";

/**
 * Como a foto ocupa a moldura 1:1 do catalogo.
 *
 * `contain` serve o packshot (produto recortado sobre fundo branco ou
 * transparente). `cover` serve a foto ambientada, que ja traz cenario proprio e
 * ficaria com faixas vazias nas laterais se fosse encaixada por dentro.
 */
export type ProductImageFit = "contain" | "cover";

export const PRODUCT_IMAGE_FIT_DEFAULT: ProductImageFit = "contain";
export const PRODUCT_MAX_IMAGES = 7;

export function normalizeProductImageFit(value: unknown): ProductImageFit {
  return value === "cover" ? "cover" : PRODUCT_IMAGE_FIT_DEFAULT;
}

export const PRODUCT_IMAGE_FIT_LABELS: Record<ProductImageFit, string> = {
  contain: "Packshot (fundo branco ou transparente)",
  cover: "Ambientada (a foto já tem fundo próprio)",
};

export const PRODUCTS_TABLE = "clinic+b2b_clinic_catalogo_front_b2b";
export const PRODUCT_TYPES_TABLE = "clinic+b2b_product_types";

export interface Product {
  id: string;
  name: string;
  description: string;
  /** Marca que assina o produto (Chá Mais, Clinic Mais). Ver product_brands. */
  brand: string | null;
  /** Categoria = formato de consumo (Chá, Cápsula, Solúvel). Ver product_types. */
  type: string;
  /** Subcategoria = o que o produto e (Camomila, Creatina). Global desde 2026-07-31. */
  family: string;
  image_url: string | null;
  image_urls: string[] | null;
  /** Descricao de cada imagem, alinhada por indice com a galeria resolvida. */
  image_alts: string[] | null;
  /** contain = packshot sobre fundo neutro · cover = foto com cenario proprio. */
  image_fit: ProductImageFit;
  /** Dimensoes da capa, para o admin apontar o que esta fora do padrao. */
  image_width: number | null;
  image_height: number | null;
  active: boolean;
  is_promotion: boolean;
  /** Escolha editorial, independente de preco. Ver o carrossel "Em destaque". */
  is_featured: boolean;
  price: number | null;
  /** Preco anterior, exibido riscado quando maior que price. */
  compare_at_price: number | null;
  stock: number | null;
  product_code: string | null;
  visible_to: string[] | null;
  created_at: string;
  updated_at: string;
  average_rating: number;
  review_count: number;
}

export function getProductUnitPrice(product: Pick<Product, "price">): number {
  return coercePrice(product.price);
}

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
      .split(/,(=(:(:[^"]*"){2})*[^"]*$)/)
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

export function resolveProductImageUrls(
  image_url: string | null | undefined,
  image_urls: unknown,
): string[] {
  const primary = normalizeStoragePublicUrl(image_url, "product-images") ?? "";
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

/**
 * Selos da linha do titulo, sem repetir valor.
 *
 * Marca, categoria e subcategoria repetem com frequencia — ha produtos cuja
 * subcategoria e o proprio nome da marca, e ai o selo apareceria duas vezes.
 */
export function buildProductTags(product: Pick<Product, "brand" | "type" | "family">): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of [product.brand, product.type, product.family]) {
    const clean = (value ?? "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(clean);
  }
  return tags;
}

export function getProductImageUrls(product: Pick<Product, "image_url" | "image_urls">): string[] {
  return resolveProductImageUrls(product.image_url, product.image_urls);
}

// Colunas sempre presentes desde o schema original.
const PRODUCT_SELECT_REQUIRED = [
  "id",
  "name",
  "description",
  "type",
  "family",
  "image_url",
  "active",
  "price",
  "average_rating",
  "review_count",
  "created_at",
  "updated_at",
] as const;

/**
 * Colunas adicionadas por migrations posteriores.
 *
 * O banco de producao e o de quem roda local nem sempre estao no mesmo ponto da
 * fila de migrations, entao a consulta comeca pedindo tudo e vai derrubando a
 * coluna que o Postgres reclamar. Antes isso era feito com oito constantes
 * combinando as variacoes na mao — o que dobraria a cada coluna nova.
 */
export const PRODUCT_OPTIONAL_COLUMNS = [
  "image_urls",
  "product_code",
  "visible_to",
  "is_promotion",
  "is_featured",
  "stock",
  "brand",
  "image_fit",
  "image_alts",
  "image_width",
  "image_height",
  "compare_at_price",
] as const;

export type ProductOptionalColumn = (typeof PRODUCT_OPTIONAL_COLUMNS)[number];

export function buildProductSelectColumns(omit: readonly string[] = []): string {
  const optional = PRODUCT_OPTIONAL_COLUMNS.filter((column) => !omit.includes(column));
  return [...PRODUCT_SELECT_REQUIRED, ...optional].join(",");
}

export const PRODUCT_SELECT_COLUMNS = buildProductSelectColumns();

export function isMissingColumnError(message: string, column: string): boolean {
  return new RegExp(column, "i").test(message) && /(column|schema cache)/i.test(message);
}

/** Qual coluna opcional o Postgres reclamou, se alguma. */
export function detectMissingProductColumn(message: string): ProductOptionalColumn | null {
  return PRODUCT_OPTIONAL_COLUMNS.find((column) => isMissingColumnError(message, column)) ?? null;
}

export function omitProductColumn<T extends Record<string, unknown>>(row: T, column: string): T {
  const { [column]: _removed, ...rest } = row;
  return rest as T;
}

export type ProductDbPayloadInput = {
  name: string;
  description: string;
  brand: string;
  type: string;
  family: string;
  image_urls: string[];
  image_alts: string[];
  image_fit: ProductImageFit;
  active: boolean;
  is_promotion: boolean;
  /** Escolha editorial, independente de preco. Ver o carrossel "Em destaque". */
  is_featured: boolean;
  price: number;
  compare_at_price: number | null;
  stock: number | null;
  product_code: string;
  visible_to: string[] | null;
};

type ProductDbRow = {
  name: string;
  description: string;
  brand: string | null;
  type: string;
  family: string;
  image_url: string | null;
  /** Texto alternativo por foto, na mesma ordem de `image_urls`. */
  image_alts: string[] | null;
  image_fit: ProductImageFit;
  active: boolean;
  is_promotion: boolean;
  /** Escolha editorial, independente de preco. Ver o carrossel "Em destaque". */
  is_featured: boolean;
  price: number;
  compare_at_price: number | null;
  stock: number | null;
  product_code: string | null;
  visible_to: string[] | null;
};

/**
 * Monta a linha completa do produto.
 *
 * Sempre inclui todas as colunas opcionais: quem grava usa
 * `detectMissingProductColumn` + `omitProductColumn` para derrubar as que o
 * banco ainda nao tiver, em vez de existir uma variante "legada" pronta.
 */
export function buildProductDbPayload(input: ProductDbPayloadInput): {
  withGallery: ProductDbRow & { image_urls: string[] };
} {
  const urls = input.image_urls
    .filter((u) => u.trim() !== "")
    .slice(0, PRODUCT_MAX_IMAGES);
  const visibleTo = input.visible_to && input.visible_to.length > 0 ? input.visible_to : null;

  // `image_alts` entra so no `withGallery`, junto com as URLs: as duas listas
  // precisam ter o mesmo tamanho, e o tamanho so se conhece depois de filtrar as
  // URLs vazias. Por isso o `base` e o tipo sem ela.
  const base: Omit<ProductDbRow, "image_alts"> & { visible_to: string[] | null } = {
    name: input.name,
    description: input.description,
    brand: (input.brand ?? "").trim() || null,
    type: input.type,
    family: input.family,
    active: input.active,
    is_promotion: input.is_promotion,
    is_featured: input.is_featured,
    price: input.price,
    // So grava desconto real; valor menor ou igual ao preco nao e comparacao.
    compare_at_price:
      input.compare_at_price !== null && input.compare_at_price > input.price ? input.compare_at_price : null,
    stock: input.stock,
    image_url: urls[0] ?? null,
    image_fit: normalizeProductImageFit(input.image_fit),
    product_code: (input.product_code ?? "").trim() || null,
    visible_to: visibleTo,
  };
  // As descricoes acompanham a mesma quantidade de imagens salvas, para os
  // indices continuarem casando depois de reordenar ou remover fotos.
  const alts = urls.map((_, index) => (input.image_alts[index] ?? "").trim());

  return {
    withGallery: { ...base, image_urls: urls, image_alts: alts },
  };
}

/** Descricao da imagem para o atributo alt, com o nome do produto como reserva. */
export function getProductImageAlt(
  product: Pick<Product, "name" | "image_alts">,
  index: number,
): string {
  const alt = product.image_alts?.[index]?.trim();
  return alt || product.name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeProductFromSupabaseRow(row: unknown): Product {
  const record = isRecord(row) ? row : {};
  const gallery = resolveProductImageUrls(
    record.image_url as string | null | undefined,
    record.image_urls,
  );

  const productCode =
    typeof record.product_code === "string" && record.product_code.trim()
      ? record.product_code.trim()
      : null;

  // Alinha as descricoes com a galeria ja resolvida: se faltar alt para alguma
  // posicao, ela fica vazia em vez de deslocar as demais.
  const storedAlts = parseSupabaseTextArray(record.image_alts);
  const galleryAlts = gallery.map((_, index) => (storedAlts[index] ?? "").trim());

  const visibleToRaw = record.visible_to;
  const visibleTo =
    Array.isArray(visibleToRaw) && visibleToRaw.length > 0
      ? visibleToRaw.filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim().toLowerCase())
      : null;

  return {
    id: typeof record.id === "string" ? record.id : "",
    name: typeof record.name === "string" ? record.name : "",
    description: typeof record.description === "string" ? record.description : "",
    brand: typeof record.brand === "string" && record.brand.trim() ? record.brand.trim() : null,
    type: typeof record.type === "string" ? record.type : "",
    family: typeof record.family === "string" ? record.family : "",
    image_url: gallery[0] ?? null,
    image_urls: gallery.length > 0 ? gallery : null,
    image_alts: galleryAlts.some((alt) => alt !== "") ? galleryAlts : null,
    image_fit: normalizeProductImageFit(record.image_fit),
    image_width: typeof record.image_width === "number" && record.image_width > 0 ? record.image_width : null,
    image_height: typeof record.image_height === "number" && record.image_height > 0 ? record.image_height : null,
    active: Boolean(record.active),
    is_promotion: Boolean(record.is_promotion),
    is_featured: Boolean(record.is_featured),
    price: coercePrice(record.price),
    compare_at_price: coercePrice(record.compare_at_price) || null,
    // stock vinha no SELECT mas nao era mapeado aqui: o admin abria o campo
    // Estoque vazio e salvava null por cima do valor real.
    stock: typeof record.stock === "number" && Number.isFinite(record.stock) ? record.stock : null,
    product_code: productCode,
    visible_to: visibleTo,
    average_rating: typeof record.average_rating === "number" ? record.average_rating : 0,
    review_count: typeof record.review_count === "number" ? record.review_count : 0,
    created_at: typeof record.created_at === "string" ? record.created_at : "",
    updated_at: typeof record.updated_at === "string" ? record.updated_at : "",
  };
}

/** Desconto valido para exibir "de/por", ou null. */
export function getProductDiscount(
  product: Pick<Product, "price" | "compare_at_price">,
  currentPrice?: number,
): { from: number; to: number; percent: number } | null {
  const to = currentPrice ?? coercePrice(product.price);
  const from = coercePrice(product.compare_at_price);
  if (!from || !to || from <= to) return null;

  return { from, to, percent: Math.round(((from - to) / from) * 100) };
}

export function getProductCode(product: Pick<Product, "product_code" | "id">): string {
  const code = (product.product_code ?? "").trim();
  if (code) return code;
  return product.id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function buildProductCodeLookup(
  products: Pick<Product, "id" | "product_code">[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const product of products) {
    const code = (product.product_code ?? "").trim();
    if (code) map.set(product.id, code);
  }
  return map;
}

export function buildProductPriceLookup(products: Pick<Product, "id" | "price">[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const product of products) {
    map.set(product.id, getProductUnitPrice(product));
  }
  return map;
}

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
  imageByProductId: Map<string, string>;
  imageByProductName: Map<string, string>;
};

export function buildOrderEnrichmentMaps(
  products: Pick<Product, "id" | "name" | "product_code" | "price" | "image_url" | "image_urls">[],
): OrderEnrichmentMaps {
  const codeByProductId = new Map<string, string>();
  const priceByProductId = new Map<string, number>();
  const codeByProductName = new Map<string, string>();
  const priceByProductName = new Map<string, number>();
  const imageByProductId = new Map<string, string>();
  const imageByProductName = new Map<string, string>();

  for (const product of products) {
    const nameKey = normalizeProductNameKey(product.name);
    const code = (product.product_code ?? "").trim();
    const price = getProductUnitPrice(product);
    const imageUrl = getProductImageUrls(product)[0] ?? "";

    priceByProductId.set(product.id, price);
    if (nameKey) priceByProductName.set(nameKey, price);

    if (imageUrl) {
      imageByProductId.set(product.id, imageUrl);
      if (nameKey) imageByProductName.set(nameKey, imageUrl);
    }

    if (code) {
      codeByProductId.set(product.id, code);
      if (nameKey) codeByProductName.set(nameKey, code);
    }
  }

  return {
    codeByProductId,
    priceByProductId,
    codeByProductName,
    priceByProductName,
    imageByProductId,
    imageByProductName,
  };
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
const PRODUCTS_CACHE_PREFIX = "clinicplus_products_cache";

function getProductsCacheKey(includeInactive: boolean) {
  return `${PRODUCTS_CACHE_PREFIX}_${includeInactive ? "all" : "active"}`;
}

function readStoredValue(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredValue(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures and keep the live data as the source of truth.
  }
}

export function readCachedProductsFromStorage(includeInactive: boolean): Product[] {
  const stored = readStoredValue(getProductsCacheKey(includeInactive));
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => normalizeProductFromSupabaseRow(row));
  } catch {
    return [];
  }
}

export function readCachedProductFromStorage(productId: string): Product | null {
  const allProducts = [
    ...readCachedProductsFromStorage(false),
    ...readCachedProductsFromStorage(true),
  ];

  return allProducts.find((product) => product.id === productId) ?? null;
}

function normalizeCartQuantity(value: unknown): number {
  const quantity = typeof value === "number" ? value : Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? Math.max(1, Math.min(99, Math.round(quantity))) : 1;
}

function normalizeCartItem(item: unknown): CartItem | null {
  if (!item || typeof item !== "object") return null;

  const record = item as { product: unknown; quantity: unknown; notes: unknown };
  if (!record.product || typeof record.product !== "object") return null;

  const product = normalizeProductFromSupabaseRow(record.product);
  return {
    product,
    quantity: normalizeCartQuantity(record.quantity),
    notes: typeof record.notes === "string" ? record.notes : undefined,
  };
}

export function getCart(): CartItem[] {
  const stored = readStoredValue(CART_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCartItem).filter((item): item is CartItem => item !== null);
  } catch {
    return [];
  }
}

export function saveCart(cart: CartItem[]) {
  const normalized = cart.map((item) => ({
    ...item,
    quantity: normalizeCartQuantity(item.quantity),
  }));
  writeStoredValue(CART_KEY, JSON.stringify(normalized));
}

export function getProductTypes(): string[] {
  return ["Chá", "Cápsula", "Solúvel"];
}
