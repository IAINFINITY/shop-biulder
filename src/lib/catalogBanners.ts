export const CATALOG_BANNERS_TABLE = "catalog_banners";

export type CatalogBanner = {
  id: string;
  label: string;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeCatalogBannerFromSupabaseRow(row: unknown): CatalogBanner {
  const record = isRecord(row) ? row : {};

  return {
    id: typeof record.id === "string" ? record.id : "",
    label: typeof record.label === "string" ? record.label : "Banner",
    image_url: typeof record.image_url === "string" ? record.image_url : "",
    link_url: normalizeOptionalText(record.link_url),
    sort_order: Number.isFinite(Number(record.sort_order)) ? Math.trunc(Number(record.sort_order)) : 0,
    active: Boolean(record.active),
    created_at: typeof record.created_at === "string" ? record.created_at : "",
    updated_at: typeof record.updated_at === "string" ? record.updated_at : "",
  };
}

