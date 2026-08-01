/**
 * Quem enxerga o que, por tipo de cliente.
 *
 * A mesma regra vale para produto e para banner. Estava escrita solta em cada
 * tela, e por isso corrigir a armadilha num lugar deixava os outros dois
 * quebrados.
 */

export type AlvoComVisibilidade = {
  /** Tipos de cliente que enxergam. Nulo ou vazio = todo mundo. */
  visible_to: string[] | null;
};

export type ContextoDeVisibilidade = {
  /** Tipo do visitante. Nulo em conta interna — admin nao e cliente. */
  customerType: string | null;
  /** Todos os tipos que existem hoje, para reconhecer "marcou tudo". */
  todosOsTipos: readonly string[];
  isAdmin?: boolean;
};

/**
 * Marcar **todos** os tipos vale o mesmo que nao marcar nenhum.
 *
 * Sem isso os dois estados se comportam ao contrario do que a tela promete:
 * "sem nenhum marcado, todos veem", mas marcar a lista inteira passa a *exigir*
 * um tipo — e conta interna nao tem tipo. Quem marcasse tudo achando que estava
 * liberando para todo mundo estava, na pratica, escondendo o item de si mesmo.
 */
function liberadoParaTodos(visibleTo: string[], todosOsTipos: readonly string[]): boolean {
  if (todosOsTipos.length === 0) return false;
  return todosOsTipos.every((tipo) => visibleTo.includes(tipo));
}

export function podeVer(alvo: AlvoComVisibilidade, contexto: ContextoDeVisibilidade): boolean {
  const { visible_to: visibleTo } = alvo;
  if (!visibleTo || visibleTo.length === 0) return true;

  if (liberadoParaTodos(visibleTo, contexto.todosOsTipos)) return true;

  // Quem e da casa ve a loja inteira. Sem isto o admin via *menos* que qualquer
  // visitante, e nao conseguia conferir a propria configuracao.
  if (contexto.isAdmin) return true;

  return Boolean(contexto.customerType) && visibleTo.includes(contexto.customerType!);
}
