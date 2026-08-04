// Marca do produto — o terceiro eixo da taxonomia do catalogo.
//
// Antes de existir este campo, a identidade comercial vivia dentro da
// subcategoria: os chas usavam "Chá Mais" e "Chá Mais Sublime" como se fossem
// subcategorias, enquanto capsulas e soluveis usavam o ingrediente (Creatina,
// Ômega-3). O mesmo campo carregava dois conceitos, e a linha "Leveza 30"
// precisava se chamar "Chá Leveza 30" para caber nos dois formatos.
//
//   Marca        -> quem assina        (Chá Mais, Clinic Mais)
//   Categoria    -> como se consome    (Chá, Cápsula, Solúvel)
//   Subcategoria -> o que e            (Camomila, Creatina, Whey)

export const PRODUCT_BRANDS_TABLE = "clinic+b2b_product_brands";

export type ProductBrand = {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeProductBrandFromSupabaseRow(row: unknown): ProductBrand {
  const record = isRecord(row) ? row : {};

  return {
    id: typeof record.id === "string" ? record.id : "",
    name: typeof record.name === "string" ? record.name.trim() : "",
    active: record.active === undefined ? true : Boolean(record.active),
    sort_order:
      typeof record.sort_order === "number" && Number.isFinite(record.sort_order)
        ? record.sort_order
        : 0,
    created_at: typeof record.created_at === "string" ? record.created_at : "",
    updated_at: typeof record.updated_at === "string" ? record.updated_at : "",
  };
}

export function normalizeBrandName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Ordena pela posicao definida no admin e, em empate, pelo nome. */
export function sortProductBrands(brands: ProductBrand[]): ProductBrand[] {
  return [...brands].sort(
    (left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name, "pt-BR"),
  );
}
