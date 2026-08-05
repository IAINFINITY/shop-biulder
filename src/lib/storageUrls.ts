const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";

/**
 * Caminho do objeto dentro do bucket, a partir da URL publica.
 *
 * Serve como chave de comparacao entre duas URLs: depois da troca de projeto a
 * mesma foto aparece ora com o host antigo, ora com o novo, e ainda pode vir com
 * query de cache ou escape diferente. Comparar a URL crua deixaria as duas
 * passar como se fossem imagens distintas.
 */
export function storageObjectKey(url: string | null | undefined, bucket: string): string | null {
  if (typeof url !== "string") return null;

  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;

  const objectPath = url.slice(index + marker.length).split("?")[0].split("#")[0];
  if (!objectPath) return null;

  try {
    return decodeURIComponent(objectPath);
  } catch {
    return objectPath;
  }
}

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
