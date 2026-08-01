export const PRODUCT_FAMILIES_TABLE = "product_families";

export type ProductFamily = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

/**
 * Chave de uso de uma subcategoria.
 *
 * Antes a chave combinava categoria + nome, porque a mesma subcategoria era
 * cadastrada uma vez por categoria. Agora subcategoria e global: o nome
 * normalizado basta, e "Creatina" soma os produtos de Cápsula e de Solúvel.
 */
export function makeProductFamilyKey(name: string): string {
  return name.trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeProductFamilyFromSupabaseRow(row: unknown): ProductFamily {
  const record = isRecord(row) ? row : {};

  return {
    id: typeof record.id === "string" ? record.id : "",
    name: typeof record.name === "string" ? record.name.trim() : "",
    created_at: typeof record.created_at === "string" ? record.created_at : "",
    updated_at: typeof record.updated_at === "string" ? record.updated_at : "",
  };
}

export function sortProductFamilies(families: ProductFamily[]): ProductFamily[] {
  return [...families].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}
