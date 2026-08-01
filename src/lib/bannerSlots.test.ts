import { describe, expect, it } from "vitest";
import {
  BANNER_SLOTS,
  findBannerSlot,
  formatEntrega,
  pecasDoSlot,
  slotsDaPagina,
  totalPecas,
} from "./bannerSlots";

/**
 * A contagem por pagina ja errou uma vez.
 *
 * `onde` era uma frase unica, e o Par — que aparece nas duas paginas — comecava
 * com "Catálogo". Somar por prefixo dava 1 peca na pagina de produto quando ela
 * tem 3. Estes testes fixam os numeros que a pagina realmente mostra.
 */
describe("áreas de banner", () => {
  it("conta 7 peças no catálogo: topo 1 + trio 3 + par 2 + destaque 1", () => {
    expect(totalPecas("Catálogo")).toBe(7);
  });

  it("conta 3 peças na página de produto: faixa 1 + par 2", () => {
    expect(totalPecas("Produto")).toBe(3);
  });

  it("conta o Par nas duas páginas, e não só na primeira", () => {
    const par = findBannerSlot("par");
    expect(par?.aparicoes.map((a) => a.pagina)).toEqual(["Catálogo", "Produto"]);
    expect(slotsDaPagina("Catálogo")).toContain(par);
    expect(slotsDaPagina("Produto")).toContain(par);
  });

  it("a arte de celular não é uma área — é um atributo do banner", () => {
    // Nao se cria nem se remove sozinha, entao nao aparece na lista de areas.
    expect(findBannerSlot("topo-celular")).toBeUndefined();
    expect(findBannerSlot("topo")?.arteDeCelular?.largura).toBe(800);
  });

  it("o trio tem 3 quadros, para 3 artes diferentes", () => {
    expect(pecasDoSlot(findBannerSlot("trio"))).toBe(3);
    expect(pecasDoSlot(findBannerSlot("par"))).toBe(2);
    expect(pecasDoSlot(findBannerSlot("destaque"))).toBe(1);
  });

  it("só o topo gira em carrossel", () => {
    const comCarrossel = BANNER_SLOTS.filter((slot) => slot.carrossel).map((slot) => slot.id);
    expect(comCarrossel).toEqual(["topo"]);
  });

  it("nenhuma área é entregue menor do que aparece na tela", () => {
    for (const slot of BANNER_SLOTS) {
      expect(slot.entrega.largura).toBeGreaterThanOrEqual(slot.exibeAte);
    }
  });

  /**
   * O trio pedia 2030px para um quadro de 611px — 3,3x.
   *
   * Nao somava as tres pecas nem seguia regra nenhuma: era resto de um rascunho
   * em que a peca tinha 507px. Ficou 2,5x mais pesado do que precisava, sem um
   * pixel a mais de nitidez. Este teste impede que volte a acontecer.
   */
  it("nenhuma área pede arquivo desproporcional ao que exibe", () => {
    for (const slot of BANNER_SLOTS) {
      const fator = slot.entrega.largura / slot.exibeAte;
      expect(fator, `${slot.id} pede ${fator.toFixed(1)}x o que exibe`).toBeLessThanOrEqual(2.3);
    }
  });

  it("a Central de ajuda tem uma peça, e ela conta na própria página", () => {
    expect(totalPecas("Ajuda")).toBe(1);
    expect(slotsDaPagina("Ajuda").map((s) => s.id)).toEqual(["ajuda"]);
  });

  it("a Central de ajuda usa o mesmo formato do topo, mas sem girar", () => {
    const topo = findBannerSlot("topo");
    const ajuda = findBannerSlot("ajuda");
    // Mesma medida de proposito: a arte de um serve ao outro.
    expect(ajuda?.proporcao).toBe(topo?.proporcao);
    expect(ajuda?.entrega).toEqual(topo?.entrega);
    expect(ajuda?.carrossel).toBe(false);
    expect(topo?.carrossel).toBe(true);
  });

  /**
   * So o topo e a ajuda aceitavam. Trio, par, destaque e faixa descartavam a
   * arte de celular mesmo quando ela existia no cadastro — e a faixa, a 5:1,
   * ficava com 78px de altura num celular de 390px.
   */
  it("toda área aceita arte de celular", () => {
    for (const slot of BANNER_SLOTS) {
      expect(slot.arteDeCelular, `${slot.id} sem arte de celular`).toBeTruthy();
      expect(slot.arteDeCelular.largura).toBe(800);
    }
  });

  it("a proporção do quadro de celular bate com a medida entregue", () => {
    for (const slot of BANNER_SLOTS) {
      const [w, h] = slot.arteDeCelular.proporcao.split(":").map(Number);
      const real = slot.arteDeCelular.largura / slot.arteDeCelular.altura;
      expect(Math.abs(real - w / h) / (w / h), slot.id).toBeLessThan(0.01);
      // O quadro precisa usar a mesma proporcao, senao a arte entra cortada.
      expect(slot.arteDeCelular.aspect).toBe(`aspect-[${w}/${h}]`);
    }
  });

  it("a medida de entrega respeita a proporção declarada", () => {
    for (const slot of BANNER_SLOTS) {
      const [w, h] = slot.proporcao.split(":").map(Number);
      const real = slot.entrega.largura / slot.entrega.altura;
      expect(Math.abs(real - w / h) / (w / h)).toBeLessThan(0.01);
    }
  });

  it("formata a entrega para leitura", () => {
    expect(formatEntrega(findBannerSlot("par"))).toBe("1600 × 640 px");
  });
});
