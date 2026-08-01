export const CATALOG_BANNERS_TABLE = "catalog_banners";

export type CatalogBanner = {
  id: string;
  label: string;
  image_url: string;
  /** Versao AVIF da arte de desktop, servida antes do WebP. */
  image_url_avif: string | null;
  /** Arte de celular (800x320). Nulo = usa a de desktop, cortada no centro. */
  image_url_mobile: string | null;
  image_url_mobile_avif: string | null;
  link_url: string | null;
  sort_order: number;
  active: boolean;
  /** Area do site a que o banner pertence — ver `bannerSlots.ts`. */
  slot: string;
  visible_to: string[] | null;
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

  const visibleToRaw = record.visible_to;
  const visibleTo =
    Array.isArray(visibleToRaw) && visibleToRaw.length > 0
      ? visibleToRaw.filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim().toLowerCase())
      : null;

  return {
    id: typeof record.id === "string" ? record.id : "",
    label: typeof record.label === "string" ? record.label : "Banner",
    image_url: typeof record.image_url === "string" ? record.image_url : "",
    image_url_avif: normalizeOptionalText(record.image_url_avif),
    image_url_mobile: normalizeOptionalText(record.image_url_mobile),
    image_url_mobile_avif: normalizeOptionalText(record.image_url_mobile_avif),
    link_url: normalizeOptionalText(record.link_url),
    sort_order: Number.isFinite(Number(record.sort_order)) ? Math.trunc(Number(record.sort_order)) : 0,
    active: Boolean(record.active),
    // Linha antiga, ou banco sem a coluna ainda: e o banner do topo, que era o
    // unico que existia antes das areas serem separadas.
    slot: typeof record.slot === "string" && record.slot.trim() ? record.slot.trim() : "topo",
    visible_to: visibleTo,
    created_at: typeof record.created_at === "string" ? record.created_at : "",
    updated_at: typeof record.updated_at === "string" ? record.updated_at : "",
  };
}
