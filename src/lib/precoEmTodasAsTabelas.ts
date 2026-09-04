/**
 * O preço de **um produto** em todas as tabelas, de uma vez.
 *
 * ## O pedido
 *
 * "eu preciso ir dentro de cada planilha dessas, nessas tabelas, procurar o
 * produto e alterar o valor. Não tem como abrir um campo ali, produto 4187, e
 * eu cadastrar ao mesmo tempo os três preços, de distribuidor, de representante,
 * de funcionário, numa abertura única de janela?"
 *
 * Hoje o caminho é por tabela: abrir a tabela, achar o produto na lista, mudar,
 * salvar, voltar, repetir. Para um produto em seis escopos são seis viagens — e
 * quem faz isso está justamente comparando os seis valores entre si.
 *
 * ## Os dois tipos de escopo
 *
 * O preço mora todo em `clinic+b2b_customer_price_overrides`, distinguido por
 * duas colunas:
 *
 * | escopo | `customer_type` | `proxis_tpr_id` |
 * |---|---|---|
 * | geral do tipo de conta | 'funcionario', 'lojista'… | **nulo** |
 * | tabela negociada       | 'cliente'                 | 8728, 8729… |
 *
 * ⚠️ O `is null` no primeiro caso não é detalhe: sem ele, a consulta do tipo
 * "cliente" varre também as tabelas 8728 e 8729, que são desse tipo. Foi o bug
 * de preço de 01/09.
 *
 * ## Nada aqui toca o banco
 *
 * Convenção do projeto: regra pura em `src/lib`. Estas funções montam a lista de
 * escopos, dizem o que mudou e recusam o que não faz sentido gravar — quem grava
 * é o diálogo.
 */

export type EscopoDePreco =
  | { tipo: "geral"; customerType: string; rotulo: string }
  | { tipo: "tabela"; tprId: number; customerType: string; rotulo: string; ativa: boolean };

/** A linha do produto num escopo: o que já existe e o que foi digitado. */
export type LinhaDePrecoDoProduto = {
  escopo: EscopoDePreco;
  /** O preço gravado hoje. `null` quando o escopo não tem preço próprio. */
  precoAtual: number | null;
  /** `false` quando existe linha, mas desligada. */
  ativo: boolean;
};

/** A chave que identifica o escopo — serve de `key` na tela e de índice. */
export function chaveDoEscopo(escopo: EscopoDePreco): string {
  return escopo.tipo === "geral" ? `geral:${escopo.customerType}` : `tabela:${escopo.tprId}`;
}

/**
 * Monta a lista de escopos, na ordem em que a tela mostra.
 *
 * Os gerais primeiro, porque são o preço de partida de cada tipo de conta; as
 * tabelas negociadas depois, que são exceções por cima disso.
 */
export function montarEscopos(
  // `name`/`label` é a forma que `useCustomerTypes` devolve — não inventar um
  // terceiro nome para o mesmo campo.
  tiposDeConta: readonly { name: string; label: string }[],
  tabelas: readonly { tprId: number; description: string; ativa: boolean }[],
): EscopoDePreco[] {
  const gerais: EscopoDePreco[] = tiposDeConta.map((tipo) => ({
    tipo: "geral",
    customerType: tipo.name,
    rotulo: tipo.label,
  }));

  const negociadas: EscopoDePreco[] = [...tabelas]
    .sort((a, b) => a.tprId - b.tprId)
    .map((tabela) => ({
      tipo: "tabela",
      tprId: tabela.tprId,
      // Tabela negociada é sempre do tipo `cliente` — é assim que as 8728/8729
      // estão gravadas, e é o que `_pricing.ts` espera ao resolver o preço.
      customerType: "cliente",
      rotulo: tabela.description || `Tabela ${tabela.tprId}`,
      ativa: tabela.ativa,
    }));

  return [...gerais, ...negociadas];
}

/**
 * Lê o que foi digitado.
 *
 * Aceita `1.234,56` e `24.99`. Devolve `null` para campo vazio — que significa
 * "não mexi nisto", e é diferente de zero.
 *
 * ## ⚠️ A vírgula decide o que o ponto significa
 *
 * Apagar todo ponto e trocar a vírgula por ponto — o jeito curto — transforma
 * `24.99` em **2499**, porque trata o ponto como separador de milhar. Quem
 * digita `24.99` no teclado numérico não quer dois mil e quatrocentos.
 *
 * A regra: **havendo vírgula**, ela é o decimal e o ponto é milhar. **Sem
 * vírgula**, o ponto é o decimal. É o que resolve os dois formatos sem
 * adivinhar pela quantidade de casas.
 */
export function lerPrecoDigitado(valor: string): number | null {
  const limpo = valor.trim().replace(/\s/g, "");
  if (!limpo) return null;

  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;

  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero < 0) return null;

  return Math.round(numero * 100) / 100;
}

/** Como o preço gravado aparece no campo. */
export function formatarParaCampo(preco: number | null): string {
  if (preco === null) return "";
  return preco.toFixed(2).replace(".", ",");
}

export type AlteracaoDePreco = {
  escopo: EscopoDePreco;
  preco: number;
};

/**
 * O que de fato mudou.
 *
 * ⚠️ Campo vazio **não** é alteração. Sem esta regra, abrir o diálogo e salvar
 * gravaria zero em todo escopo que a pessoa não preencheu — que é a mesma
 * armadilha que a tela de uma tabela só já teve.
 *
 * Preço igual ao que já está lá também não entra: gravar por gravar mexe no
 * `updated_at` e faz parecer que alguém alterou o preço.
 */
export function alteracoesDe(
  linhas: readonly LinhaDePrecoDoProduto[],
  digitado: Readonly<Record<string, string>>,
): AlteracaoDePreco[] {
  const mudancas: AlteracaoDePreco[] = [];

  for (const linha of linhas) {
    const bruto = digitado[chaveDoEscopo(linha.escopo)] ?? "";
    const preco = lerPrecoDigitado(bruto);
    if (preco === null) continue;
    if (linha.precoAtual !== null && Math.abs(linha.precoAtual - preco) < 0.005) continue;
    mudancas.push({ escopo: linha.escopo, preco });
  }

  return mudancas;
}
