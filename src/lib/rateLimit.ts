/**
 * Limite de uso das rotas `/api/*` — a regra, pura e testavel.
 *
 * A §21 do padrao de autenticacao pede limite nas "APIs sensiveis ou de alto
 * custo" e manda combinar dimensoes: conta, IP, endpoint, tenant. Diz tambem, com
 * todas as letras, que **"IP isolado nao e controle principal"**.
 *
 * Aqui a dimensao principal e **conta + endpoint**, e nao IP, por uma razao que
 * vale registrar: todas as sete rotas exigem autenticacao antes de chegar neste
 * ponto, entao o identificador da conta esta sempre disponivel e e muito mais
 * forte que um IP — que muda a cada troca de rede e e compartilhado por escritorio
 * inteiro atras de NAT. Limitar por IP puniria a Clinic+ inteira pelo excesso de
 * uma pessoa.
 *
 * O IP entra como dimensao secundaria em `chaveDeRateLimit`, disponivel para quem
 * precisar, mas nenhuma rota o usa como chave principal hoje.
 */

export type PoliticaDeLimite = {
  /** Quantas chamadas cabem na janela. */
  limite: number;
  /** Tamanho da janela, em segundos. */
  janelaSegundos: number;
  /**
   * O que fazer quando o proprio contador esta fora do ar.
   *
   * `"abrir"` deixa passar e registra; `"fechar"` recusa.
   */
  naFalha: "abrir" | "fechar";
};

const HORA = 3600;

/**
 * O limite de cada rota, e o porque de cada numero.
 *
 * Nenhum destes e teto tecnico: sao **ordens de grandeza acima do uso humano
 * normal** e ordens de grandeza abaixo do que um script faria. Quem trabalha o
 * dia inteiro no painel nao encosta neles; quem automatizou o endereco encosta em
 * minutos.
 */
export const POLITICAS: Record<string, PoliticaDeLimite> = {
  /**
   * Gasta dinheiro por chamada (OpenAI). Unica rota que **fecha** na falha do
   * contador: sem limite funcionando, o custo e ilimitado, e recusar um resumo e
   * incomodo — deixar a torneira aberta e prejuizo.
   */
  "resumo-produto": { limite: 40, janelaSegundos: HORA, naFalha: "fechar" },

  /**
   * Escrevem no ERP de producao. 40 pedidos por hora por conta e muito acima do
   * que um comprador faz e muito abaixo do que um script faz.
   */
  "proxis-order": { limite: 40, janelaSegundos: HORA, naFalha: "abrir" },
  "proxis-customer": { limite: 60, janelaSegundos: HORA, naFalha: "abrir" },
  "bitrix-deal": { limite: 60, janelaSegundos: HORA, naFalha: "abrir" },

  /**
   * Exclusao de conta: cinco por hora e muito acima de qualquer uso legitimo —
   * ninguem apaga a propria conta duas vezes — e corta tentativa de adivinhar
   * senha usando esta rota como oraculo.
   */
  "excluir-conta": { limite: 5, janelaSegundos: HORA, naFalha: "fechar" },

  /** Ferramentas de leitura do painel: quem esta trabalhando consulta muito. */
  "proxis-health": { limite: 240, janelaSegundos: HORA, naFalha: "abrir" },
  "proxis-item-check": { limite: 600, janelaSegundos: HORA, naFalha: "abrir" },
  "proxis-price-tables": { limite: 240, janelaSegundos: HORA, naFalha: "abrir" },
};

/** Usado quando a rota nao tem politica propria. Existe para nao haver rota sem teto. */
export const POLITICA_PADRAO: PoliticaDeLimite = {
  limite: 120,
  janelaSegundos: HORA,
  naFalha: "abrir",
};

export function politicaDaRota(rota: string): PoliticaDeLimite {
  return POLITICAS[rota] ?? POLITICA_PADRAO;
}

/**
 * A chave do contador.
 *
 * Formato `rota:dimensao:valor`, para a mesma tabela servir dimensoes diferentes
 * sem uma colidir com a outra — `proxis-order:conta:abc` e
 * `proxis-order:ip:abc` sao contadores distintos mesmo com o mesmo valor.
 */
export function chaveDeRateLimit(
  rota: string,
  dimensao: "conta" | "ip",
  valor: string,
): string {
  return `${rota}:${dimensao}:${valor.trim().toLowerCase()}`;
}

export type Decisao = {
  permitido: boolean;
  /** Quantas chamadas ainda cabem na janela. */
  restante: number;
  /** Segundos ate a janela virar — vira o header `Retry-After`. */
  retryAfter: number;
};

/**
 * A decisao a partir da contagem ja gravada.
 *
 * Separada da escrita de proposito: a parte que decide e aritmetica pura e cabe
 * em teste; a parte que grava precisa de banco.
 *
 * `contagem` e o total **incluindo** a chamada atual, que e o que a funcao do
 * Postgres devolve depois de incrementar.
 */
export function decidir(
  contagem: number,
  politica: PoliticaDeLimite,
  segundosDesdeInicioDaJanela: number,
): Decisao {
  const restante = Math.max(politica.limite - contagem, 0);
  const decorrido = Math.max(0, Math.min(segundosDesdeInicioDaJanela, politica.janelaSegundos));
  return {
    permitido: contagem <= politica.limite,
    restante,
    // Pelo menos 1: `Retry-After: 0` convida a repetir imediatamente, que e o
    // oposto do que o header existe para provocar.
    retryAfter: Math.max(1, Math.ceil(politica.janelaSegundos - decorrido)),
  };
}

/**
 * O que fazer quando o contador nao respondeu.
 *
 * A §31 lista "fallback que libera acesso durante indisponibilidade de
 * dependencia" como antipadrao — mas aquele item trata de **acesso**, e aqui a
 * autenticacao e a autorizacao ja passaram. O que se degrada e a vazao, nao a
 * permissao.
 *
 * Ainda assim a escolha nao e a mesma para toda rota: onde a consequencia e
 * dinheiro (`resumo-produto`), fechar e o certo. Onde a consequencia e o cliente
 * nao conseguir fechar pedido, abrir e o certo — derrubar o checkout por causa de
 * um contador fora do ar seria trocar um risco pequeno por um dano grande.
 */
export function decisaoNaFalha(politica: PoliticaDeLimite): Decisao {
  return politica.naFalha === "fechar"
    ? { permitido: false, restante: 0, retryAfter: 60 }
    : { permitido: true, restante: politica.limite, retryAfter: 0 };
}
