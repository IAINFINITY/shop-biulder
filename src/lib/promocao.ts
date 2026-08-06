/**
 * Promocao, e a unica regra que a define — usada no navegador e no servidor.
 *
 * O modelo anterior nao funcionava com tabela de preco por cliente. `is_promotion`
 * era um booleano que so acendia selo, sem tocar em preco, e `compare_at_price`
 * era um "de" global. Como o preco exibido e por cliente (TPR -> tabela geral ->
 * cadastro), um "de" global mentia: o cliente da TPR que paga 51,99 num produto
 * de catalogo 79,99 veria "-35%" para sempre, e isso e a tabela comercial dele,
 * nao uma promocao.
 *
 * Aqui a promocao e **percentual sobre a base de cada cliente**. Preco fixo nao
 * serviria: um "R$ 59,90 promocional" pode ficar acima do que o distribuidor ja
 * paga, e a promocao viraria aumento. Com percentual, o desconto e real para
 * todos e o "de" e sempre o preco que aquela pessoa pagaria sem ela.
 *
 * O arquivo e puro de proposito: e a mesma funcao que o `api/` usa para recalcular
 * o preco antes de mandar ao ERP. Se a regra vivesse so no front, o pedido sairia
 * com o desconto que o navegador afirmasse.
 */

export type ProdutoComPromocao = {
  promo_percent: number | null;
  promo_starts_at: string | null;
  promo_ends_at: string | null;
};

/** Mesmo teto do `check` da tabela: acima disso e quase certo erro de digitacao. */
export const PROMO_PERCENT_MAX = 90;

function percentualValido(valor: unknown): number | null {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  if (numero <= 0 || numero > PROMO_PERCENT_MAX) return null;
  return numero;
}

function instante(valor: string | null): number | null {
  if (!valor) return null;
  const tempo = new Date(valor).getTime();
  return Number.isFinite(tempo) ? tempo : null;
}

/**
 * A promocao esta valendo agora?
 *
 * Janela aberta dos dois lados e permitida: sem inicio vale desde sempre, sem
 * fim vale ate alguem tirar. O que nao existe e promocao sem percentual — era
 * exatamente o estado dos 4 produtos marcados como promocao e sem desconto
 * nenhum.
 */
export function promocaoAtiva(produto: ProdutoComPromocao, agora: Date = new Date()): boolean {
  if (percentualValido(produto.promo_percent) === null) return false;

  const momento = agora.getTime();
  const inicio = instante(produto.promo_starts_at);
  const fim = instante(produto.promo_ends_at);

  if (inicio !== null && momento < inicio) return false;
  if (fim !== null && momento >= fim) return false;
  return true;
}

/**
 * "Este produto esta em promocao?" — a pergunta de quem compra.
 *
 * Aceita o produto do catalogo inteiro, com as colunas opcionais, para os
 * pontos de leitura nao precisarem remontar o objeto a cada chamada.
 *
 * Repare que **nao** consulta `is_promotion`. Aquele booleano e curadoria — diz
 * se o produto entra no carrossel da home —, nao preco. Quem tem desconto
 * valendo esta em promocao mesmo sem ter sido escolhido para a vitrine, e quem
 * foi escolhido mas esta fora da janela nao esta.
 */
export function estaEmPromocao(
  produto: Partial<ProdutoComPromocao>,
  agora: Date = new Date(),
): boolean {
  return promocaoAtiva(
    {
      promo_percent: produto.promo_percent ?? null,
      promo_starts_at: produto.promo_starts_at ?? null,
      promo_ends_at: produto.promo_ends_at ?? null,
    },
    agora,
  );
}

/**
 * Pode marcar "Destaque em Promoções"?
 *
 * A vitrine de promocao e uma promessa: quem clica ali espera pagar menos. Sem
 * percentual o produto entrava no carrossel com o preco cheio — anuncio de
 * desconto que nao existe. Era o estado de 4 produtos, e nada no cadastro
 * impedia.
 *
 * A checagem e so do percentual, de proposito. Janela de data nao entra: uma
 * promocao agendada para semana que vem e legitima, e barrar o cadastro dela
 * obrigaria a marcar tudo no dia. Fora da janela o produto simplesmente nao
 * aparece como promocao — quem decide isso e `promocaoAtiva`, na leitura.
 */
export function podeDestacarEmPromocao(produto: Pick<ProdutoComPromocao, "promo_percent">): boolean {
  return percentualValido(produto.promo_percent) !== null;
}

/** O motivo, para o formulario dizer o que falta em vez de so travar. */
export function motivoParaNaoDestacar(
  produto: Pick<ProdutoComPromocao, "promo_percent">,
): string | null {
  const bruto = produto.promo_percent;
  if (bruto === null || bruto === undefined || `${bruto}`.trim() === "") {
    return "Informe o desconto da promoção (%) antes de destacar o produto em Promoções.";
  }
  if (podeDestacarEmPromocao(produto)) return null;
  return `O desconto precisa ser maior que 0 e no máximo ${PROMO_PERCENT_MAX}%.`;
}

export type PrecoPromocional = {
  /** O que a pessoa pagaria sem a promocao — a base dela, nao a do catalogo. */
  de: number;
  /** O que ela paga agora. */
  por: number;
  /** Inteiro, para o selo. */
  percent: number;
};

/**
 * Aplica a promocao sobre a base do cliente.
 *
 * `base` ja e o preco resolvido para aquela pessoa: TPR, tabela geral ou
 * cadastro. E por isso que o desconto sai correto para todos sem a promocao
 * precisar saber qual tabela ele usa.
 *
 * Arredonda para centavo **antes** de comparar: sem isso um desconto minusculo
 * poderia produzir `de` e `por` iguais na tela e ainda assim exibir o riscado.
 */
export function aplicarPromocao(
  base: number,
  produto: ProdutoComPromocao,
  agora: Date = new Date(),
): PrecoPromocional | null {
  const percent = percentualValido(produto.promo_percent);
  if (percent === null || !promocaoAtiva(produto, agora)) return null;
  if (!Number.isFinite(base) || base <= 0) return null;

  const de = Math.round(base * 100) / 100;
  const por = Math.round(de * (1 - percent / 100) * 100) / 100;

  if (por <= 0 || por >= de) return null;

  return { de, por, percent: Math.round(percent) };
}

/**
 * O preco final, com promocao quando houver.
 *
 * E o valor que vale em tudo: vitrine, carrinho, checkout e o que o servidor
 * manda ao ERP. Quem so quer saber "quanto custa" chama isto.
 */
export function precoFinalComPromocao(
  base: number,
  produto: ProdutoComPromocao,
  agora: Date = new Date(),
): number {
  return aplicarPromocao(base, produto, agora)?.por ?? base;
}
