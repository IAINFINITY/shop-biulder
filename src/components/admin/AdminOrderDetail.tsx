import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ImageIcon, MapPin, Package, Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/formatMoney";
import { formatDocumentId } from "@/lib/brazilianIds";
import {
  classeDoStatus,
  EXPLICACAO_PARA_O_CLIENTE,
  normalizarStatusDoPedido,
  rotuloDoStatus,
} from "@/lib/statusDoPedido";
import { getOrderLinesGrandTotal, getOrderLinesQuantityTotal, type OrderTableLine } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { IMAGEM_DO_CARTAO } from "@/lib/interacoes";
import type { AdminOrderRow } from "./adminTypes";

/**
 * A tela de um pedido.
 *
 * ## Por que uma tela, e não a gavetinha
 *
 * O card do pedido mostrava os itens numa lista recolhida de dois. Um pedido
 * B2B tem dezenas de linhas — a gaveta respondia "quantos", nunca "quais", e
 * quem precisava conferir o pedido inteiro exportava o arquivo para ler fora do
 * sistema.
 *
 * As referências de backoffice convergem no mesmo desenho para isto: resumo no
 * topo, itens em lista completa, endereço e totais ao lado, e uma **linha do
 * tempo** do que aconteceu. A linha do tempo é o que responde "por onde este
 * pedido passou" — pergunta que a coluna `status`, sozinha, apaga a cada
 * mudança.
 *
 * ## Endereço e itens são o que está gravado no pedido
 *
 * Não o que está no cadastro do cliente hoje. Cliente muda de endereço; o pedido
 * de abril foi para o endereço de abril. Ler do cadastro na hora de mostrar
 * reescreveria a história.
 */

type EventoDoPedido = {
  id: string;
  status_anterior: string | null;
  status_novo: string;
  observacao: string | null;
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
    // Reage de leve ao mouse, como os cartões do Dashboard: não é clicável, então
    // ganha só a borda e a sombra — sem cursor de link e sem levantar, que seriam
    // promessa de um clique que não existe.
    <section className="rounded-[1.25rem] border border-border/70 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-[0_4px_16px_rgba(16,24,40,0.06)]">
      {/* O ícone em círculo no vermelho da marca — a mesma forma dos cartões do
          dashboard e do diálogo Organizar. Sem ele a tela era texto cinza
          empilhado, sem nada guiando o olho entre os blocos. */}
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

export function AdminOrderDetail({
  order,
  lines,
  numeroDoPedido,
  onVoltar,
  acoes,
}: {
  order: AdminOrderRow;
  lines: OrderTableLine[];
  /** O mesmo número que a lista mostra, para a pessoa reconhecer o pedido. */
  numeroDoPedido: number;
  onVoltar: () => void;
  /** Exportações e mudança de estado continuam vindo de quem já as tem. */
  acoes?: React.ReactNode;
}) {
  const eventosQuery = useQuery({
    queryKey: ["order-events", order.id],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic+b2b_order_events")
        .select("id, status_anterior, status_novo, observacao, created_at")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventoDoPedido[];
    },
  });

  const total = getOrderLinesGrandTotal(lines);
  const quantidade = getOrderLinesQuantityTotal(lines);
  const estado = normalizarStatusDoPedido(order.status);

  // O complemento sai da linha do endereço e vira campo próprio: é onde vai
  // "fundos", "bloco B", "falar com o Paulo" — informação que quem entrega
  // precisa achar, e que some no meio de uma linha corrida.
  const endereco = [order.customer_address_street, order.customer_address_number].filter(Boolean).join(", ");

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        {/* ⚠️ O botão de voltar mora **dentro** do cartão.
            Ele tinha uma faixa só para si acima daqui, com `justify-end` — e
            como `acoes` nunca chega preenchido, era uma linha inteira da tela
            ocupada por um botão e ar. O buraco entre o título da seção e o
            cartão vinha daí, não de margem. */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Pedido #{numeroDoPedido}
            </p>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground">
              {order.customer_company || order.customer_name}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{formatarDataHora(order.created_at)}</p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Badge className={cn("rounded-full border px-3 py-1 text-[0.8125rem] font-medium", classeDoStatus(order.status))}>
              {rotuloDoStatus(order.status)}
            </Badge>
            {acoes}
            <Button type="button" variant="outline" className="h-9 rounded-2xl px-3" onClick={onVoltar}>
              <ArrowLeft className="h-4 w-4" />
              Todos os pedidos
            </Button>
          </div>
        </div>

        {/* A mesma frase que o cliente lê na conta dele.
            Sem isto o atendimento decide o estado sem ver o que a decisão
            comunica — e foi essa distância que gerou a reclamação de 31/08. */}
        <p className="mt-3 rounded-xl bg-muted/60 p-3 text-[0.8125rem] leading-6 text-muted-foreground">
          <span className="font-medium text-foreground">O cliente está lendo:</span>{" "}
          {EXPLICACAO_PARA_O_CLIENTE[estado]}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 transition-colors hover:border-primary/25 hover:bg-primary/[0.04]">
            <p className="text-[0.6875rem] text-muted-foreground">Itens</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{lines.length}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 transition-colors hover:border-primary/25 hover:bg-primary/[0.04]">
            <p className="text-[0.6875rem] text-muted-foreground">Unidades</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{quantidade}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 transition-colors hover:border-primary/25 hover:bg-primary/[0.04]">
            <p className="text-[0.6875rem] text-muted-foreground">Total</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatBRL(total)}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Bloco icone={Package} titulo={`Itens do pedido (${lines.length})`}>
          {/* A lista inteira, sem recolher.
              É o motivo desta tela existir: a gaveta do card mostrava dois. */}
          {/* Altura limitada com rolagem própria.
              Um pedido de cinquenta linhas empurrava a linha do tempo e o
              endereço para fora da tela — a página inteira virava a lista. Com
              o teto, os três blocos continuam à vista e a lista rola dentro
              dela mesma. */}
          {/* ⚠️ `pr-4` nas celulas da ultima coluna, e nao no container.
                A barra de rolagem desta caixa e desenhada **por cima** do
                conteudo, e "Total" era a unica coluna sem folga a direita: os
                centavos ficavam atras da barra ("R$ 32,2"), inclusive no
                cabecalho sticky. Padding no container nao resolveria — a barra
                mora na borda do container, dentro do padding. */}
            <div className="max-h-[32rem] overflow-auto">
            <table className="w-full min-w-[34rem] border-collapse text-[0.8125rem]">
              <thead>
                {/* `sticky`: rolando uma lista longa dentro da caixa, sem isto
                    o cabeçalho some e as colunas viram números sem nome. */}
                <tr className="sticky top-0 z-10 border-b border-border/70 bg-card text-left text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold" colSpan={2}>Produto</th>
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
                    {/* A foto do produto: conferir um pedido de cinquenta linhas
                        por nome é mais lento e mais sujeito a erro do que bater
                        o olho na embalagem. */}
                    <td className="py-2 pr-3">
                      <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-border bg-background transition-colors group-hover:border-primary/30">
                        {line.imageUrl ? (
                          <img
                            src={line.imageUrl}
                            alt=""
                            className={cn("h-full w-full object-contain p-0.5", IMAGEM_DO_CARTAO)}
                          />
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
                    {formatBRL(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Bloco>

        <div className="space-y-4">
          <Bloco icone={User} titulo="Quem pediu">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Nome" valor={order.customer_name} />
              <Campo rotulo="Empresa" valor={order.customer_company} />
              <Campo rotulo="Documento" valor={order.customer_cnpj ? formatDocumentId(order.customer_cnpj) : null} />
              <Campo rotulo="Telefone" valor={order.customer_phone} />
            </div>
            {order.customer_observation ? (
              <p className="mt-3 rounded-xl bg-muted/50 p-3 text-[0.8125rem] leading-6 text-foreground">
                <span className="font-medium">Observação de quem pediu:</span> {order.customer_observation}
              </p>
            ) : null}
          </Bloco>

          <Bloco icone={MapPin} titulo="Entrega">
            {/* O endereço gravado no pedido, não o do cadastro de hoje. */}
            <div className="space-y-3">
              <Campo rotulo="Endereço" valor={endereco} />
              <Campo rotulo="Complemento" valor={order.customer_address_complement} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Bairro" valor={order.customer_address_neighborhood} />
                <Campo rotulo="CEP" valor={order.customer_address_cep} />
                <Campo
                  rotulo="Cidade"
                  valor={
                    order.customer_address_city
                      ? `${order.customer_address_city}${order.customer_address_state ? ` · ${order.customer_address_state}` : ""}`
                      : null
                  }
                />
              </div>
            </div>
          </Bloco>

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
                    {/* O fio que liga os pontos não desce do último: uma linha
                        que continua depois do fim sugere que falta evento. */}
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
                      <p className="text-[0.8125rem] font-medium text-foreground">
                        {rotuloDoStatus(evento.status_novo)}
                        {evento.status_anterior ? (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · veio de {rotuloDoStatus(evento.status_anterior)}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatarDataHora(evento.created_at)}</p>
                      {evento.observacao ? (
                        <p className="mt-1 text-xs leading-5 text-foreground">{evento.observacao}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Bloco>
        </div>
      </div>
    </div>
  );
}
