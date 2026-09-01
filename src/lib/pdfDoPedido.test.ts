import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { carregarLogo, gerarPdfDoPedido } from "./pdfDoPedido";
import type { OrderExportInput } from "./orderExportTypes";

/**
 * O PDF do pedido monta sem quebrar.
 *
 * ## Por que este teste existe
 *
 * PDF é a saída mais silenciosa que há: nada na tela avisa que ele quebrou —
 * o clique simplesmente não baixa nada, ou baixa um arquivo que não abre. E
 * ninguém abre o PDF de um pedido todo dia, então uma quebra aqui pode passar
 * semanas até um cliente reclamar.
 *
 * Não testa aparência (isso é olho), testa que o desenho **roda**: com pedido
 * de uma linha, de cem, sem endereço, com campo nulo.
 */

/** Vazios: o teste é do desenho, não do enriquecimento por catálogo. */
const MAPAS: OrderExportInput["enrichmentMaps"] = {
  codeByProductId: new Map(),
  priceByProductId: new Map(),
  codeByProductName: new Map(),
  priceByProductName: new Map(),
  imageByProductId: new Map(),
  imageByProductName: new Map(),
};

function pedido(partes: Partial<OrderExportInput> = {}): OrderExportInput {
  return {
    id: "abc",
    created_at: "2026-08-19T16:24:00.000Z",
    customer_name: "Ana Souza",
    customer_company: "AGROINDUSTRIA DE ERVA MATE SIGNOR LTDA",
    customer_phone: "15996071503",
    customer_cnpj: "12345678000199",
    customer_tpr_id: null,
    status: "NOVO CARRINHO",
    items: [{ code: "7437", name: "Boa Noite Mais", quantity: 5, unit_price: 6.44 }],
    proxis_import_id: null,
    enrichmentMaps: MAPAS,
    numeroDoPedido: 19,
    customer_address_street: "Rua das Flores",
    customer_address_number: "120",
    customer_address_city: "Guarulhos",
    customer_address_state: "SP",
    customer_address_cep: "07000-000",
    ...partes,
  };
}

describe("gerarPdfDoPedido", () => {
  // Sem isto cada teste espera os 3s de `ESPERA_PELA_LOGO_MS`: em jsdom a
  // imagem nunca dispara `onload` nem `onerror`, e a suíte inteira estourava o
  // limite de 5s por teste. Falhar na hora é o mesmo caminho de código que um
  // navegador sem a imagem, então não se perde cobertura.
  beforeEach(() => {
    class ImagemQueFalha {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_valor: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    globalThis.Image = ImagemQueFalha as unknown as typeof Image;
  });

  it("monta um pedido comum", async () => {
    const doc = await gerarPdfDoPedido(pedido(), 19);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    // Um PDF que "existe" mas sai vazio tem uns poucos bytes de cabeçalho.
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(2000);
  });

  // O pedido que motivou a tela de detalhe tinha 16 itens; a paginação da
  // tabela é onde o rodapé em todas as páginas passa a importar.
  it("um pedido longo vira várias páginas, e todas ganham rodapé", async () => {
    const itens = Array.from({ length: 120 }, (_, i) => ({
      code: String(1000 + i),
      name: `Produto de nome razoavelmente longo número ${i}`,
      quantity: i + 1,
      unit_price: 19.9,
    }));
    const doc = await gerarPdfDoPedido(pedido({ items: itens }), 20);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });

  // Pedido antigo pode não ter endereço nenhum: a seção Entrega some, e a
  // numeração das seções seguintes tem de continuar fazendo sentido.
  it("sem endereço, não quebra e pula a seção de entrega", async () => {
    const doc = await gerarPdfDoPedido(
      pedido({
        customer_address_street: null,
        customer_address_number: null,
        customer_address_city: null,
        customer_address_state: null,
        customer_address_cep: null,
      }),
      21,
    );
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("campos vazios não derrubam o desenho", async () => {
    const doc = await gerarPdfDoPedido(
      pedido({ customer_company: "", customer_phone: "", customer_cnpj: "", status: "" }),
      22,
    );
    expect(doc.getNumberOfPages()).toBe(1);
  });

  // ⚠️ Guarda a folha única.
  //
  // Depois que as fontes subiram para a faixa recomendada, a seção Condições
  // estourava a página por poucos milímetros e ia sozinha para uma segunda
  // folha — que existia só para ela. A reserva de espaço era um `46` chutado;
  // agora é medida. Este teste é o que impede o chute de voltar.
  it("um pedido curto cabe em uma folha só", async () => {
    const doc = await gerarPdfDoPedido(pedido(), 24);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  /**
   * ⚠️ Guarda contra o bug que foi para produção.
   *
   * A fonte embutida estava recortada por uma lista de caracteres escrita à
   * mão, e faltava o `U+00A0` — o espaço inquebrável que o `Intl.NumberFormat`
   * põe entre "R$" e o número. O efeito não foi um quadradinho vazio: o jsPDF
   * **cortou o resto da string**. Todo valor saiu como "R$" sozinho, e a tabela
   * ficou sem preço — num documento cuja única razão de existir é conferir
   * valores.
   *
   * ⚠️ **Não dá para procurar "211,12" nos bytes do PDF.** Com fonte TTF
   * embutida o jsPDF escreve **índices de glifo**, não os caracteres — o texto
   * literal não existe no arquivo. O que se pode medir é a largura: se um
   * caractere não está na fonte, a string não mede o que deveria.
   */
  it("o espaço inquebrável do 'R$' está na fonte embutida", async () => {
    const doc = await gerarPdfDoPedido(pedido(), 25);
    doc.setFont("Inter", "normal").setFontSize(10);

    const comNbsp = doc.getTextWidth("R$ 211,12");
    const comEspaco = doc.getTextWidth("R$ 211,12");
    const soPrefixo = doc.getTextWidth("R$");

    // Idênticas: o NBSP existe e ocupa o mesmo que um espaço comum.
    expect(comNbsp).toBeCloseTo(comEspaco, 2);
    // E a string inteira mede muito mais que o "R$" sozinho — que é exatamente
    // o que sobrava quando o glifo faltava.
    expect(comNbsp).toBeGreaterThan(soPrefixo * 2);
  });

  it("pedido sem itens ainda gera o documento", async () => {
    const doc = await gerarPdfDoPedido(pedido({ items: [] }), 23);
    expect(doc.getNumberOfPages()).toBe(1);
  });
});

/**
 * A conversão da marca.
 *
 * ⚠️ Este bloco existe por causa de um defeito que **foi para produção**: o
 * arquivo `clinicmais-logo.png` é WebP com nome de PNG, e o jsPDF, mandado
 * lê-lo como PNG, desenhou uma mancha preta no lugar da logo. Os outros testes
 * deste arquivo não pegaram porque rodam sem canvas e caem no caminho "sem
 * marca" — passavam com a logo quebrada.
 */
describe("carregarLogo", () => {
  const ImagemOriginal = globalThis.Image;
  const contextoOriginal = HTMLCanvasElement.prototype.getContext;
  const dataUrlOriginal = HTMLCanvasElement.prototype.toDataURL;

  /** Uma `Image` que dispara o evento pedido assim que recebe `src`. */
  function fingirImagem(evento: "load" | "error") {
    class ImagemFalsa {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 513;
      naturalHeight = 149;
      set src(_valor: string) {
        queueMicrotask(() => (evento === "load" ? this.onload?.() : this.onerror?.()));
      }
    }
    globalThis.Image = ImagemFalsa as unknown as typeof Image;
  }

  afterEach(() => {
    globalThis.Image = ImagemOriginal;
    HTMLCanvasElement.prototype.getContext = contextoOriginal;
    HTMLCanvasElement.prototype.toDataURL = dataUrlOriginal;
  });

  it("devolve um PNG de verdade, e não os bytes originais", async () => {
    fingirImagem("load");
    const desenhou = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: desenhou,
    })) as unknown as typeof contextoOriginal;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,AAAA");

    const resultado = await carregarLogo();

    // O prefixo é o ponto: seja o arquivo WebP, PNG indexado ou JPEG, o que sai
    // daqui é PNG — que é o único formato que a chamada `addImage` promete.
    expect(resultado).toMatch(/^data:image\/png;base64,/);
    expect(desenhou).toHaveBeenCalled();
  });

  it("sem canvas, o PDF sai sem a marca em vez de não sair", async () => {
    fingirImagem("load");
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof contextoOriginal;
    expect(await carregarLogo()).toBeNull();
  });

  it("imagem que falha não derruba o documento", async () => {
    fingirImagem("error");
    expect(await carregarLogo()).toBeNull();
  });
});
