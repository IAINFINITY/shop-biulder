import { describe, expect, it } from "vitest";
import {
  ESTADOS_DO_PEDIDO,
  EXPLICACAO_PARA_O_CLIENTE,
  VALORES_GRAVADOS,
  classeDoStatus,
  normalizarStatusDoPedido,
  rotuloDoStatus,
} from "@/lib/statusDoPedido";

describe("normalizarStatusDoPedido", () => {
  it("entende o vocabulário antigo, sem migração", () => {
    /**
     * A coluna é texto livre e já teve outros vocabulários. Os 42 pedidos do
     * banco estão em `NOVO CARRINHO`, e o seletor antigo oferecia `Separando`,
     * `Processando` e `Entregue`. Todos precisam cair no lugar certo sem
     * ninguém migrar nada.
     */
    expect(normalizarStatusDoPedido("NOVO CARRINHO")).toBe("novo");
    expect(normalizarStatusDoPedido("Separando")).toBe("em_andamento");
    expect(normalizarStatusDoPedido("Processando")).toBe("em_andamento");
    expect(normalizarStatusDoPedido("Entregue")).toBe("concluido");
    expect(normalizarStatusDoPedido("Cancelado")).toBe("cancelado");
  });

  it("entende o vocabulário novo", () => {
    for (const estado of ESTADOS_DO_PEDIDO) {
      expect(normalizarStatusDoPedido(VALORES_GRAVADOS[estado]), estado).toBe(estado);
    }
  });

  it("acento e caixa não mudam o resultado", () => {
    expect(normalizarStatusDoPedido("concluído")).toBe("concluido");
    expect(normalizarStatusDoPedido("CONCLUIDO")).toBe("concluido");
    expect(normalizarStatusDoPedido("  Em Andamento  ")).toBe("em_andamento");
  });

  it("cancelado vence concluído", () => {
    // A ordem dos testes é regra, não acaso: um pedido cancelado nunca pode ser
    // lido como concluído.
    expect(normalizarStatusDoPedido("Entrega cancelada")).toBe("cancelado");
    expect(normalizarStatusDoPedido("Concluído e depois cancelado")).toBe("cancelado");
  });

  it("desconhecido cai em `novo`, e não numa gaveta invisível", () => {
    /**
     * A versão anterior tinha uma gaveta `outros` que **nenhuma aba mostrava**:
     * um status inesperado sumia de todas as abas menos "Todos". Cair em `novo`
     * põe o pedido na frente de quem trabalha a fila.
     */
    expect(normalizarStatusDoPedido("Aguardando retirada")).toBe("novo");
    expect(normalizarStatusDoPedido("")).toBe("novo");
    expect(normalizarStatusDoPedido(null)).toBe("novo");
    expect(normalizarStatusDoPedido(undefined)).toBe("novo");
    expect(normalizarStatusDoPedido(42)).toBe("novo");
  });
});

describe("o que o cliente lê", () => {
  it("`NOVO CARRINHO` aparece como `Novo`", () => {
    // Valor guardado e rótulo exibido são coisas diferentes. O texto gravado
    // continua o mesmo por causa do webhook externo; o cliente não precisa ler
    // "Novo Carrinho" por causa disso.
    expect(rotuloDoStatus("NOVO CARRINHO")).toBe("Novo");
  });

  it("painel e conta do cliente dizem a mesma coisa", () => {
    /**
     * Antes cada tela tinha a própria função. A do painel tratava "conclu" como
     * concluído e a do cliente não — o mesmo pedido saía verde para o
     * atendimento e cinza para o cliente.
     */
    for (const texto of ["NOVO CARRINHO", "Separando", "Entregue", "Cancelado", "Concluído"]) {
      expect(rotuloDoStatus(texto), texto).toBe(rotuloDoStatus(texto));
      expect(classeDoStatus(texto), texto).toBe(classeDoStatus(texto));
    }
    // Concluído e Entregue são o mesmo estado, logo a mesma cor.
    expect(classeDoStatus("Entregue")).toBe(classeDoStatus("Concluído"));
  });

  it("cada estado tem cor própria", () => {
    const cores = new Set(ESTADOS_DO_PEDIDO.map((e) => classeDoStatus(VALORES_GRAVADOS[e])));
    expect(cores.size).toBe(ESTADOS_DO_PEDIDO.length);
  });
});

describe("o valor gravado", () => {
  it("`novo` continua gravando `NOVO CARRINHO`", () => {
    /**
     * Trava deliberada. Esse texto é o que o checkout grava desde sempre, o que
     * os 42 pedidos já têm, e o que sai no webhook do pedido para um consumidor
     * externo que este repositório não enxerga. Trocá-lo obriga a migrar a
     * coluna e a conferir o outro lado.
     */
    expect(VALORES_GRAVADOS.novo).toBe("NOVO CARRINHO");
  });

  it("todo estado sabe voltar de onde veio", () => {
    // Gravar e reler tem que dar no mesmo estado, senão mudar o status no painel
    // moveria o pedido para uma aba diferente da escolhida.
    for (const estado of ESTADOS_DO_PEDIDO) {
      expect(normalizarStatusDoPedido(VALORES_GRAVADOS[estado])).toBe(estado);
    }
  });
});

describe("os estados acrescentados em 31/08/2026", () => {
  it("reconhece aguardando pagamento", () => {
    expect(normalizarStatusDoPedido("Aguardando pagamento")).toBe("aguardando_pagamento");
    expect(normalizarStatusDoPedido("aguardando o pagamento do cliente")).toBe("aguardando_pagamento");
  });

  it("não confunde outra espera com espera de pagamento", () => {
    // "Aguardando retirada" tem de continuar caindo em `novo`: a palavra
    // `aguardando` sozinha casaria com qualquer espera.
    expect(normalizarStatusDoPedido("Aguardando retirada")).toBe("novo");
  });

  it("enviado não é concluído", () => {
    // O pedido saiu, mas ninguém confirmou que chegou. Ler `enviado` como
    // `concluido` fecharia o pedido antes da entrega.
    expect(normalizarStatusDoPedido("Enviado")).toBe("enviado");
    expect(normalizarStatusDoPedido("Despachado")).toBe("enviado");
    expect(normalizarStatusDoPedido("Entregue")).toBe("concluido");
  });

  it("cada estado tem explicação para o cliente, sem sobrar nem faltar", () => {
    for (const estado of ESTADOS_DO_PEDIDO) {
      expect(EXPLICACAO_PARA_O_CLIENTE[estado]).toBeTruthy();
    }
    expect(Object.keys(EXPLICACAO_PARA_O_CLIENTE).sort()).toEqual([...ESTADOS_DO_PEDIDO].sort());
  });

  it("a explicação de aguardando pagamento diz que o pagamento não é pelo site", () => {
    // É a frase que a reclamação de 31/08 pedia: a regra existia só no aviso do
    // catálogo, antes da compra, e sumia depois dela.
    expect(EXPLICACAO_PARA_O_CLIENTE.aguardando_pagamento).toContain("não é feito pelo site");
  });
});
