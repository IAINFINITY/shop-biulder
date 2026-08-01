// Listas de IDs de produto guardadas no navegador (favoritos, vistos
// recentemente).
//
// As duas repetiam o mesmo codigo de leitura/escrita, e nenhuma limitava o
// tamanho nem removia repetidos de forma confiavel. O ponto sensivel e a ordem:
// tanto "vistos recentemente" quanto "favoritos" so fazem sentido do mais
// recente para o mais antigo, e essa ordem precisa sobreviver a serializacao.

export function readProductIdList(storageKey: string): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return dedupeIds(parsed.filter((id): id is string => typeof id === "string" && id.trim() !== ""));
  } catch {
    return [];
  }
}

export function writeProductIdList(storageKey: string, ids: string[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch {
    // Storage cheio ou bloqueado: a lista continua valendo em memoria.
  }
}

export function clearProductIdList(storageKey: string): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // noop
  }
}

/** Remove repetidos mantendo a primeira ocorrencia — ou seja, a mais recente. */
export function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

/** Coloca o id no topo, sem duplicar, respeitando o teto da lista. */
export function promoteId(ids: string[], productId: string, maxItems: number): string[] {
  return [productId, ...ids.filter((id) => id !== productId)].slice(0, maxItems);
}

export function toggleId(ids: string[], productId: string, maxItems: number): string[] {
  return ids.includes(productId)
    ? ids.filter((id) => id !== productId)
    : promoteId(ids, productId, maxItems);
}

/**
 * Resolve os IDs para produtos **preservando a ordem da lista**.
 *
 * Era aqui que a ordem se perdia: o catalogo filtrava o array de produtos
 * (ordenado por nome no banco) em vez de percorrer os ids, entao "vistos
 * recentemente" aparecia em ordem alfabetica.
 *
 * IDs que nao resolvem sao apenas ignorados — podem ser de produto
 * temporariamente inativo, e apagar a preferencia do cliente por causa disso
 * seria perda de dado.
 */
export function resolveProductsByIdOrder<T extends { id: string }>(
  ids: string[],
  products: T[],
  limit?: number,
): T[] {
  if (ids.length === 0 || products.length === 0) return [];

  const byId = new Map(products.map((product) => [product.id, product]));
  const resolved: T[] = [];

  for (const id of ids) {
    const product = byId.get(id);
    if (!product) continue;
    resolved.push(product);
    if (limit !== undefined && resolved.length >= limit) break;
  }

  return resolved;
}
