import { describe, expect, it } from "vitest";
import * as Icones from "lucide-react";

import {
  aparenciaDoAviso,
  CLASSES_DO_TOM,
  ehTipoDeAvisoConhecido,
} from "./avisosDoCliente";

const TIPOS = [
  "campanha",
  "pedido_recebido",
  "pedido_em_andamento",
  "pedido_aguardando_pagamento",
  "pedido_enviado",
  "pedido_concluido",
  "pedido_cancelado",
  "atendimento_aberto",
  "atendimento_encerrado",
] as const;

describe("aparenciaDoAviso", () => {
  // ⚠️ Um nome de ícone errado não quebra o build nem o teste de tipo: a tela
  // resolve por string e desenha nada. Este teste é a única coisa entre um erro
  // de digitação e um cartão sem ícone em produção.
  it("todo ícone existe de fato no lucide-react", () => {
    for (const tipo of TIPOS) {
      const { icone } = aparenciaDoAviso(tipo);
      expect(Icones, `ícone "${icone}" do tipo "${tipo}"`).toHaveProperty(icone);
    }
  });

  it("todo tipo tem tom e rótulo", () => {
    for (const tipo of TIPOS) {
      const aparencia = aparenciaDoAviso(tipo);
      expect(CLASSES_DO_TOM[aparencia.tom]).toBeDefined();
      expect(aparencia.rotulo.length).toBeGreaterThan(0);
    }
  });

  // A cor carrega significado: se tudo fosse colorido, nada seria.
  it("só o que espera ação do cliente é âmbar, e só o que deu errado é vermelho", () => {
    expect(aparenciaDoAviso("pedido_aguardando_pagamento").tom).toBe("atencao");
    expect(aparenciaDoAviso("pedido_cancelado").tom).toBe("problema");

    const neutros = ["campanha", "pedido_recebido", "atendimento_aberto"] as const;
    for (const tipo of neutros) {
      expect(aparenciaDoAviso(tipo).tom).toBe("neutro");
    }
  });

  it("cada estado do pedido tem um ícone diferente dos outros", () => {
    const doPedido = TIPOS.filter((t) => t.startsWith("pedido_"));
    const icones = doPedido.map((t) => aparenciaDoAviso(t).icone);
    expect(new Set(icones).size).toBe(doPedido.length);
  });

  // Banco mais novo que o front pode gravar um tipo que este código não conhece.
  // O aviso ainda tem de aparecer — com ícone genérico, e não sumindo da lista.
  it("tipo desconhecido cai em campanha em vez de quebrar", () => {
    expect(ehTipoDeAvisoConhecido("coisa_do_futuro")).toBe(false);
    expect(aparenciaDoAviso("coisa_do_futuro")).toEqual(aparenciaDoAviso("campanha"));
    expect(aparenciaDoAviso(null)).toEqual(aparenciaDoAviso("campanha"));
    expect(aparenciaDoAviso(undefined)).toEqual(aparenciaDoAviso("campanha"));
  });
});
