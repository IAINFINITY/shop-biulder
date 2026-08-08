import { describe, expect, it } from "vitest";
import {
  DADOS_EXCLUIDOS,
  DADOS_RETIDOS,
  PALAVRA_DE_CONFIRMACAO,
  confirmacaoValida,
  motivoParaNaoExcluir,
} from "@/lib/exclusaoDeConta";

describe("confirmacaoValida", () => {
  it("aceita a palavra em qualquer caixa, com espaço nas pontas", () => {
    // A palavra existe para evitar clique automático, não para punir quem digitou
    // em minúsculo.
    for (const v of ["EXCLUIR", "excluir", " Excluir ", "eXcLuIr"]) {
      expect(confirmacaoValida(v), v).toBe(true);
    }
  });

  it("recusa qualquer outra coisa", () => {
    for (const v of ["", "EXCLUI", "EXCLUIRR", "DELETAR", "sim", "EXCLUIR AGORA"]) {
      expect(confirmacaoValida(v), v).toBe(false);
    }
  });
});

describe("motivoParaNaoExcluir", () => {
  it("exige a palavra e a senha, nessa ordem", () => {
    expect(motivoParaNaoExcluir("", "")).toMatch(new RegExp(PALAVRA_DE_CONFIRMACAO));
    expect(motivoParaNaoExcluir("EXCLUIR", "")).toMatch(/senha/i);
  });

  it("com os dois preenchidos, libera", () => {
    expect(motivoParaNaoExcluir("EXCLUIR", "minha senha longa")).toBeNull();
  });

  it("senha sozinha não basta — a palavra é o freio contra o clique automático", () => {
    expect(motivoParaNaoExcluir("", "minha senha longa")).not.toBeNull();
  });
});

describe("o que a tela promete", () => {
  it("as duas listas existem e nenhuma está vazia", () => {
    // Mostrar só o que sai seria a forma mais fácil de mentir sem dizer nada
    // falso. A §27 exige explicar excluído E retido.
    expect(DADOS_EXCLUIDOS.length).toBeGreaterThan(0);
    expect(DADOS_RETIDOS.length).toBeGreaterThan(0);
  });

  it("a retenção de pedido explica o motivo, não só o fato", () => {
    const pedidos = DADOS_RETIDOS.find((d) => /pedido/i.test(d.titulo));
    expect(pedidos).toBeDefined();
    expect(pedidos!.detalhe).toMatch(/fiscal|legisla|CNPJ/i);
  });

  it("nenhum item promete apagar o que a rota retém", () => {
    const titulosRetidos = DADOS_RETIDOS.map((d) => d.titulo.toLowerCase());
    for (const item of DADOS_EXCLUIDOS) {
      expect(titulosRetidos, item.titulo).not.toContain(item.titulo.toLowerCase());
    }
  });
});
