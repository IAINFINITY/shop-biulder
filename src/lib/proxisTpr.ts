export const DEFAULT_PROXSIS_TPR_ID = 8728;
export const LEGACY_PROXSIS_TPR_ID = 8278;

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

export function normalizeProxisTprId(value: unknown): number | null {
  const id = positiveId(value);
  if (id === null) return null;
  return id === LEGACY_PROXSIS_TPR_ID ? DEFAULT_PROXSIS_TPR_ID : id;
}

export function resolveConfiguredProxisTprId(value: unknown): number {
  return normalizeProxisTprId(value) ?? DEFAULT_PROXSIS_TPR_ID;
}

export function resolveCustomerProxisTpr(tables: unknown): {
  tprId: number;
  customerTableIds: number[];
} {
  const rows = Array.isArray(tables) ? tables : [];
  const customerTableIds = rows
    .map((row) => (
      row && typeof row === "object"
        ? normalizeProxisTprId((row as Record<string, unknown>).tpr_id)
        : null
    ))
    .filter((id): id is number => id !== null);

  return {
    tprId: customerTableIds[0] ?? DEFAULT_PROXSIS_TPR_ID,
    customerTableIds,
  };
}

export function isB2bProxisTprId(value: unknown): boolean {
  const id = normalizeProxisTprId(value);
  return id === DEFAULT_PROXSIS_TPR_ID || id === 8729;
}
