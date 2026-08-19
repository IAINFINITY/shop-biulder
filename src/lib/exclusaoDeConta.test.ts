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

  /**
   * A conversa de suporte tem `on delete cascade` para `auth.users` nas duas
   * tabelas (`support_conversations.customer_user_id` e
   * `support_messages.sender_user_id`). Apagar a conta a leva junto.
   *
   * A tela dizia o contrário — que ela ficava vinculada ao CNPJ da empresa — e
   * uma conta de teste em produção confirmou a cascata em 19/08/2026. Este teste
   * existe para que a promessa não volte a divergir do banco: se alguém mover a
   * conversa para a lista de retidos, tem de mexer no FK antes.
   */
  it("a conversa de suporte é anunciada como apagada, porque o FK a apaga", () => {
    const excluidos = DADOS_EXCLUIDOS.map((d) => `${d.titulo} ${d.detalhe}`.toLowerCase());
    const retidos = DADOS_RETIDOS.map((d) => `${d.titulo} ${d.detalhe}`.toLowerCase());

    expect(excluidos.some((t) => t.includes("suporte"))).toBe(true);
    expect(retidos.some((t) => t.includes("suporte"))).toBe(false);
  });

  it("não promete retenção vinculada ao CNPJ para a conversa", () => {
    // O erro anterior foi exatamente este: justificar a retenção da conversa
    // pelo vínculo com o CNPJ, que só existe para o pedido.
    const conversa = DADOS_EXCLUIDOS.find((d) => d.titulo.toLowerCase().includes("suporte"));
    expect(conversa).toBeDefined();
    expect(conversa!.detalhe.toLowerCase()).not.toContain("cnpj");
  });
});
