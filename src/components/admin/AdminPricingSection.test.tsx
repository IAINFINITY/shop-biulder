import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

/**
 * O selo de "Preço ativo/desligado" na tela de preços.
 *
 * ## Por que um teste que monta a tela
 *
 * Porque o bug não estava na regra — estava na tela usando a regra errada.
 * `linhaDePrecoAtiva` tem teste próprio em `pricing.test.ts` e passaria do mesmo
 * jeito com a tela quebrada, porque a tela nem a chamava: lia
 * `draftActive[code]` cru, e o rascunho começa vazio.
 *
 * O resultado era **toda** linha com preço mostrando "Preço desligado" enquanto
 * o contador no topo, que lê direto do banco, dizia o número certo de ativos. As
 * 730 linhas do banco estavam ativas.
 *
 * Pior que o selo: o botão ao lado calculava `!(rascunho ?? true)`, então o
 * botão escrito "Ativar" gravava `active = false`. Quem tentasse consertar o que
 * via na tela desligava o preço de verdade.
 *
 * É a segunda vez no mesmo dia que uma regra correta passa por uma tela que a
 * ignora — a primeira foi a mensagem de erro do login, traduzida duas vezes. Daí
 * o teste de tela e não só o de unidade.
 */

const LINHAS_DO_BANCO = [
  { id: "1", customer_type: "funcionario", proxis_tpr_id: null, product_code: "7487", price: 34.67, active: true },
  { id: "2", customer_type: "funcionario", proxis_tpr_id: null, product_code: "14210", price: 37.99, active: false },
];

/** Corrente encadeável que resolve na lista pedida. */
function corrente(resposta: unknown) {
  const alvo: Record<string | symbol, unknown> = {};
  const proxy: unknown = new Proxy(alvo, {
    get(_d, prop) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown) => Promise.resolve({ data: resposta, error: null }).then(ok);
      }
      return () => proxy;
    },
  });
  return proxy;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tabela: string) =>
      corrente(tabela === "clinic+b2b_customer_price_overrides" ? LINHAS_DO_BANCO : []),
  },
}));

vi.mock("@/lib/apiFetch", () => ({
  // A lista de tabelas do Proxis não interessa aqui: o modo padrão da tela é
  // "Tipo de cliente", que é onde a tabela de funcionário vive.
  apiFetch: async () => ({ ok: false, status: 503, json: async () => ({}) }),
}));

vi.mock("@/hooks/useCustomerTypes", () => ({
  useCustomerTypes: () => ({
    options: [
      { name: "cliente", label: "Cliente" },
      { name: "funcionario", label: "Funcionário" },
    ],
    addCustomType: vi.fn(),
  }),
}));

import { AdminPricingSection } from "@/components/admin/AdminPricingSection";

const PRODUTOS = [
  { id: "p1", product_code: "7487", name: "Creatina Monohidratada", price: 27.99, family: "Aminoácido", type: "Pó", active: true },
  { id: "p2", product_code: "14210", name: "Glutamina", price: 69.99, family: "Aminoácido", type: "Pó", active: true },
] as never;

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminPricingSection products={PRODUTOS} onRefreshPricing={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("selo de preço ativo", () => {
  it("linha ativa no banco aparece como ativa, sem ninguém tocar em nada", async () => {
    montar();

    // A trava do bug: antes, esta era a asserção que falhava — vinha
    // "Preço desligado" para uma linha com `active: true`.
    await waitFor(() => expect(screen.getByText("Preço ativo")).toBeTruthy());
  });

  it("linha desligada no banco continua aparecendo como desligada", async () => {
    // A correção não pode ser "mostrar tudo como ativo": `false` gravado é um
    // valor legítimo e precisa sobreviver ao carregamento.
    montar();
    await waitFor(() => expect(screen.getByText("Preço desligado")).toBeTruthy());
  });

  it("o botão oferece a ação oposta ao estado real de cada linha", async () => {
    /**
     * O rótulo é o que torna o bug perigoso: com tudo lido como desligado, o
     * botão dizia "Ativar" em toda linha e desligava ao ser clicado.
     */
    montar();
    await waitFor(() => expect(screen.getByText("Preço ativo")).toBeTruthy());

    // Uma linha ativa (7487) e uma desligada (14210): um "Desativar" e um "Ativar".
    expect(screen.getAllByRole("button", { name: "Desativar" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Ativar" })).toHaveLength(1);
  });
});
