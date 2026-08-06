/**
 * Lista de recompra — a regra, sem nenhum I/O.
 *
 * O modelo antigo era wishlist de B2C: uma lista de ids no `localStorage`, so
 * para olhar depois. Em B2B a mesma tela e outra coisa — o comprador repete
 * pedido, entao o que importa e **quanto** de cada item e mandar tudo de uma vez
 * para o carrinho. Por isso o item aqui carrega quantidade, e nao so o id.
 *
 * Segue a divisao que `serverPricing.ts` e `proxisTpr.ts` ja usavam: a regra vive
 * aqui e da para testar sem subir banco; o I/O fica em `useWishlist`.
 */

export type ItemFavorito = {
  productId: string;
  /** Quanto o cliente costuma pedir deste item. Sempre >= 1. */
  quantity: number;
};

/**
 * Teto da lista.
 *
 * Herdado do modelo antigo e mantido: num catalogo B2B o cliente favorita o que
 * recompra, e 200 cobre o catalogo inteiro com folga sem deixar a lista virar
 * lixo eterno. O banco tambem nao limita — quem limita e este numero.
 */
export const MAX_FAVORITOS = 200;

/** Mesmo teto do `check` da tabela e do `normalizeQuantity` do carrinho. */
export const MAX_QUANTIDADE = 9999;

export function normalizarQuantidade(quantidade: number): number {
  if (!Number.isFinite(quantidade)) return 1;
  return Math.min(MAX_QUANTIDADE, Math.max(1, Math.round(quantidade)));
}

/** Remove repetidos mantendo a primeira ocorrencia — a mais recente. */
export function dedupeFavoritos(itens: ItemFavorito[]): ItemFavorito[] {
  const vistos = new Set<string>();
  const saida: ItemFavorito[] = [];
  for (const item of itens) {
    if (vistos.has(item.productId)) continue;
    vistos.add(item.productId);
    saida.push({ productId: item.productId, quantity: normalizarQuantidade(item.quantity) });
  }
  return saida;
}

/** Coloca o item no topo, sem duplicar, respeitando o teto. */
export function promoverFavorito(itens: ItemFavorito[], item: ItemFavorito): ItemFavorito[] {
  const resto = itens.filter((i) => i.productId !== item.productId);
  return [{ ...item, quantity: normalizarQuantidade(item.quantity) }, ...resto].slice(0, MAX_FAVORITOS);
}

export function alternarFavorito(itens: ItemFavorito[], productId: string): ItemFavorito[] {
  return itens.some((i) => i.productId === productId)
    ? itens.filter((i) => i.productId !== productId)
    : promoverFavorito(itens, { productId, quantity: 1 });
}

export function definirQuantidade(
  itens: ItemFavorito[],
  productId: string,
  quantidade: number,
): ItemFavorito[] {
  return itens.map((i) =>
    i.productId === productId ? { ...i, quantity: normalizarQuantidade(quantidade) } : i,
  );
}

/**
 * Junta a lista do aparelho com a da conta, no primeiro login.
 *
 * Sem isso o cliente perde o que salvou antes de entrar — que e justamente o
 * caso que a Baymard manda proteger: salvar nao pode exigir conta, entao o
 * convidado acumula lista, e essa lista tem que sobreviver ao login.
 *
 * **A conta vence nos repetidos.** A quantidade que esta no banco foi definida
 * deliberadamente por alguem logado; a local pode ser so o `1` que o coracao
 * gravou sem ninguem pensar a respeito.
 *
 * A ordem tambem nao e escolha de estilo: o remoto vem primeiro porque tem
 * `created_at` de verdade. A lista local nao guarda quando cada item entrou,
 * entao intercalar as duas seria inventar uma cronologia que nao existe.
 */
export function mesclarFavoritos(local: ItemFavorito[], remoto: ItemFavorito[]): ItemFavorito[] {
  const naConta = new Set(remoto.map((i) => i.productId));
  const soLocais = local.filter((i) => !naConta.has(i.productId));
  return dedupeFavoritos([...remoto, ...soLocais]).slice(0, MAX_FAVORITOS);
}

/**
 * Le o que estava gravado no aparelho.
 *
 * Recebe a string crua em vez de mexer no `localStorage` para continuar pura e
 * testavel — o acesso ao `window` fica no hook.
 *
 * Aceita **os dois formatos**: o antigo era `string[]` de ids, sem quantidade.
 * Quem ja tinha lista salva nao pode perde-la so porque o formato mudou, entao
 * id solto entra com quantidade 1.
 */
export function parseFavoritosArmazenados(raw: string | null): ItemFavorito[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const itens: ItemFavorito[] = [];
  for (const entrada of parsed) {
    if (typeof entrada === "string" && entrada.trim() !== "") {
      itens.push({ productId: entrada, quantity: 1 });
      continue;
    }
    if (entrada && typeof entrada === "object" && "productId" in entrada) {
      const { productId, quantity } = entrada as { productId: unknown; quantity?: unknown };
      if (typeof productId !== "string" || productId.trim() === "") continue;
      itens.push({ productId, quantity: normalizarQuantidade(Number(quantity ?? 1)) });
    }
  }

  return dedupeFavoritos(itens);
}

/**
 * O que vai para o carrinho quando o cliente manda a lista inteira.
 *
 * Ids que nao resolvem em produto sao ignorados em silencio — produto sai de
 * linha e volta, e a lista guarda id, nao o produto. Devolver so o que resolveu
 * evita que a acao em lote quebre por causa de um item inativo.
 */
export function itensParaCarrinho<T extends { id: string }>(
  itens: ItemFavorito[],
  selecionados: ReadonlySet<string>,
  produtos: T[],
): Array<{ produto: T; quantidade: number }> {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const saida: Array<{ produto: T; quantidade: number }> = [];

  for (const item of itens) {
    if (!selecionados.has(item.productId)) continue;
    const produto = porId.get(item.productId);
    if (!produto) continue;
    saida.push({ produto, quantidade: normalizarQuantidade(item.quantity) });
  }

  return saida;
}
