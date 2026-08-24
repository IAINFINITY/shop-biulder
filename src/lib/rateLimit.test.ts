import { describe, expect, it } from "vitest";
import {
  chaveDeRateLimit,
  decidir,
  decisaoNaFalha,
  politicaDaRota,
  POLITICAS,
  POLITICA_PADRAO,
} from "@/lib/rateLimit";

describe("politicaDaRota", () => {
  it("toda rota /api tem política própria", () => {
    // Se uma rota nova entrar sem política, ela cai no padrão — o que é seguro,
    // mas quem adicionou precisa ter pensado no número. Este teste é o lembrete.
    for (const rota of [
      "resumo-produto",
      "proxis-order",
      "proxis-customer",
      "bitrix-deal",
      "proxis-health",
      "proxis-item-check",
      "proxis-price-tables",
      "excluir-conta",
      "cadastros-pendentes",
    ]) {
      expect(POLITICAS[rota], rota).toBeDefined();
    }
  });

  it("rota desconhecida nunca fica sem teto", () => {
    expect(politicaDaRota("rota-que-nao-existe")).toBe(POLITICA_PADRAO);
    expect(POLITICA_PADRAO.limite).toBeGreaterThan(0);
  });

  it("fecha só onde deixar passar é pior que barrar", () => {
    // A assimetria é o ponto. Fechar o checkout por causa de um contador fora do
    // ar troca um risco pequeno por um dano grande — então ele abre. Já deixar a
    // torneira da OpenAI aberta é prejuízo direto, e deixar a exclusão de conta
    // sem limite entrega um oráculo de senha numa ação irreversível.
    //
    // `dispositivo-confiavel` entrou pelo mesmo raciocínio: quem chama apresenta
    // um token que dispensa o segundo fator, e recusar só custa digitar os seis
    // dígitos. Esta lista é deliberada — acrescentar uma rota aqui deveria doer
    // um pouco, porque fechar tira o site do ar quando o contador falha.
    const fecham = Object.entries(POLITICAS)
      .filter(([, p]) => p.naFalha === "fechar")
      .map(([rota]) => rota)
      .sort();
    // `cadastros-pendentes` fecha porque cada chamada dispara e-mail para
    // terceiro: sem contador funcionando, a rota vira caminho para encher a
    // caixa de alguem usando o nosso remetente.
    // `reset-senha` fecha porque a rota troca a credencial de outra pessoa: sem
    // contador funcionando nao haveria teto nenhum para isso. E a unica da lista
    // cujo caminho de leitura ficou numa chave separada (`reset-senha-leitura`,
    // que abre) — juntas, o painel gastaria o teto do reset so abrindo a tela.
    expect(fecham).toEqual([
      "cadastros-pendentes",
      "dispositivo-confiavel",
      "excluir-conta",
      "reset-senha",
      "resumo-produto",
    ]);
  });

  it("a exclusão de conta tem o teto mais baixo de todas", () => {
    // Ninguém apaga a própria conta duas vezes. Teto baixo aqui corta o uso da
    // rota como oráculo para adivinhar senha.
    const menor = Math.min(...Object.values(POLITICAS).map((p) => p.limite));
    expect(POLITICAS["excluir-conta"].limite).toBe(menor);
  });
});

describe("chaveDeRateLimit", () => {
  it("dimensões diferentes não colidem com o mesmo valor", () => {
    expect(chaveDeRateLimit("proxis-order", "conta", "abc")).not.toBe(
      chaveDeRateLimit("proxis-order", "ip", "abc"),
    );
  });

  it("rotas diferentes não compartilham cota", () => {
    expect(chaveDeRateLimit("proxis-order", "conta", "u1")).not.toBe(
      chaveDeRateLimit("resumo-produto", "conta", "u1"),
    );
  });

  it("normaliza para a mesma conta não virar duas chaves", () => {
    expect(chaveDeRateLimit("x", "conta", "  ABC  ")).toBe(chaveDeRateLimit("x", "conta", "abc"));
  });
});

describe("decidir", () => {
  const politica = { limite: 10, janelaSegundos: 3600, naFalha: "abrir" as const };

  it("permite até o limite e barra depois", () => {
    expect(decidir(1, politica, 0).permitido).toBe(true);
    expect(decidir(10, politica, 0).permitido).toBe(true);
    expect(decidir(11, politica, 0).permitido).toBe(false);
  });

  it("conta o que ainda cabe", () => {
    expect(decidir(1, politica, 0).restante).toBe(9);
    expect(decidir(10, politica, 0).restante).toBe(0);
    // Nunca negativo: o header viraria "-5", que não quer dizer nada.
    expect(decidir(30, politica, 0).restante).toBe(0);
  });

  it("Retry-After encolhe conforme a janela corre", () => {
    expect(decidir(11, politica, 0).retryAfter).toBe(3600);
    expect(decidir(11, politica, 3000).retryAfter).toBe(600);
  });

  it("Retry-After nunca é zero", () => {
    // `Retry-After: 0` convida a repetir na hora — o oposto do que o header serve.
    expect(decidir(11, politica, 3600).retryAfter).toBe(1);
    expect(decidir(11, politica, 99999).retryAfter).toBe(1);
  });

  it("relógio adiantado não vira Retry-After gigante", () => {
    expect(decidir(11, politica, -500).retryAfter).toBe(3600);
  });
});

describe("decisaoNaFalha", () => {
  it("abrir deixa passar; fechar recusa", () => {
    expect(decisaoNaFalha({ limite: 5, janelaSegundos: 60, naFalha: "abrir" }).permitido).toBe(true);
    expect(decisaoNaFalha({ limite: 5, janelaSegundos: 60, naFalha: "fechar" }).permitido).toBe(
      false,
    );
  });

  it("ao fechar, manda esperar antes de repetir", () => {
    expect(decisaoNaFalha({ limite: 5, janelaSegundos: 60, naFalha: "fechar" }).retryAfter).toBe(60);
  });
});
