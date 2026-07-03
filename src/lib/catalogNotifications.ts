export const CATALOG_NOTIFICATIONS_TABLE = "catalog_notifications";

export type CatalogNotification = {
  id: string;
  title: string;
  summary: string;
  body: string;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  target_user_id: string | null;
  active: boolean;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
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

function normalizeDate(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function normalizeCatalogNotificationFromSupabaseRow(row: unknown): CatalogNotification {
  const record = isRecord(row) ? row : {};

  return {
    id: typeof record.id === "string" ? record.id : "",
    title: typeof record.title === "string" ? record.title : "Notificação",
    summary: typeof record.summary === "string" ? record.summary : "",
    body: typeof record.body === "string" ? record.body : "",
    image_url: normalizeOptionalText(record.image_url),
    cta_label: normalizeOptionalText(record.cta_label),
    cta_url: normalizeOptionalText(record.cta_url),
    target_user_id: normalizeOptionalText(record.target_user_id),
    active: Boolean(record.active),
    priority: Number.isFinite(Number(record.priority)) ? Math.trunc(Number(record.priority)) : 0,
    starts_at: normalizeDate(record.starts_at),
    ends_at: normalizeDate(record.ends_at),
    created_at: typeof record.created_at === "string" ? record.created_at : "",
    updated_at: typeof record.updated_at === "string" ? record.updated_at : "",
  };
}
