/**
 * Subcategorias de um produto — leitura unica para todo o projeto.
 *
 * O modelo tem duas colunas de proposito: `family` e a **principal** (a que
 * aparece na etiqueta, na linha do pedido e no payload do ERP) e `families` e a
 * lista completa, que manda no filtro e na arvore de categorias.
 *
 * Duas colunas so nao viram divergencia porque ninguem le nenhuma das duas
 * diretamente para decidir pertencimento: passa tudo por aqui. E a principal e
 * sempre a primeira da lista, entao nao ha como uma contradizer a outra.
 */

export type ProdutoComSubcategorias = {
  family: string | null;
  families?: string[] | null;
};

function limpar(valores: readonly (string | null | undefined)[]): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const valor of valores) {
    const texto = (valor ?? "").trim();
    if (!texto || vistos.has(texto)) continue;
    vistos.add(texto);
    saida.push(texto);
  }
  return saida;
}

/**
 * Todas as subcategorias, sem repetidos e sem vazios.
 *
 * Cai para `family` quando `families` ainda nao existe — e o estado de qualquer
 * produto antes da migration rodar, e tambem o de um registro montado a mao
 * (previa do admin, por exemplo). Sem essa queda, o produto sumiria da arvore de
 * filtros no intervalo entre subir o codigo e rodar a migration.
 */
export function subcategoriasDoProduto(produto: ProdutoComSubcategorias): string[] {
  const lista = Array.isArray(produto.families) ? produto.families : [];
  if (lista.length > 0) return limpar(lista);
  return limpar([produto.family]);
}

/**
 * A principal — a que vai para a etiqueta, o pedido e o ERP.
 *
 * E sempre a primeira da lista. Guardar isso numa coluna propria evita que cada
 * tela escolha a sua e o mesmo produto apareca como "Chas" numa e "Fibras" em
 * outra.
 */
export function subcategoriaPrincipal(produto: ProdutoComSubcategorias): string {
  return subcategoriasDoProduto(produto)[0] ?? "";
}

/** O produto pertence a esta subcategoria? Compara contra a lista inteira. */
export function produtoTemSubcategoria(
  produto: ProdutoComSubcategorias,
  subcategoria: string,
): boolean {
  const alvo = subcategoria.trim();
  if (!alvo) return false;
  return subcategoriasDoProduto(produto).includes(alvo);
}

/**
 * Normaliza o que o formulario do admin devolve.
 *
 * A ordem importa: a primeira vira a principal. Por isso nao ordena
 * alfabeticamente — quem cadastra escolhe qual e a principal pela ordem em que
 * marca.
 */
export function normalizarSubcategorias(valores: readonly string[]): string[] {
  return limpar(valores);
}
