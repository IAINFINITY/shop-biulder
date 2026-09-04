/**
 * Lista ou grade, e o que o navegador lembra.
 *
 * ## Por que lista é o padrão
 *
 * A pesquisa de catálogo B2B converge nisso, e o motivo não é gosto: quem
 * compra no atacado não está descobrindo produto, está **repondo estoque**. A
 * pessoa chega sabendo o que quer, procura pelo código, confere o preço e a
 * quantidade e segue. A linha entrega esses campos alinhados numa coluna, do
 * jeito que uma planilha entrega — e é assim que esse trabalho é feito hoje,
 * fora do site.
 *
 * A grade responde outra pergunta: "o que existe?". Ela é melhor quando a foto
 * decide a compra — roupa, decoração — e por isso continua aqui, a um clique.
 * A ressalva da Baymard é justamente essa: lista é pior para avaliar produto
 * cuja escolha depende do visual. Chá e cápsula não são desses.
 *
 * ## A escolha é lembrada
 *
 * Trocar de modo a cada visita seria pior que não ter a opção. Fica no
 * `localStorage`, por navegador — não é dado de conta, é preferência de tela.
 */

export const MODOS_DE_EXIBICAO = ["lista", "grade"] as const;

export type ModoDeExibicao = (typeof MODOS_DE_EXIBICAO)[number];

/** Lista, por decisão — ver a nota acima. */
export const MODO_PADRAO: ModoDeExibicao = "lista";

const CHAVE = "clinicplus_modo_de_exibicao";

export function ehModoDeExibicao(valor: unknown): valor is ModoDeExibicao {
  return typeof valor === "string" && (MODOS_DE_EXIBICAO as readonly string[]).includes(valor);
}

/**
 * O modo que este navegador guardou.
 *
 * ⚠️ Dentro de `try`: `localStorage` **lança** em aba anônima com cookies
 * bloqueados, e não é aceitável que a escolha de layout derrube o catálogo.
 */
export function lerModoDeExibicao(): ModoDeExibicao {
  try {
    if (typeof window === "undefined") return MODO_PADRAO;
    const guardado = window.localStorage.getItem(CHAVE);
    return ehModoDeExibicao(guardado) ? guardado : MODO_PADRAO;
  } catch {
    return MODO_PADRAO;
  }
}

export function guardarModoDeExibicao(modo: ModoDeExibicao): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CHAVE, modo);
  } catch {
    // Sem persistência a tela continua funcionando; só esquece na próxima visita.
  }
}
