import { describe, expect, it } from "vitest";
import type { AdminSection } from "@/components/admin/adminTypes";
import {
  AVISOS,
  avisoEstaLigado,
  avisosVisiveis,
  contarNaoLidos,
  ehTipoConhecido,
  tiposConfiguraveis,
  TIPOS_DE_AVISO,
  type AvisoDoPainel,
} from "./avisosDoPainel";

function aviso(partes: Partial<AvisoDoPainel> = {}): AvisoDoPainel {
  return {
    id: "1",
    tipo: "pedido_novo",
    titulo: "Novo pedido de Clinica Sol",
    descricao: "8 itens",
    secao: "pedidos",
    referencia_id: null,
    created_at: "2026-08-31T12:00:00Z",
    lida_em: null,
    ...partes,
  };
}

const tudoLiberado = () => true;

describe("catalogo de avisos", () => {
  it("todo tipo tem rotulo, explicacao e secao", () => {
    for (const tipo of TIPOS_DE_AVISO) {
      expect(AVISOS[tipo].rotulo.length).toBeGreaterThan(0);
      expect(AVISOS[tipo].explicacao.length).toBeGreaterThan(0);
      expect(AVISOS[tipo].secao.length).toBeGreaterThan(0);
    }
  });

  it("reconhece o que conhece e recusa o resto", () => {
    expect(ehTipoConhecido("pedido_novo")).toBe(true);
    expect(ehTipoConhecido("coisa_inventada")).toBe(false);
  });
});

describe("avisoEstaLigado", () => {
  // Sem esta regra, um tipo de aviso novo nasceria desligado para todo mundo e
  // ninguem entenderia por que o sino nunca toca para ele.
  it("nunca mexi nisso quer dizer que eu quero ser avisado", () => {
    expect(avisoEstaLigado("pedido_novo", {})).toBe(true);
  });

  it("desligado e desligado", () => {
    expect(avisoEstaLigado("pedido_novo", { pedido_novo: false })).toBe(false);
  });

  it("religar volta a valer", () => {
    expect(avisoEstaLigado("pedido_novo", { pedido_novo: true })).toBe(true);
  });
});

describe("avisosVisiveis", () => {
  it("mostra tudo para quem pode tudo e nao desligou nada", () => {
    const caixa = [aviso({ id: "a" }), aviso({ id: "b", tipo: "mensagem_nova", secao: "mensagens" })];
    expect(avisosVisiveis(caixa, { podeVerSecao: tudoLiberado }).map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("o que a pessoa desligou some", () => {
    const caixa = [aviso({ id: "a" }), aviso({ id: "b", tipo: "banner_novo", secao: "banners" })];
    const visiveis = avisosVisiveis(caixa, { preferencias: { banner_novo: false }, podeVerSecao: tudoLiberado });
    expect(visiveis.map((a) => a.id)).toEqual(["a"]);
  });

  // ⚠️ A permissao ganha da preferencia. Se fosse ao contrario, quem nao pode
  // ver Funcionarios poderia LIGAR o aviso de funcionario novo e passar a
  // receber o nome de gente que nao tem acesso para consultar.
  it("permissao ganha da preferencia, mesmo com o aviso ligado", () => {
    const caixa = [aviso({ id: "f", tipo: "funcionario_novo", secao: "funcionarios" })];
    const semFuncionarios = (secao: AdminSection) => secao !== "funcionarios";
    const visiveis = avisosVisiveis(caixa, {
      preferencias: { funcionario_novo: true },
      podeVerSecao: semFuncionarios,
    });
    expect(visiveis).toEqual([]);
  });

  // Um banco mais novo que o front pode gravar um tipo que este codigo nao
  // conhece. Mostrar "pedido_estranho" cru e pior que nao mostrar nada.
  it("tipo desconhecido nao aparece", () => {
    expect(avisosVisiveis([aviso({ tipo: "coisa_do_futuro" })], { podeVerSecao: tudoLiberado })).toEqual([]);
  });
});

describe("contarNaoLidos", () => {
  it("conta so o que ninguem leu ainda", () => {
    const caixa = [
      aviso({ id: "a", lida_em: null }),
      aviso({ id: "b", lida_em: "2026-08-31T13:00:00Z" }),
      aviso({ id: "c", lida_em: null }),
    ];
    expect(contarNaoLidos(caixa)).toBe(2);
  });

  it("tudo lido nao acende o sino", () => {
    expect(contarNaoLidos([aviso({ lida_em: "2026-08-31T13:00:00Z" })])).toBe(0);
  });
});

describe("tiposConfiguraveis", () => {
  it("com acesso total, oferece o catalogo inteiro", () => {
    expect(tiposConfiguraveis(tudoLiberado)).toEqual(TIPOS_DE_AVISO);
  });

  // Um botao que liga um aviso que nunca vai chegar e uma promessa quebrada por
  // desenho: a pessoa liga, espera, e nada acontece.
  it("nao oferece o que a permissao nao alcanca", () => {
    const soPedidos = (secao: AdminSection) => secao === "pedidos";
    expect(tiposConfiguraveis(soPedidos)).toEqual(["pedido_novo"]);
  });
});
