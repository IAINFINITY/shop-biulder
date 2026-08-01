/**
 * As areas de banner do site, com a medida exata de cada uma.
 *
 * Fonte unica: a vitrine desenha o quadro a partir daqui, e o admin mostra o
 * tamanho a partir daqui. Antes a medida vivia so dentro de `PromoBanners.tsx`,
 * entao quem cadastra banner no admin nao tinha como saber o que cabia em cada
 * espaco — e `docs/ESPECIFICACAO-BANNERS.md` era o unico lugar com os numeros,
 * fora do alcance de quem usa o sistema.
 *
 * Mudou a proporcao de uma area? Muda aqui, e vitrine e admin acompanham.
 */

export type BannerPagina = "Catálogo" | "Produto" | "Ajuda";

/** Uma aparicao da area numa pagina. */
export type BannerAparicao = {
  pagina: BannerPagina;
  /** Onde ela cai naquela pagina, em portugues corrido. */
  onde: string;
  /** Quantas pecas o bloco mostra lado a lado ali. */
  pecas: number;
};

export type BannerSlot = {
  id: string;
  /** Nome curto da area, como aparece no admin. */
  nome: string;
  /**
   * Onde a area aparece — uma entrada por pagina.
   *
   * Lista, e nao um texto so: o **Par** cai nas duas paginas, com duas pecas em
   * cada. Enquanto isso era uma frase unica comecando com "Catálogo", qualquer
   * contagem por prefixo perdia a ocorrencia em Produto, e a pagina de produto
   * aparecia com 1 peca quando na verdade tem 3.
   */
  aparicoes: BannerAparicao[];
  proporcao: string;
  /** Classe de proporcao do quadro. */
  aspect: string;
  /** Tamanho do arquivo a entregar. */
  entrega: { largura: number; altura: number };
  /** Maior largura em que a peca aparece na tela. */
  exibeAte: number;
  /** Vai de borda a borda da tela. */
  sangra: boolean;
  /**
   * Medida da arte de celular, quando a area aceita uma.
   *
   * Era uma entrada propria na lista ("Topo — celular"), com `cadastravel:
   * false` para marcar que ninguem a cria nem remove sozinha. Isso obrigava
   * toda tela a tratar uma excecao. Como atributo, ela simplesmente acompanha a
   * area a que pertence.
   */
  arteDeCelular: {
    largura: number;
    altura: number;
    proporcao: string;
    /** Proporcao do quadro ate `sm`. A partir dai vale o `aspect` de cima. */
    aspect: string;
  };
  /**
   * Aceita varias artes girando em carrossel.
   *
   * So o topo. Nas outras areas o quadro e unico, entao "ordem" nao significa
   * nada — a vitrine usa a primeira arte ativa e ignora o resto.
   */
  carrossel: boolean;
};

/**
 * A entrega e cerca do dobro da maior largura exibida.
 *
 * Arte no tamanho exato sai borrada em tela retina — e o mesmo criterio da foto
 * de produto, que exibe ~456px e e entregue com 1280px. Peca que sangra cresce
 * junto com a tela, entao a folga nela e maior.
 */
export const BANNER_SLOTS: BannerSlot[] = [
  {
    id: "topo",
    nome: "Topo",
    aparicoes: [
      { pagina: "Catálogo", onde: "topo do site, acima de tudo", pecas: 1 },
    ],
    proporcao: "16:5",
    aspect: "aspect-[16/5]",
    // 3840, e nao os 1920 de antes: o topo vai de borda a borda, entao numa tela
    // de 2560 a arte de 1920 era ampliada em 33%. As outras pecas que sangram
    // (destaque e faixa) ja pediam 3840; o topo era a excecao que ninguem tinha
    // conferido. A arte que esta no ar hoje tem 1920 e precisa ser reentregue.
    entrega: { largura: 3840, altura: 1200 },
    exibeAte: 2560,
    sangra: true,
    carrossel: true,
    arteDeCelular: { largura: 800, altura: 320, proporcao: "5:2", aspect: "aspect-[5/2]" },
  },
  {
    id: "trio",
    nome: "Trio",
    aparicoes: [
      { pagina: "Catálogo", onde: "antes das seções temáticas", pecas: 3 },
    ],
    proporcao: "16:9",
    aspect: "aspect-[16/9]",
    // 1280 x 720, e nao os 2030 x 1142 de antes.
    //
    // O 2030 nao somava as tres pecas nem seguia a regra do dobro: era resto de
    // um rascunho em que a peca tinha 507px (507 x 4 = 2028). Cada quadro do
    // trio exibe 611px, entao o dobro sao ~1222 — 1280 x 720 e o 16:9 exato mais
    // proximo. O arquivo fica 2,5x mais leve sem perder um pixel de nitidez.
    entrega: { largura: 1280, altura: 720 },
    exibeAte: 611,
    sangra: false,
    carrossel: false,
    arteDeCelular: { largura: 800, altura: 450, proporcao: "16:9", aspect: "aspect-[16/9]" },
  },
  {
    id: "par",
    nome: "Par",
    aparicoes: [
      { pagina: "Catálogo", onde: "antes de \"Vistos recentemente\"", pecas: 2 },
      { pagina: "Produto", onde: "antes dos produtos relacionados", pecas: 2 },
    ],
    proporcao: "5:2",
    aspect: "aspect-[5/2]",
    entrega: { largura: 1600, altura: 640 },
    exibeAte: 800,
    sangra: false,
    carrossel: false,
    arteDeCelular: { largura: 800, altura: 320, proporcao: "5:2", aspect: "aspect-[5/2]" },
  },
  {
    id: "destaque",
    nome: "Destaque final",
    aparicoes: [
      { pagina: "Catálogo", onde: "fim da página, encostado no rodapé", pecas: 1 },
    ],
    proporcao: "21:9",
    aspect: "aspect-[21/9]",
    entrega: { largura: 3840, altura: 1646 },
    exibeAte: 2560,
    sangra: true,
    carrossel: false,
    arteDeCelular: { largura: 800, altura: 320, proporcao: "5:2", aspect: "aspect-[5/2]" },
  },
  {
    id: "faixa",
    nome: "Faixa",
    aparicoes: [
      { pagina: "Produto", onde: "depois da descrição", pecas: 1 },
    ],
    proporcao: "5:1",
    aspect: "aspect-[5/1]",
    entrega: { largura: 3840, altura: 768 },
    exibeAte: 2560,
    sangra: true,
    carrossel: false,
    arteDeCelular: { largura: 800, altura: 320, proporcao: "5:2", aspect: "aspect-[5/2]" },
  },
  {
    id: "ajuda",
    nome: "Central de ajuda",
    aparicoes: [{ pagina: "Ajuda", onde: "topo da página, acima da busca", pecas: 1 }],
    // Mesmo formato do Topo, de proposito: a Central de ajuda reusa o proprio
    // componente do banner do topo, so que parado. Arte feita para um serve ao
    // outro, e a peca de celular tambem vale para os dois.
    proporcao: "16:5",
    aspect: "aspect-[16/5]",
    entrega: { largura: 3840, altura: 1200 },
    exibeAte: 2560,
    sangra: true,
    carrossel: false,
    arteDeCelular: { largura: 800, altura: 320, proporcao: "5:2", aspect: "aspect-[5/2]" },
  },
];

/**
 * Pecas que a pessoa ve percorrendo uma pagina inteira.
 *
 * Soma as aparicoes daquela pagina, e nao os slots — e o que faz o Par contar
 * nas duas.
 */
export function totalPecas(pagina: BannerPagina): number {
  return BANNER_SLOTS.reduce(
    (soma, slot) =>
      soma + slot.aparicoes.filter((a) => a.pagina === pagina).reduce((n, a) => n + a.pecas, 0),
    0,
  );
}

/** Areas que aparecem numa pagina. */
export function slotsDaPagina(pagina: BannerPagina): BannerSlot[] {
  return BANNER_SLOTS.filter((slot) => slot.aparicoes.some((a) => a.pagina === pagina));
}

/** Resumo legivel das aparicoes: "Catálogo — antes da grade · Produto — ...". */
export function descreveAparicoes(slot: BannerSlot): string {
  return slot.aparicoes.map((a) => `${a.pagina} — ${a.onde}`).join(" · ");
}

/** Maior numero de pecas que a area mostra de uma vez. */
export function pecasDoSlot(slot: BannerSlot): number {
  return Math.max(...slot.aparicoes.map((a) => a.pecas));
}

export function findBannerSlot(id: string): BannerSlot | undefined {
  return BANNER_SLOTS.find((slot) => slot.id === id);
}

export function formatEntrega(slot: BannerSlot): string {
  return `${slot.entrega.largura} × ${slot.entrega.altura} px`;
}
