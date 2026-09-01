import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, ImageIcon, MapPin, Package, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDocumentId, formatPhone } from "@/lib/brazilianIds";
import { formatBRL } from "@/lib/formatMoney";
import { IMAGEM_DO_CARTAO } from "@/lib/interacoes";
import type { Order, OrderTableLine } from "@/lib/orders";
import {
  classeDoStatus,
  EXPLICACAO_PARA_O_CLIENTE,
  normalizarStatusDoPedido,
  rotuloDoStatus,
} from "@/lib/statusDoPedido";
import { cn } from "@/lib/utils";

/**
 * A tela de um pedido, do lado de quem comprou.
 *
 * ## O que faltava
 *
 * O cartão mostrava dois itens e "e mais 6". Um pedido de dezesseis linhas
 * respondia "quantos", nunca "quais" — e não dizia para onde vai nem por onde
 * passou. Era a metade da reclamação de 31/08 que a linha do tempo do painel
 * resolveu **só para o atendimento**.
 *
 * ## ⚠️ É a tela do painel, com o que é do cliente
 *
 * Mesma ossatura de `AdminOrderDetail`: estado no topo com a frase que explica,
 * três números, itens com foto, endereço e linha do tempo. Três coisas saem,
 * porque não são dele:
 *
 * - **o valor unitário e o subtotal por linha**, não: eles ficam. É o preço que
 *   ele paga, e esconder o que ele já vê no carrinho seria pior.
 * - **quem mudou o estado** (`alterado_por`) — nome de funcionário nosso não
 *   diz nada a quem comprou e expõe a equipe;
 * - **a observação interna** de cada evento, escrita para o time;
 * - **o estado do ERP**, que é operação nossa.
 *
 * O histórico já é lido pela policy "Cliente lê o histórico do próprio pedido",
 * criada junto com a tabela — este componente não precisou de permissão nova.
 */

type EventoDoPedido = {
  id: string;
  status_anterior: string | null;
  status_novo: string;
  created_at: string;
};

function formatarDataHora(valor: string | null | undefined): string {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}

function Bloco({
  icone: Icone,
  titulo,
  children,
}: {
  icone: typeof Package;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.25rem] border border-border/70 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-[0_4px_16px_rgba(16,24,40,0.06)]">
      <p className="flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icone className="h-4 w-4" />
        </span>
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {titulo}
        </span>
      </p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.6875rem] text-muted-foreground">{rotulo}</p>
      <p className="mt-0.5 break-words text-[0.8125rem] text-foreground">{valor || "—"}</p>
    </div>
  );
}

export function ClientOrderDetail({
  order,
  lines,
  numeroDoPedido,
  totalItems,
  totalValue,
  onVoltar,
}: {
  order: Order;
  lines: OrderTableLine[];
  /** O mesmo número que a lista mostra, para a pessoa reconhecer o pedido. */
  numeroDoPedido: number;
  totalItems: number;
  totalValue: number;
  onVoltar: () => void;
}) {
  const eventosQuery = useQuery({
    queryKey: ["client-order-events", order.id],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic+b2b_order_events")
        // ⚠️ Sem `alterado_por` e sem `observacao`: um é nome de funcionário
        // nosso, o outro é recado interno. Nem um nem outro é do cliente.
        .select("id, status_anterior, status_novo, created_at")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as EventoDoPedido[];
    },
  });

  const estado = normalizarStatusDoPedido(order.status);

  const enderecoLinha = [order.customer_address_street, order.customer_address_number].filter(Boolean).join(", ");
  const cidadeLinha = [order.customer_address_city, order.customer_address_state].filter(Boolean).join("/");
  const temEndereco = Boolean(enderecoLinha || cidadeLinha || order.customer_address_cep);

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Pedido #{numeroDoPedido}
            </p>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground">
              {formatarDataHora(order.created_at)}
            </h2>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Badge className={cn("rounded-full border px-3 py-1 text-[0.8125rem] font-medium", classeDoStatus(order.status))}>
              {rotuloDoStatus(order.status)}
            </Badge>
            <Button type="button" variant="outline" className="h-9 rounded-2xl px-3" onClick={onVoltar}>
              <ArrowLeft className="h-4 w-4" />
              Meus pedidos
            </Button>
          </div>
        </div>

        {/* A mesma frase que o atendimento vê antes de mudar o estado, e a mesma
            que chega no aviso. Três lugares, um texto. */}
        <p className="mt-3 rounded-xl bg-muted/60 p-3 text-[0.8125rem] leading-6 text-muted-foreground">
          {EXPLICACAO_PARA_O_CLIENTE[estado]}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { rotulo: "Itens", valor: String(lines.length) },
            { rotulo: "Unidades", valor: String(totalItems) },
            { rotulo: "Total", valor: formatBRL(totalValue) },
          ].map((tile) => (
            <div
              key={tile.rotulo}
              className="rounded-xl border border-border/70 bg-muted/20 p-3 transition-colors hover:border-primary/25 hover:bg-primary/[0.04]"
            >
              <p className="text-[0.6875rem] text-muted-foreground">{tile.rotulo}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{tile.valor}</p>
            </div>
          ))}
        </div>
      </section>

      <Bloco icone={Package} titulo={`Itens do pedido (${lines.length})`}>
        {/* ⚠️ `pr-4` na última coluna: a barra de rolagem desta caixa é
            desenhada por cima do conteúdo, e sem folga os centavos de "Total"
            ficavam atrás dela. Mesmo cuidado da tela do painel. */}
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-[0.8125rem]">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-border/70 bg-card text-left text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="pb-2 pr-3 font-semibold" />
                <th className="pb-2 pr-3 font-semibold">Produto</th>
                <th className="pb-2 pr-3 text-right font-semibold">Qtd.</th>
                <th className="pb-2 pr-3 text-right font-semibold">Unitário</th>
                <th className="pb-2 pr-4 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr
                  key={`${line.code}-${i}`}
                  className="group border-b border-border/40 transition-colors last:border-0 hover:bg-primary/[0.04]"
                >
                  <td className="py-2 pr-3">
                    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-border bg-background transition-colors group-hover:border-primary/30">
                      {line.imageUrl ? (
                        <img src={line.imageUrl} alt="" className={cn("h-full w-full object-contain p-0.5", IMAGEM_DO_CARTAO)} />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground/35" />
                      )}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="block text-foreground">{line.name}</span>
                    <span className="block font-mono text-[0.6875rem] text-muted-foreground">{line.code}</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{line.quantity}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(line.unitPrice)}</td>
                  <td className="py-2 pr-4 text-right font-medium tabular-nums">
                    {formatBRL(line.unitPrice * line.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border/70">
                <td colSpan={4} className="pt-2.5 pr-3 text-right font-medium text-muted-foreground">
                  Total do pedido
                </td>
                <td className="pt-2.5 pr-4 text-right text-[0.9375rem] font-semibold tabular-nums text-foreground">
                  {formatBRL(totalValue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Bloco>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco icone={User} titulo="Quem pediu">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome" valor={order.customer_name} />
            <Campo rotulo="Empresa" valor={order.customer_company} />
            <Campo rotulo="CNPJ / CPF" valor={order.customer_cnpj ? formatDocumentId(order.customer_cnpj) : ""} />
            <Campo rotulo="Telefone" valor={order.customer_phone ? formatPhone(order.customer_phone) : ""} />
          </div>
        </Bloco>

        {temEndereco ? (
          <Bloco icone={MapPin} titulo="Entrega">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Endereço" valor={enderecoLinha} />
              {/* O complemento sai da linha do endereço e vira campo próprio: é
                  onde vai "fundos", "bloco B" — o que some numa linha corrida. */}
              <Campo rotulo="Complemento" valor={order.customer_address_complement} />
              <Campo rotulo="Bairro" valor={order.customer_address_neighborhood} />
              <Campo rotulo="Cidade / UF" valor={cidadeLinha} />
              <Campo rotulo="CEP" valor={order.customer_address_cep} />
              <Campo rotulo="Observação" valor={order.customer_observation} />
            </div>
          </Bloco>
        ) : null}
      </div>

      <Bloco icone={Clock} titulo="Linha do tempo">
        {eventosQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : eventosQuery.isError ? (
          <p className="text-xs text-destructive">Não foi possível carregar o histórico.</p>
        ) : (
          <ol className="space-y-0">
            {(eventosQuery.data ?? []).map((evento, i, todos) => (
              <li
                key={evento.id}
                className="group relative -mx-2 flex gap-3 rounded-lg px-2 py-1 pb-4 transition-colors last:pb-1 hover:bg-muted/50"
              >
                {/* O fio não desce do último: uma linha que continua depois do
                    fim sugere que falta evento. */}
                {i < todos.length - 1 ? (
                  <span className="absolute left-[0.8125rem] top-4 h-full w-px bg-border" aria-hidden />
                ) : null}
                <span
                  className={cn(
                    "relative mt-2.5 h-2.5 w-2.5 shrink-0 rounded-full transition-transform group-hover:scale-125",
                    "motion-reduce:transition-none motion-reduce:group-hover:scale-100",
                    i === 0 ? "bg-primary" : "bg-border group-hover:bg-primary/50",
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.8125rem] font-medium text-foreground">{rotuloDoStatus(evento.status_novo)}</p>
                  <p className="text-[0.6875rem] text-muted-foreground">{formatarDataHora(evento.created_at)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Bloco>
    </div>
  );
}
