export const CATALOG_NOTIFICATION_READS_TABLE = "clinic+b2b_catalog_notification_reads";

export type CatalogNotificationRead = {
  id: string;
  user_id: string;
  notification_id: string;
  read_at: string;
  /** Quando esta pessoa tirou o aviso da própria lista. */
  dispensado_em: string | null;
  created_at: string;
  updated_at: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizeCatalogNotificationReadFromSupabaseRow(row: unknown): CatalogNotificationRead {
  const record = isRecord(row) ? row : {};

  return {
    id: normalizeText(record.id),
    user_id: normalizeText(record.user_id),
    notification_id: normalizeText(record.notification_id),
    read_at: normalizeText(record.read_at),
    dispensado_em: normalizeText(record.dispensado_em) || null,
    created_at: normalizeText(record.created_at),
    updated_at: normalizeText(record.updated_at),
  };
}
