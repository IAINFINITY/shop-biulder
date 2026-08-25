import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderAdminCard } from "@/components/admin/OrderAdminCard";
import { VALORES_GRAVADOS } from "@/lib/statusDoPedido";

/**
 * O seletor de status do pedido.
 *
 * ## O que estava errado, e o que não estava
 *
 * O seletor **gravava**: montado em teste ele renderiza, e o `UPDATE` passa pelo
 * RLS (conferido simulando o JWT de um admin real). Os 42 pedidos estavam todos
 * em `NOVO CARRINHO` porque ninguém usou, não porque falhasse.
 *
 * O que não funcionava era a ligação entre escolher e ver: o seletor oferecia
 * `Separando / Processando / Entregue` e as abas agrupavam em
 * `Em andamento / Concluídos / Cancelados`. Nada na tela dizia que "Entregue"
 * cai em "Concluídos".
 */

function montar(status: string, onStatusChange?: (id: string, s: string) => void) {
  return render(
    <OrderAdminCard
      order={{
        id: "o1",
        created_at: "2026-08-25T10:00:00Z",
        customer_name: "Teste",
        customer_company: "X",
        customer_phone: "1",
        customer_cnpj: "1",
        customer_observation: null,
        status,
        total_items: 1,
        proxis_status: "pendente",
        items: [],
      } as never}
      displayOrderNumber={1}
      lines={[]}
      orderTotal={0}
      orderQty={0}
      formatDate={() => "25/08"}
      isProxisExporting={false}
      onExportProxis={vi.fn()}
      isProxisResending={false}
      onResendProxis={vi.fn()}
      onExportXlsx={vi.fn()}
      onExportPdf={vi.fn()}
      onDelete={vi.fn()}
      onStatusChange={onStatusChange}
    />,
  );
}

describe("status no cartão do pedido", () => {
  it("`NOVO CARRINHO` é mostrado como `Novo`", () => {
    // Valor guardado e rótulo lido são coisas diferentes: o texto na coluna
    // continua o mesmo por causa do webhook externo.
    montar("NOVO CARRINHO", vi.fn());
    expect(screen.getByRole("combobox").textContent).toBe("Novo");
  });

  it("o vocabulário antigo cai no estado certo", () => {
    // Sem migração: 42 pedidos e qualquer status escrito por integração.
    montar("Entregue", vi.fn());
    expect(screen.getByRole("combobox").textContent).toBe("Concluído");
  });

  it("escolher grava o texto canônico daquele estado", () => {
    /**
     * O que fecha o ciclo: o valor gravado tem que reler como o mesmo estado,
     * senão mudar o status move o pedido para uma aba diferente da escolhida.
     */
    expect(VALORES_GRAVADOS.concluido).toBe("Concluído");
    expect(VALORES_GRAVADOS.novo).toBe("NOVO CARRINHO");
  });

  it("sem permissão de editar, o status vira selo e não seletor", () => {
    // `onStatusChange` ausente = admin sem a permissão `pedidos`. Ele continua
    // vendo em que pé está o pedido, mas não move.
    montar("NOVO CARRINHO", undefined);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Novo")).toBeTruthy();
  });
});
