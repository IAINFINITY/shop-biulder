// Executar em paralelo, mas com teto.
//
// Sem rede e sem `process.env`: e importado pelas funcoes em `api/` e pelo
// bundle do navegador.

/**
 * Aplica `fn` a cada item com no maximo `limite` execucoes simultaneas.
 *
 * O resultado sai **na ordem da entrada**, e nao na ordem em que terminou. Isso
 * importa quando a saida vira uma lista mostrada a alguem: um pedido cujos itens
 * mudam de ordem a cada envio e impossivel de conferir contra o carrinho.
 *
 * O teto existe porque o outro lado costuma ser um servico de terceiro. Disparar
 * o carrinho inteiro de uma vez troca "lento demais" por "recusado por excesso
 * de requisicoes", que e pior: o primeiro entrega o pedido, o segundo nao.
 *
 * Rejeicao de `fn` **nao** e tratada aqui — quem chama decide se um item que
 * falhou derruba o lote ou vira uma linha de erro. Envolver em try/catch por
 * dentro esconderia a falha de quem precisa dela.
 */
export async function mapearComLimite<T, R>(
  itens: readonly T[],
  limite: number,
  fn: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const teto = Math.max(1, Math.trunc(limite) || 1);
  const resultados = new Array<R>(itens.length);

  let proximo = 0;
  async function trabalhar(): Promise<void> {
    while (proximo < itens.length) {
      // Le e incrementa antes de qualquer `await`: entre os dois nao pode haver
      // ponto de suspensao, ou duas execucoes pegariam o mesmo indice.
      const indice = proximo;
      proximo += 1;
      resultados[indice] = await fn(itens[indice], indice);
    }
  }

  await Promise.all(Array.from({ length: Math.min(teto, itens.length) }, () => trabalhar()));
  return resultados;
}
