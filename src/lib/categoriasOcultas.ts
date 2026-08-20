/**
 * Quais categorias o catálogo deve esconder.
 *
 * ## A regra, e por que é assim
 *
 * O registro de categorias (`clinic+b2b_product_types`) só consegue
 * **esconder**. Ele nunca decide o que aparece.
 *
 * A alternativa — a loja mostrar só o que está registrado — falha em dois
 * casos que acontecem de verdade:
 *
 * - produto com um tipo que ninguém cadastrou sumiria do filtro sem aviso;
 * - se a leitura do registro falhasse, a loja ficaria sem categoria alguma.
 *
 * Tratando ausência como "não escondido", os dois viram o comportamento atual:
 * a categoria aparece. Só uma marca explícita tira algo da tela.
 */

export type CategoriaRegistrada = {
  name: string;
  /** `false` esconde. Ausente ou `true` mostram. */
  visivel?: boolean | null;
};

/** Compara categoria ignorando caixa e espaço nas pontas — o `type` do produto é texto livre. */
function chave(nome: string | null | undefined): string {
  return String(nome ?? "").trim().toLowerCase();
}

/**
 * Os nomes marcados como ocultos.
 *
 * Recebe `undefined` sem reclamar: enquanto a consulta não respondeu, nada está
 * escondido, e a loja se comporta como sempre se comportou.
 */
export function nomesOcultos(registro: CategoriaRegistrada[] | null | undefined): Set<string> {
  const ocultos = new Set<string>();
  for (const item of registro ?? []) {
    // `=== false` de propósito. `undefined` acontece quando a coluna ainda não
    // existe no banco (antes da migration) — e ali `!item.visivel` esconderia
    // **todas** as categorias de uma vez.
    if (item?.visivel === false) {
      const nome = chave(item.name);
      if (nome) ocultos.add(nome);
    }
  }
  return ocultos;
}

/**
 * Tira da lista de filtros as categorias escondidas.
 *
 * Genérico no formato da opção porque a vitrine passa `{ value, count }` e
 * outras telas podem passar outra coisa; o que importa é de onde sai o nome.
 */
export function semCategoriasOcultas<T>(
  opcoes: T[],
  ocultos: Set<string>,
  nomeDe: (opcao: T) => string,
): T[] {
  if (ocultos.size === 0) return opcoes;
  return opcoes.filter((opcao) => !ocultos.has(chave(nomeDe(opcao))));
}
