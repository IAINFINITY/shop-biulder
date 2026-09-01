// O sino do painel: quais avisos cada administrador vê.
//
// ## O que decide se um aviso aparece
//
// Três filtros, em ordem, e a ordem importa:
//
//   1. **permissão** — quem não vê Pedidos não é avisado de pedido;
//   2. **preferência** — o que a pessoa desligou nas Configurações;
//   3. **leitura** — o que ela já viu (só muda o contador, não a lista).
//
// Permissão vem antes de preferência de propósito: desligar um aviso é escolha,
// não ver a seção é regra. Se a preferência viesse primeiro, alguém sem acesso a
// Funcionários poderia *ligar* o aviso de funcionário novo e passar a receber o
// nome de gente que não pode consultar — um vazamento pela porta dos fundos.
//
// ## ⚠️ Aqui "lido" é por pessoa; na caixa de mensagens não é
//
// Parecem a mesma coisa e são opostas. Responder um cliente é um fato do mundo:
// se um atendente "marca como lido", o cliente continua sem resposta — por isso
// lá o sinal é `ultima_mensagem_de`, objetivo e compartilhado. Ver um aviso é um
// fato da cabeça de quem viu: quando eu já sei que entrou um pedido, eu já sei,
// e isso não diz nada sobre o que o meu colega sabe.

import type { AdminSection } from "@/components/admin/adminTypes";

export type TipoDeAviso =
  | "pedido_novo"
  | "mensagem_nova"
  | "cliente_novo"
  | "funcionario_novo"
  | "avaliacao_nova"
  | "banner_novo"
  | "imagem_nova"
  | "admin_novo";

export type AvisoDoPainel = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  secao: string | null;
  referencia_id: string | null;
  created_at: string;
  /** Vem do `left join` com a tabela de leituras deste administrador. */
  lida_em?: string | null;
};

type DefinicaoDeAviso = {
  rotulo: string;
  /** O que a pessoa lê nas Configurações para decidir se quer isto. */
  explicacao: string;
  /** A seção que o aviso abre — e a permissão que ele exige. */
  secao: AdminSection;
};

/**
 * O catálogo. É a única lista: a tela de Configurações, o filtro de permissão e
 * o rótulo do sino saem todos daqui.
 *
 * A ordem é a de quem lê a tela de Configurações — do que exige ação para o que
 * é só registro. Pedido e mensagem no topo porque são os dois que fazem alguém
 * largar o que está fazendo.
 */
export const AVISOS: Record<TipoDeAviso, DefinicaoDeAviso> = {
  pedido_novo: {
    rotulo: "Pedido novo",
    explicacao: "Quando um cliente finaliza um pedido no catálogo.",
    secao: "pedidos",
  },
  mensagem_nova: {
    rotulo: "Mensagem de cliente",
    explicacao: "Quando um cliente escreve no chat de atendimento.",
    secao: "mensagens",
  },
  cliente_novo: {
    rotulo: "Cliente novo",
    explicacao: "Quando alguém completa o cadastro como cliente.",
    secao: "clientes",
  },
  funcionario_novo: {
    rotulo: "Funcionário novo",
    explicacao: "Quando um cadastro entra com o tipo funcionário.",
    secao: "funcionarios",
  },
  avaliacao_nova: {
    rotulo: "Avaliação de produto",
    explicacao: "Quando um cliente avalia um produto do catálogo.",
    secao: "produtos",
  },
  banner_novo: {
    rotulo: "Banner publicado",
    explicacao: "Quando um banner novo entra no ar.",
    secao: "banners",
  },
  imagem_nova: {
    rotulo: "Imagem enviada",
    explicacao: "Quando uma imagem é enviada para a biblioteca.",
    secao: "imagens",
  },
  admin_novo: {
    rotulo: "Usuário do painel",
    explicacao: "Quando alguém ganha acesso ao painel administrativo.",
    secao: "usuarios",
  },
};

export const TIPOS_DE_AVISO = Object.keys(AVISOS) as TipoDeAviso[];

export function ehTipoConhecido(tipo: string): tipo is TipoDeAviso {
  return tipo in AVISOS;
}

/** As preferências gravadas: só existe entrada para o que a pessoa **mudou**. */
export type PreferenciasDeAviso = Partial<Record<string, boolean>>;

/**
 * Se este tipo de aviso está ligado para esta pessoa.
 *
 * ⚠️ **A ausência de preferência é "ligado".** É o que faz um tipo de aviso novo
 * nascer valendo para todo mundo sem backfill, e o que faz "nunca mexi nisso"
 * significar "quero ser avisado" — que é a expectativa de quem instala o
 * sistema e não abre as Configurações.
 */
export function avisoEstaLigado(tipo: string, preferencias: PreferenciasDeAviso): boolean {
  return preferencias[tipo] ?? true;
}

/**
 * Os avisos que esta pessoa deve ver.
 *
 * `podeVerSecao` é injetado em vez de importado para a regra continuar pura: é
 * o `canAccessAdminSection` já amarrado ao usuário, e aqui ele é só uma função
 * de seção para booleano — o que permite testar a permissão sem montar sessão.
 */
export function avisosVisiveis(
  avisos: readonly AvisoDoPainel[],
  {
    preferencias = {},
    podeVerSecao,
  }: { preferencias?: PreferenciasDeAviso; podeVerSecao: (secao: AdminSection) => boolean },
): AvisoDoPainel[] {
  return avisos.filter((aviso) => {
    // Tipo que o front não conhece (gravado por uma versão mais nova do banco)
    // não aparece: não há rótulo, não há seção, e mostrar "pedido_estranho" cru
    // é pior que não mostrar.
    if (!ehTipoConhecido(aviso.tipo)) return false;
    if (!podeVerSecao(AVISOS[aviso.tipo].secao)) return false;
    return avisoEstaLigado(aviso.tipo, preferencias);
  });
}

export function contarNaoLidos(avisos: readonly AvisoDoPainel[]): number {
  return avisos.filter((aviso) => !aviso.lida_em).length;
}

/**
 * Os tipos que esta pessoa pode configurar.
 *
 * A tela de Configurações não oferece o que a permissão não alcança: um botão
 * que liga um aviso que nunca vai chegar é uma promessa quebrada por desenho.
 */
export function tiposConfiguraveis(podeVerSecao: (secao: AdminSection) => boolean): TipoDeAviso[] {
  return TIPOS_DE_AVISO.filter((tipo) => podeVerSecao(AVISOS[tipo].secao));
}
