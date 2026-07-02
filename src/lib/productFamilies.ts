export const PRODUCT_FAMILIES_TABLE = "product_families";

export type ProductFamily = {
  id: string;
  name: string;
  type_id: string;
  created_at: string;
  updated_at: string;
};

export function makeProductFamilyKey(typeId: string, name: string): string {
  return `${typeId}::${name.trim()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeProductFamilyFromSupabaseRow(row: unknown): ProductFamily {
  const record = isRecord(row) ? row : {};

  return {
    id: typeof record.id === "string" ? record.id : "",
    name: typeof record.name === "string" ? record.name : "",
    type_id: typeof record.type_id === "string" ? record.type_id : "",
    created_at: typeof record.created_at === "string" ? record.created_at : "",
    updated_at: typeof record.updated_at === "string" ? record.updated_at : "",
  };
}
