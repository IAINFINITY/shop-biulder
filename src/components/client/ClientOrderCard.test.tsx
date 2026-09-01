import { afterEach, describe, expect, it, vi } from "vitest";
// `fireEvent` e não `user-event`: a biblioteca de interação não está instalada
// neste projeto — ver a nota igual em `secoes.smoke.test.tsx`.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ClientOrderCard } from "./ClientOrderCard";
import type { Order, OrderTableLine } from "@/lib/orders";

/**
 * O cartão de pedido da conta.
 *
 * ## Por que este teste existe
 *
 * A prop `onAbrir` foi adicionada, chegou na assinatura da função, passou no
 * `tsc`, passou no `build` — e **nunca foi ligada ao elemento**. O cartão
 * continuou inerte, e eu afirmei duas vezes que estava pronto porque li o
 * código em vez de exercitá-lo.
 *
 * TypeScript não pega prop recebida e não usada. Só um clique pega.
 */

const pedido: Order = {
  id: "abc-123",
  submission_key: "k",
  customer_name: "Ana Souza",
  customer_phone: "82987592540",
  customer_company: "Clínica Sol",
  customer_cnpj: "66121553000100",
  items: [],
  total_items: 3,
  status: "NOVO CARRINHO",
  created_at: "2026-09-01T14:00:00.000Z",
};

const linhas: OrderTableLine[] = [
  { code: "7161", name: "5 Óleos", type: "Cápsula", family: "Óleos", quantity: 3, unitPrice: 24.99, subtotal: 74.97, imageUrl: null },
];

function montar(onAbrir?: () => void) {
  return render(
    <ClientOrderCard order={pedido} lines={linhas} numero={7} totalItems={3} totalValue={74.97} onAbrir={onAbrir} />,
  );
}

describe("ClientOrderCard", () => {
  afterEach(cleanup);

  it("com `onAbrir`, clicar no cartão abre o pedido", () => {
    const abrir = vi.fn();
    montar(abrir);

    fireEvent.click(screen.getByRole("button"));
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  // Teclado: o cartão é um `<article>` com `role="button"`, e nesse caso o
  // navegador não dispara clique com Enter/Espaço sozinho.
  it("abre pelo teclado, com Enter e com espaço", () => {
    const abrir = vi.fn();
    montar(abrir);

    const cartao = screen.getByRole("button");
    fireEvent.keyDown(cartao, { key: "Enter" });
    fireEvent.keyDown(cartao, { key: " " });

    expect(abrir).toHaveBeenCalledTimes(2);
  });

  // ⚠️ Sem `onAbrir` ele não pode se anunciar como botão: um leitor de tela
  // diria "botão" para algo que não faz nada.
  it("sem `onAbrir`, não é um botão", () => {
    montar(undefined);
    expect(screen.queryByRole("button")).toBeNull();
  });

  // ⚠️ Um alvo clicável só. O rodapé "Ver pedido" já foi um `<button>` dentro do
  // cartão `role="button"`: o teclado parava duas vezes no mesmo pedido e o
  // leitor de tela anunciava dois controles para uma ação só.
  it("é um alvo de clique só, mesmo com o rodapé Ver pedido", () => {
    montar(vi.fn());
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("mostra o número do pedido, o mesmo que a tela do detalhe usa", () => {
    montar();
    expect(screen.getByText("Pedido #7")).toBeTruthy();
  });

  // O cartão dizia "Itens: 315" para um pedido de 50 produtos, porque passava a
  // soma das quantidades sob o rótulo "Itens". A tela do mesmo pedido dizia
  // "Itens 50 / Unidades 315".
  it("separa itens de unidades, como a tela do pedido", () => {
    render(
      <ClientOrderCard
        order={pedido}
        lines={[...linhas, { ...linhas[0], code: "7162", name: "3 Ômegas" }]}
        numero={1}
        totalItems={9}
        totalValue={100}
      />,
    );
    const itens = screen.getByText("Itens").parentElement;
    const unidades = screen.getByText("Unidades").parentElement;
    expect(itens?.textContent).toContain("2");
    expect(unidades?.textContent).toContain("9");
  });

  it("mostra o total e o estado do pedido", () => {
    montar();
    // `getAllBy`: o valor aparece no subtotal da linha e no total do pedido.
    expect(screen.getAllByText(/74,97/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Novo/i)).toBeTruthy();
  });
});
