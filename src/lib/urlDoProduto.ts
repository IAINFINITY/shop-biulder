/**
 * O endereco de um produto: nome legivel + codigo.
 *
 * `/produto/cha-mais-anis-estrelado-2188`
 *
 * O catalogo linkava pelo `id` do banco — `/produto/8eb8f847-4041-446d-a128-
 * 083633073c41`. Um UUID nao diz nada para quem le, nao sobrevive a ser colado
 * num WhatsApp e nao ajuda a busca.
 *
 * So o codigo (`/produto/2188`) seria melhor, mas cai na mesma categoria: a
 * orientacao do Google Search Central e explicita em desaconselhar "numeros de
 * produto ou SKU nao descritivos" na URL, junto com query string, porque
 * confundem tanto usuario quanto buscador. O que os grandes usam — Amazon,
 * Shopify, Mercado Livre — e **texto legivel mais um identificador**: o texto
 * para a pessoa, o identificador para resolver sem ambiguidade.
 *
 * A vantagem pratica de manter o codigo no fim e que renomear produto nao quebra
 * link nenhum. O `slug` e enfeite: quem resolve e o codigo. Por isso
 * `encontrarProdutoPelaUrl` tenta varias formas, e a pagina redireciona para o
 * endereco canonico quando o que chegou nao e o atual.
 */

/** Comprimento maximo do trecho legivel. Endereco inteiro fica bem abaixo de 100 caracteres. */
const MAX_SLUG = 60;

/** Codigo aceito na URL sem escapar nada. */
const CODIGO_SEGURO = /^[A-Za-z0-9._]+$/;

/**
 * Texto vira slug: sem acento, sem simbolo, palavras separadas por hifen.
 *
 * `normalize("NFD")` separa a letra do acento, e a faixa `̀-ͯ` apaga
 * so a marca de acento — assim "Chá" vira "cha" e nao "ch".
 */
export function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, "");
}

export type ProdutoEnderecavel = {
  id: string;
  product_code?: string | null;
  name?: string | null;
};

/**
 * O identificador do produto na URL — o que vai depois de `/produto/`.
 *
 * Sem codigo utilizavel, cai no `id`. E o caso de produto cadastrado sem codigo:
 * pior endereco, mas link que funciona.
 */
export function identificadorDoProduto(produto: ProdutoEnderecavel): string {
  const codigo = (produto.product_code ?? "").trim();
  if (!codigo || !CODIGO_SEGURO.test(codigo)) return produto.id;

  const slug = slugificar(produto.name ?? "");
  return slug ? `${slug}-${codigo}` : codigo;
}

export function caminhoDoProduto(produto: ProdutoEnderecavel): string {
  return `/produto/${identificadorDoProduto(produto)}`;
}

/**
 * O codigo escondido no fim do identificador.
 *
 * `cha-mais-anis-estrelado-2188` → `2188`. Como o codigo nunca tem hifen (a
 * allowlist de `identificadorDoProduto` nao aceita), o ultimo hifen sempre separa
 * slug de codigo.
 */
export function codigoNaUrl(identificador: string): string | null {
  const corte = identificador.lastIndexOf("-");
  if (corte < 0) return null;
  const codigo = identificador.slice(corte + 1);
  return codigo && CODIGO_SEGURO.test(codigo) ? codigo : null;
}

/**
 * Acha o produto a partir do que veio na URL, em ordem de confianca.
 *
 * As quatro formas existem porque links antigos continuam circulando: o UUID
 * puro esteve publicado, e o codigo puro tambem. Quebrar link ja compartilhado
 * seria custo sem ganho — sao quatro comparacoes numa lista que ja esta na
 * memoria.
 */
export function encontrarProdutoPelaUrl<T extends ProdutoEnderecavel>(
  produtos: readonly T[],
  parametro: string | undefined | null,
): T | null {
  // `decodeURIComponent` estoura em `%` solto, e URL torta chega o tempo todo
  // (link cortado no WhatsApp, robo de varredura). Melhor tentar o texto cru.
  const bruto = (parametro ?? "").trim();
  let chave = bruto;
  try {
    chave = decodeURIComponent(bruto);
  } catch {
    chave = bruto;
  }
  if (!chave) return null;

  const porCodigo = (codigo: string) =>
    produtos.find((item) => (item.product_code ?? "").trim() === codigo) ?? null;

  return (
    // 1. endereco atual, com slug
    produtos.find((item) => identificadorDoProduto(item) === chave) ??
    // 2. codigo puro, sem slug — como os links ficaram por um deploy
    porCodigo(chave) ??
    // 3. slug desatualizado: o produto foi renomeado depois do link sair
    (codigoNaUrl(chave) ? porCodigo(codigoNaUrl(chave)!) : null) ??
    // 4. UUID, o formato original
    produtos.find((item) => item.id === chave) ??
    null
  );
}
