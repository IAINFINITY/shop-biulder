import { describe, expect, it } from "vitest";
import {
  buildCustomerPriceMap,
  calculateCartSubtotal,
  deveAplicarTabelaDoProxis,
  linhaDePrecoAtiva,
  mergePriceLayers,
  resolveProductPrice,
} from "./pricing";
import type { Product } from "./products";

const produto = (overrides: Partial<Product> = {}): Product =>
  ({
    id: "p1",
    name: "Chá Mais - Anis-estrelado",
    description: "",
    brand: null,
    type: "Chá",
    family: "Chá",
    image_url: null,
    image_urls: null,
    image_alts: null,
    image_fit: "cover",
    image_width: null,
    image_height: null,
    active: true,
    is_promotion: false,
    is_featured: false,
    price: 4.84,
    compare_at_price: null,
    stock: null,
    product_code: "2188",
    visible_to: null,
    created_at: "",
    updated_at: "",
    average_rating: 0,
    review_count: 0,
    ...overrides,
  }) as Product;

describe("preço do produto", () => {
  it("usa o preço de cadastro quando o cliente não tem tabela", () => {
    expect(resolveProductPrice(produto(), new Map())).toBe(4.84);
  });

  it("usa a tabela do cliente quando existe", () => {
    const mapa = buildCustomerPriceMap([{ product_code: "2188", price: 4.89 }]);
    expect(resolveProductPrice(produto(), mapa)).toBe(4.89);
  });

  it("acha a tabela mesmo com o código em caixa diferente", () => {
    const mapa = buildCustomerPriceMap([{ product_code: "cha-001", price: 3.5 }]);
    expect(resolveProductPrice(produto({ product_code: "CHA-001" }), mapa)).toBe(3.5);
  });

  /**
   * A pagina do produto aplicava 10% sobre o preco e chamava aquilo de "preco a
   * vista". O desconto nao existia em lugar nenhum: um produto de R$ 4,84
   * aparecia por R$ 4,36 na pagina e voltava a R$ 4,84 no carrinho.
   *
   * O teto contra isso e a invariante abaixo: o que uma unidade custa no
   * carrinho tem de ser exatamente o preco resolvido, sem transformacao no
   * caminho.
   */
  it("uma unidade no carrinho custa exatamente o preço resolvido", () => {
    const p = produto();
    const mapa = buildCustomerPriceMap([{ product_code: "2188", price: 4.89 }]);
    const cart = [{ product: p, quantity: 1 }];

    expect(calculateCartSubtotal(cart, mapa)).toBe(resolveProductPrice(p, mapa));
    expect(calculateCartSubtotal(cart, new Map())).toBe(resolveProductPrice(p, new Map()));
  });

  /**
   * A tabela 8728 chegou do Proxis com 143 dos 156 itens em zero. Zero numa
   * tabela de preco significa "nao precificado aqui", nunca "de graca": aceito
   * como preco, o produto ia para a vitrine e para o pedido por R$ 0,00.
   */
  it("preço zero na tabela não vale como preço", () => {
    const mapa = buildCustomerPriceMap([{ product_code: "2188", price: 0 }]);
    expect(mapa.has("2188")).toBe(false);
    expect(resolveProductPrice(produto(), mapa)).toBe(4.84);
  });

  it("preço negativo também é descartado", () => {
    const mapa = buildCustomerPriceMap([{ product_code: "2188", price: -1 }]);
    expect(resolveProductPrice(produto(), mapa)).toBe(4.84);
  });

  it("o total é múltiplo exato do preço unitário", () => {
    const p = produto();
    const mapa = new Map<string, number>();
    for (const quantidade of [1, 3, 7]) {
      const esperado = Math.round(resolveProductPrice(p, mapa) * quantidade * 100) / 100;
      expect(calculateCartSubtotal([{ product: p, quantity: quantidade }], mapa)).toBe(esperado);
    }
  });
});

describe("camadas de preço", () => {
  const geral = buildCustomerPriceMap([
    { product_code: "2188", price: 4.85 },
    { product_code: "5037", price: 60.0 },
  ]);

  it("a tabela do cliente vence a geral", () => {
    const doCliente = buildCustomerPriceMap([{ product_code: "2188", price: 3.55 }]);
    expect(mergePriceLayers(geral, doCliente).get("2188")).toBe(3.55);
  });

  /**
   * As tabelas do Proxis sao parciais: a 8728 lista 138 dos 143 produtos do
   * catalogo. O que ela nao lista tem de cair no preco cheio da tabela geral,
   * nao no preco de cadastro.
   */
  it("o que a tabela do cliente não lista cai na geral", () => {
    const doCliente = buildCustomerPriceMap([{ product_code: "2188", price: 3.55 }]);
    expect(mergePriceLayers(geral, doCliente).get("5037")).toBe(60.0);
  });

  it("sem tabela do cliente, vale a geral inteira", () => {
    expect(mergePriceLayers(geral, new Map())).toEqual(geral);
  });

  it("zero na tabela do cliente não derruba o preço da geral", () => {
    // Zero nao entra no mapa, entao a camada de baixo continua valendo.
    const doCliente = buildCustomerPriceMap([{ product_code: "2188", price: 0 }]);
    expect(mergePriceLayers(geral, doCliente).get("2188")).toBe(4.85);
  });
});

describe("deveAplicarTabelaDoProxis", () => {
  it("cliente com tabela negociada usa a do Proxis", () => {
    expect(deveAplicarTabelaDoProxis("cliente", 8728)).toBe(true);
  });

  it("sem TPR, só a geral", () => {
    expect(deveAplicarTabelaDoProxis("cliente", null)).toBe(false);
  });

  it("funcionário ignora o TPR, mesmo que o perfil tenha um", () => {
    /**
     * O caso que motivou a função. Os 96 perfis de funcionário estavam com
     * `proxis_tpr_id = 8728` — escrito pela sincronização com o Proxis, porque
     * eles compram sob o CNPJ da Clinic+, que tem essa tabela no ERP.
     *
     * A migration de 25/08/2026 zerou a coluna e a RPC parou de regravar. Esta
     * linha é a terceira trava: a camada do TPR fica **acima** da geral em
     * `mergePriceLayers`, então um único 8728 que escape apaga a tabela Clinic
     * 2026 Funcionários item a item, sem erro — só com o preço errado na tela.
     */
    expect(deveAplicarTabelaDoProxis("funcionario", 8728)).toBe(false);
    expect(deveAplicarTabelaDoProxis("  FUNCIONARIO  ", 8745)).toBe(false);
  });

  it("lojista e distribuidor seguem a regra normal", () => {
    expect(deveAplicarTabelaDoProxis("lojista", 8744)).toBe(true);
    expect(deveAplicarTabelaDoProxis("distribuidor", null)).toBe(false);
  });
});

describe("linhaDePrecoAtiva", () => {
  /**
   * O bug que esta função existe para matar.
   *
   * A tela de preços lia `draftActive[code]` cru. O rascunho começa vazio e
   * nunca era preenchido com o que veio do banco, então `undefined` era falso e
   * **toda** linha com preço aparecia como "Preço desligado" — enquanto o
   * contador no topo, que lê direto do banco, dizia "160 ativos". As 730 linhas
   * estavam ativas.
   */
  it("linha que o admin não tocou segue o que está no banco", () => {
    expect(linhaDePrecoAtiva(undefined, true)).toBe(true);
    expect(linhaDePrecoAtiva(undefined, false)).toBe(false);
  });

  it("o que o admin acabou de mexer vence o banco", () => {
    expect(linhaDePrecoAtiva(false, true)).toBe(false);
    expect(linhaDePrecoAtiva(true, false)).toBe(true);
  });

  it("linha que ainda não existe nasce ativa", () => {
    // Preço novo, sem linha gravada: gravar desligado seria criar uma linha que
    // não faz nada.
    expect(linhaDePrecoAtiva(undefined, undefined)).toBe(true);
    expect(linhaDePrecoAtiva(undefined, null)).toBe(true);
  });

  it("`false` gravado não é confundido com ausência", () => {
    /**
     * O detalhe que `??` sozinho acertava e `||` erraria: `false` é um valor
     * legítimo, não "não sei". Um `gravado || true` devolveria `true` para linha
     * desligada de propósito e a religaria no próximo salvamento.
     */
    expect(linhaDePrecoAtiva(undefined, false)).toBe(false);
    expect(linhaDePrecoAtiva(false, undefined)).toBe(false);
  });

  it("o botão inverte o estado visível, e não um padrão fixo", () => {
    /**
     * A parte perigosa do bug. O botão calculava `!(rascunho ?? true)`: com o
     * rascunho vazio isso dava `false`, então o botão **escrito "Ativar"**
     * gravava `active = false`. Quem tentasse consertar o que via na tela
     * desligava o preço de verdade, e o produto passava a vender pelo preço de
     * cadastro.
     *
     * Invertendo o estado real, clicar em algo ativo desliga e clicar em algo
     * desligado liga — que é o que o rótulo promete.
     */
    const ativoNoBanco = linhaDePrecoAtiva(undefined, true);
    expect(!ativoNoBanco).toBe(false);

    const desligadoNoBanco = linhaDePrecoAtiva(undefined, false);
    expect(!desligadoNoBanco).toBe(true);
  });
});
