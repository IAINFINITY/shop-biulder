const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";

export function normalizeStoragePublicUrl(url: string | null | undefined, bucket: string): string | null {
  if (typeof url !== "string") return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = trimmed.indexOf(marker);
  if (index < 0) return trimmed;

  const objectPath = trimmed.slice(index + marker.length).split("?")[0].split("#")[0];
  if (!objectPath || !SUPABASE_URL) return trimmed;

  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectPath}`;
}
