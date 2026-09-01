// O inventário das tabelas de preço: o que existe, quem cada uma atende, e o
// que está errado nelas.
//
// ## Por que existe
//
// A tela de Preços pedia "escolha um escopo" e não dizia nada sobre o que havia
// dentro de cada opção. Quem abria via quatro tipos de conta como se fossem
// equivalentes, e três deles tinham **um produto**. Não havia como saber,
// olhando, que a tabela "Cliente" quase não é o que os clientes veem, porque 38
// dos 44 têm tabela negociada por cima dela.
//
// Aqui as tabelas deixam de ser opções de um seletor e viram uma lista com
// números: quantos produtos, quantas pessoas, editável ou não.
//
// Sem rede e sem `process.env`: recebe o que já foi lido e devolve o resumo.

import { customerTypeLabel } from "@/lib/pricing";
import { DEFAULT_PROXSIS_TPR_ID } from "@/lib/proxisTpr";

export type OverrideParaResumo = {
  customer_type: string;
  proxis_tpr_id: number | null;
  product_code: string;
  active: boolean;
};

export type PerfilParaResumo = {
  customer_type: string | null;
  proxis_tpr_id: number | null;
};

export type TabelaCadastrada = {
  tprId: number;
  description: string;
  usedByCustomers?: boolean;
};

/** Por que esta tabela merece atenção. `null` quando está tudo certo. */
export type AlertaDaTabela = {
  gravidade: "erro" | "aviso";
  texto: string;
};

export type ResumoDeTabela = {
  /** Identidade estável para key de lista e para abrir a tabela. */
  chave: string;
  origem: "tipo" | "negociada";
  nome: string;
  /** Preenchido quando `origem === "site"`. */
  customerType: string | null;
  /** Preenchido quando `origem === "negociada"`. */
  tprId: number | null;
  produtos: number;
  produtosAtivos: number;
  /** Quantas pessoas compram por esta tabela. */
  pessoas: number;
  editavel: boolean;
  /** É a tabela que toda conta nova recebe. Só uma tabela tem isto. */
  padraoDeNovasContas: boolean;
  alerta: AlertaDaTabela | null;
};

const TIPO_PADRAO = "cliente";

function normalizarTipo(valor: string | null | undefined): string {
  const t = typeof valor === "string" ? valor.trim().toLowerCase() : "";
  return t || TIPO_PADRAO;
}

/**
 * Quantas pessoas compram por cada tabela.
 *
 * A regra é a mesma de `deveAplicarTabelaCadastrada`: quem tem TPR compra por ela;
 * quem não tem, pela tabela geral do tipo. Contar de outro jeito faria a tela
 * repetir a mesma pessoa em duas tabelas e prometer um alcance que não existe.
 */
export function contarPessoasPorTabela(perfis: readonly PerfilParaResumo[]) {
  const porTipo = new Map<string, number>();
  const porTpr = new Map<number, number>();

  for (const perfil of perfis) {
    const tipo = normalizarTipo(perfil.customer_type);
    const tpr = perfil.proxis_tpr_id;
    // Funcionário nunca tem TPR (a migration de 25/08 zerou e o gatilho impede),
    // mas o `and tipo !== funcionario` não entra aqui de propósito: se um dia
    // voltar a ter, a contagem tem de mostrar isso em vez de esconder.
    if (typeof tpr === "number" && Number.isFinite(tpr)) {
      porTpr.set(tpr, (porTpr.get(tpr) ?? 0) + 1);
    } else {
      porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + 1);
    }
  }

  return { porTipo, porTpr };
}

function contarProdutos(overrides: readonly OverrideParaResumo[]) {
  const doTipo = new Map<string, { total: number; ativos: number }>();
  const doTpr = new Map<number, { total: number; ativos: number }>();

  for (const linha of overrides) {
    const alvo =
      linha.proxis_tpr_id === null || linha.proxis_tpr_id === undefined
        ? (doTipo.get(normalizarTipo(linha.customer_type)) ??
          (() => {
            const novo = { total: 0, ativos: 0 };
            doTipo.set(normalizarTipo(linha.customer_type), novo);
            return novo;
          })())
        : (doTpr.get(linha.proxis_tpr_id) ??
          (() => {
            const novo = { total: 0, ativos: 0 };
            doTpr.set(linha.proxis_tpr_id!, novo);
            return novo;
          })());
    alvo.total += 1;
    if (linha.active) alvo.ativos += 1;
  }

  return { doTipo, doTpr };
}

/**
 * As tabelas do site — as nossas, editáveis, uma por tipo de cliente.
 *
 * `tiposConhecidos` vem do cadastro de tipos, e não das linhas de preço: um tipo
 * sem nenhum preço precisa aparecer na lista, senão a única forma de descobrir
 * que ele existe é errando.
 */
export function resumirTabelasPorTipo(
  overrides: readonly OverrideParaResumo[],
  perfis: readonly PerfilParaResumo[],
  tiposConhecidos: readonly string[],
): ResumoDeTabela[] {
  const { doTipo } = contarProdutos(overrides);
  const { porTipo } = contarPessoasPorTabela(perfis);

  const tipos = new Set<string>([...tiposConhecidos.map(normalizarTipo), ...doTipo.keys(), ...porTipo.keys()]);

  return [...tipos]
    .map((tipo) => {
      const produtos = doTipo.get(tipo) ?? { total: 0, ativos: 0 };
      const pessoas = porTipo.get(tipo) ?? 0;
      return {
        chave: `tipo:${tipo}`,
        origem: "tipo" as const,
        nome: customerTypeLabel(tipo),
        customerType: tipo,
        tprId: null,
        produtos: produtos.total,
        produtosAtivos: produtos.ativos,
        pessoas,
        editavel: true,
        padraoDeNovasContas: false,
        alerta: alertaDaTabelaDoSite(produtos.ativos, pessoas),
      };
    })
    .sort((a, b) => b.produtos - a.produtos || a.nome.localeCompare(b.nome));
}

function alertaDaTabelaDoSite(produtosAtivos: number, pessoas: number): AlertaDaTabela | null {
  if (pessoas > 0 && produtosAtivos === 0) {
    return { gravidade: "erro", texto: "Sem nenhum preço: todo mundo paga o preço normal do catálogo" };
  }
  if (pessoas > 0 && produtosAtivos <= 2) {
    return { gravidade: "aviso", texto: "Quase sem preços: quase tudo sai pelo preço normal do catálogo" };
  }
  if (pessoas === 0 && produtosAtivos > 0) {
    return { gravidade: "aviso", texto: "Nenhuma conta usa esta tabela" };
  }
  return null;
}

/**
 * As tabelas negociadas — valem para um grupo de contas e passam por cima da
 * tabela do tipo.
 *
 * Entram as cadastradas **e** as que algum cliente aponta sem estarem
 * cadastradas: conta apontando para tabela que não existe é justamente o caso
 * que ninguém enxergava. Hoje há três clientes nas 80 e 82, sem nenhum preço —
 * compram pelo preço de catálogo sem que nada na tela diga isso.
 */
export function resumirTabelasNegociadas(
  overrides: readonly OverrideParaResumo[],
  perfis: readonly PerfilParaResumo[],
  tabelasNegociadas: readonly TabelaCadastrada[],
): ResumoDeTabela[] {
  const { doTpr } = contarProdutos(overrides);
  const { porTpr } = contarPessoasPorTabela(perfis);

  const ids = new Set<number>([...tabelasNegociadas.map((t) => t.tprId), ...doTpr.keys(), ...porTpr.keys()]);

  return [...ids]
    .map((tprId) => {
      const doErp = tabelasNegociadas.find((t) => t.tprId === tprId) ?? null;
      const produtos = doTpr.get(tprId) ?? { total: 0, ativos: 0 };
      const pessoas = porTpr.get(tprId) ?? 0;
      return {
        chave: `negociada:${tprId}`,
        origem: "negociada" as const,
        nome: doErp?.description?.trim() || `Tabela ${tprId}`,
        customerType: null,
        tprId,
        produtos: produtos.total,
        produtosAtivos: produtos.ativos,
        pessoas,
        // Editável desde 31/08/2026: sem o ERP, o preço é mantido aqui. A
        // distinção "só leitura" existia porque a API do ProManager não gravava.
        editavel: true,
        // A regra antiga do projeto: toda conta que se cadastra nasce nesta
        // tabela. Quem abre a tela precisa saber qual é, porque é a que mais
        // gente vai usar amanhã, e nao so hoje.
        padraoDeNovasContas: tprId === DEFAULT_PROXSIS_TPR_ID,
        alerta: alertaDaTabelaCadastrada(produtos.ativos, pessoas, Boolean(doErp)),
      };
    })
    .sort(
      (a, b) =>
        // A padrão primeiro: é a que toda conta nova recebe, então é a que mais
        // gente vai usar, mesmo que hoje não seja a com mais clientes.
        Number(b.padraoDeNovasContas) - Number(a.padraoDeNovasContas) ||
        b.pessoas - a.pessoas ||
        b.produtos - a.produtos ||
        (a.tprId ?? 0) - (b.tprId ?? 0),
    );
}

function alertaDaTabelaCadastrada(
  produtosAtivos: number,
  pessoas: number,
  existeNoErp: boolean,
): AlertaDaTabela | null {
  if (pessoas > 0 && produtosAtivos === 0) {
    return {
      gravidade: "erro",
      texto: existeNoErp
        ? "Tem clientes, mas nenhum preço cadastrado — eles pagam o preço normal do catálogo"
        : "Tem clientes, mas a tabela não está cadastrada",
    };
  }
  if (pessoas === 0 && produtosAtivos > 0) {
    return { gravidade: "aviso", texto: "Nenhum cliente usa esta tabela" };
  }
  return null;
}

/** Só os alertas, para o aviso do topo. Ordena erro antes de aviso. */
export function alertasDasTabelas(tabelas: readonly ResumoDeTabela[]) {
  return tabelas
    .filter((t): t is ResumoDeTabela & { alerta: AlertaDaTabela } => t.alerta !== null)
    .sort((a, b) => (a.alerta.gravidade === b.alerta.gravidade ? 0 : a.alerta.gravidade === "erro" ? -1 : 1));
}

/** O que a chave de uma tabela diz sobre ela, sem precisar da lista carregada. */
export type ChaveDeTabela =
  | { origem: "tipo"; customerType: string; tprId: null }
  | { origem: "negociada"; customerType: null; tprId: number };

/**
 * Lê a chave que veio da URL (`tipo:funcionario`, `negociada:8728`).
 *
 * A chave é auto-descritiva de propósito: a tela precisa saber qual escopo
 * carregar **antes** de a lista de tabelas chegar do banco. Se dependesse de
 * procurar na lista, abrir `/admin?section=precos&tabela=negociada:8728` direto no
 * navegador mostraria a tela vazia até a consulta voltar, e o escopo entraria
 * depois — dois estados para a mesma coisa, que é o que se está tentando evitar.
 *
 * Devolve `null` para qualquer coisa que não case: link velho ou endereço
 * digitado à mão caem na lista de tabelas, que é o lugar seguro.
 */
export function lerChaveDeTabela(chave: string | null | undefined): ChaveDeTabela | null {
  if (typeof chave !== "string") return null;
  const [origem, ...resto] = chave.split(":");
  const valor = resto.join(":").trim();
  if (!valor) return null;

  if (origem === "tipo") {
    return { origem: "tipo", customerType: valor.toLowerCase(), tprId: null };
  }
  if (origem === "negociada") {
    const id = Number(valor);
    if (!Number.isFinite(id) || id <= 0) return null;
    return { origem: "negociada", customerType: null, tprId: Math.trunc(id) };
  }
  return null;
}

/**
 * Quais tabelas negociadas vale a pena mostrar.
 *
 * ## A regra: só aparece a tabela por onde alguém compra
 *
 * Em 31/08/2026 as cinco que não serviam a ninguém foram apagadas do banco, então
 * hoje esta função não esconde nada. Ela fica como rede: se uma tabela voltar a
 * existir sem conta atribuída — importação parcial, cadastro pela metade — ela não
 * ocupa a lista das que estão em uso.
 *
 * `pessoas > 0` é o corte porque tabela de preço só existe para alguém pagar por
 * ela. Sem conta apontando, ter ou não ter produto dentro dá no mesmo.
 *
 * ## As duas exceções, que são o ponto
 *
 * - **A padrão de novas contas** fica sempre, mesmo zerada: é a que a próxima
 *   pessoa que se cadastrar vai receber, e sumir seria esconder o que mais
 *   importa amanhã.
 * - **Tabela com conta e sem preço** (as TPR 80 e 82, com três clientes e nada
 *   dentro) **não** é ruído — é o problema. Ela passa no corte por ter gente, e
 *   é justamente aí que o alerta aparece.
 *
 * Devolve também quantas ficaram de fora, para a tela poder dizer isso em vez de
 * simplesmente omitir.
 */
export function filtrarTabelasNegociadas(tabelas: readonly ResumoDeTabela[]): {
  visiveis: ResumoDeTabela[];
  ocultas: number;
} {
  const visiveis = tabelas.filter((t) => t.pessoas > 0 || t.padraoDeNovasContas);
  return { visiveis, ocultas: tabelas.length - visiveis.length };
}
