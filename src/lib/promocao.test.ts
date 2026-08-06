import { describe, expect, it } from "vitest";
import {
  aplicarPromocao,
  estaEmPromocao,
  motivoParaNaoDestacar,
  podeDestacarEmPromocao,
  precoFinalComPromocao,
  promocaoAtiva,
  PROMO_PERCENT_MAX,
  type ProdutoComPromocao,
} from "@/lib/promocao";

const promo = (p: Partial<ProdutoComPromocao>): ProdutoComPromocao => ({
  promo_percent: null,
  promo_starts_at: null,
  promo_ends_at: null,
  ...p,
});

const EM = new Date("2026-08-06T12:00:00Z");

describe("promocaoAtiva", () => {
  it("exige percentual: marcada sem desconto nao vale", () => {
    // Era o estado real dos 4 produtos "em promocao" sem desconto nenhum.
    expect(promocaoAtiva(promo({}), EM)).toBe(false);
    expect(promocaoAtiva(promo({ promo_percent: 0 }), EM)).toBe(false);
  });

  it("aceita janela aberta dos dois lados", () => {
    expect(promocaoAtiva(promo({ promo_percent: 10 }), EM)).toBe(true);
  });

  it("respeita o inicio e o fim", () => {
    const janela = promo({
      promo_percent: 10,
      promo_starts_at: "2026-08-05T00:00:00Z",
      promo_ends_at: "2026-08-07T00:00:00Z",
    });
    expect(promocaoAtiva(janela, new Date("2026-08-04T23:59:00Z"))).toBe(false);
    expect(promocaoAtiva(janela, EM)).toBe(true);
    expect(promocaoAtiva(janela, new Date("2026-08-07T00:00:00Z"))).toBe(false);
  });

  it("recusa percentual acima do teto — provavel erro de digitacao", () => {
    expect(promocaoAtiva(promo({ promo_percent: PROMO_PERCENT_MAX + 1 }), EM)).toBe(false);
  });

  it("ignora data invalida em vez de quebrar", () => {
    expect(promocaoAtiva(promo({ promo_percent: 10, promo_ends_at: "nao e data" }), EM)).toBe(true);
  });
});

describe("aplicarPromocao", () => {
  it("desconta sobre a base de quem esta olhando, e nao sobre o catalogo", () => {
    const p = promo({ promo_percent: 20 });

    // Cliente sem tabela, pagando o catalogo.
    expect(aplicarPromocao(79.99, p, EM)).toEqual({ de: 79.99, por: 63.99, percent: 20 });

    // Mesmo produto, cliente com TPR de 51,99: o "de" e o preco **dele**.
    expect(aplicarPromocao(51.99, p, EM)).toEqual({ de: 51.99, por: 41.59, percent: 20 });
  });

  it("e isso que impede o desconto falso permanente", () => {
    // No modelo antigo, "de 79,99" global contra a TPR de 51,99 exibia -35% para
    // sempre. Aqui, sem promocao ativa, nao ha desconto nenhum — o cliente da TPR
    // ve so o preco dele.
    expect(aplicarPromocao(51.99, promo({}), EM)).toBeNull();
  });

  it("devolve nulo quando a promocao nao esta valendo", () => {
    const fora = promo({ promo_percent: 20, promo_ends_at: "2026-08-01T00:00:00Z" });
    expect(aplicarPromocao(79.99, fora, EM)).toBeNull();
  });

  it("recusa base invalida", () => {
    const p = promo({ promo_percent: 20 });
    expect(aplicarPromocao(0, p, EM)).toBeNull();
    expect(aplicarPromocao(Number.NaN, p, EM)).toBeNull();
  });

  it("arredonda para centavo", () => {
    expect(aplicarPromocao(10, promo({ promo_percent: 33.33 }), EM)).toEqual({
      de: 10,
      por: 6.67,
      percent: 33,
    });
  });

  it("descarta desconto que nao muda o preco depois do arredondamento", () => {
    // 0,001% sobre R$ 1,00 nao move um centavo: mostrar riscado seria mentira.
    expect(aplicarPromocao(1, promo({ promo_percent: 0.001 }), EM)).toBeNull();
  });
});

describe("precoFinalComPromocao", () => {
  it("devolve a base quando nao ha promocao", () => {
    expect(precoFinalComPromocao(51.99, promo({}), EM)).toBe(51.99);
  });

  it("devolve o preco com desconto quando ha", () => {
    expect(precoFinalComPromocao(79.99, promo({ promo_percent: 20 }), EM)).toBe(63.99);
  });
});

describe("podeDestacarEmPromocao", () => {
  it("com desconto valido, pode", () => {
    expect(podeDestacarEmPromocao({ promo_percent: 15 })).toBe(true);
    expect(podeDestacarEmPromocao({ promo_percent: PROMO_PERCENT_MAX })).toBe(true);
  });

  it("sem desconto, nao pode — e o caso que originou a regra", () => {
    expect(podeDestacarEmPromocao({ promo_percent: null })).toBe(false);
    expect(podeDestacarEmPromocao({ promo_percent: 0 })).toBe(false);
    expect(podeDestacarEmPromocao({ promo_percent: -5 })).toBe(false);
    expect(podeDestacarEmPromocao({ promo_percent: PROMO_PERCENT_MAX + 0.01 })).toBe(false);
    expect(podeDestacarEmPromocao({ promo_percent: Number.NaN })).toBe(false);
  });

  it("promocao agendada para depois nao e barrada no cadastro", () => {
    // A janela e assunto da leitura. Barrar aqui obrigaria a marcar tudo no dia.
    expect(podeDestacarEmPromocao({ promo_percent: 10 })).toBe(true);
  });
});

describe("motivoParaNaoDestacar", () => {
  it("campo vazio pede o desconto", () => {
    expect(motivoParaNaoDestacar({ promo_percent: null })).toMatch(/Informe o desconto/);
  });

  it("valor fora da faixa explica a faixa", () => {
    expect(motivoParaNaoDestacar({ promo_percent: 0 })).toMatch(/maior que 0/);
    expect(motivoParaNaoDestacar({ promo_percent: 99 })).toContain(String(PROMO_PERCENT_MAX));
  });

  it("desconto valido nao tem motivo", () => {
    expect(motivoParaNaoDestacar({ promo_percent: 15 })).toBeNull();
  });
});

describe("estaEmPromocao", () => {
  it("segue o desconto valendo, e nao a curadoria", () => {
    expect(estaEmPromocao(promo({ promo_percent: 15 }), EM)).toBe(true);
    expect(estaEmPromocao(promo({ promo_percent: null }), EM)).toBe(false);
  });

  it("fora da janela nao esta em promocao, mesmo com percentual", () => {
    expect(
      estaEmPromocao(promo({ promo_percent: 15, promo_ends_at: "2026-08-01T00:00:00Z" }), EM),
    ).toBe(false);
    expect(
      estaEmPromocao(promo({ promo_percent: 15, promo_starts_at: "2026-09-01T00:00:00Z" }), EM),
    ).toBe(false);
  });

  it("aceita produto sem as colunas de promocao sem quebrar", () => {
    expect(estaEmPromocao({}, EM)).toBe(false);
  });
});
