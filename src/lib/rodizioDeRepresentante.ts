// Qual representante recebe o pedido.
//
// Sem rede e sem `process.env`: a lista chega por parametro, e quem le do
// ambiente e a rota.

/**
 * ## O defeito que isto corrige
 *
 * O rodizio era um contador de modulo — `let indice = 0`, incrementado a cada
 * pedido. Numa funcao serverless isso nao roda em um processo so: cada instancia
 * fria comeca do zero, e as instancias nao conversam. O resultado observavel e
 * que os primeiros representantes da lista recebem quase tudo e os ultimos
 * quase nada, exatamente o oposto do que "rodizio" promete.
 *
 * ## Como o sorteio passa a funcionar
 *
 * O indice vem de um hash da propria chave do pedido, e nao de um contador. Sem
 * estado compartilhado, sem depender de quantas instancias existem, e
 * **deterministico**: reenviar o mesmo pedido cai no mesmo representante, em vez
 * de sortear outro e criar duas comissoes para uma venda.
 *
 * A chave preferida e a `submission_key`, que muda a cada pedido — e o que
 * mantem a distribuicao entre pedidos, que era a intencao original. Sem ela,
 * cai no CNPJ: a distribuicao continua espalhada entre clientes, mas o mesmo
 * cliente passa a cair sempre no mesmo representante.
 *
 * ## FNV-1a
 *
 * Hash pequeno e sem dependencia. Nao e criptografico e nao precisa ser: aqui
 * so se pede espalhamento uniforme sobre uma lista de nove posicoes.
 */
export function hashDeRodizio(chave: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < chave.length; i += 1) {
    hash ^= chave.charCodeAt(i);
    // Multiplicacao FNV pelo primo 16777619, em partes para nao estourar a
    // precisao de 32 bits do JS.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Representante para este pedido.
 *
 * `explicito` vence quando pertence a lista — e o reenvio pelo painel, em que
 * alguem ja escolheu. Fora disso, sorteia por `chave`.
 *
 * Devolve `null` quando a lista esta vazia: inventar um id aqui mandaria o
 * pedido para um representante que nao existe no ERP.
 */
export function escolherRepresentante(
  lista: readonly number[],
  chave: string,
  explicito: number | null = null,
): number | null {
  if (lista.length === 0) return null;
  if (explicito !== null && lista.includes(explicito)) return explicito;

  const limpa = chave.trim();
  // Sem chave nao ha o que espalhar; a primeira posicao e tao arbitraria quanto
  // qualquer outra, e pelo menos e estavel.
  if (!limpa) return lista[0];

  return lista[hashDeRodizio(limpa) % lista.length];
}
