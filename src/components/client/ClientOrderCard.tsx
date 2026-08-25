import { ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/formatMoney";
import { cn } from "@/lib/utils";
import type { Order, OrderTableLine } from "@/lib/orders";
import { classeDoStatus, rotuloDoStatus } from "@/lib/statusDoPedido";

type ClientOrderCardProps = {
  order: Order;
  lines: OrderTableLine[];
  totalItems: number;
  totalValue: number;
};

// Rotulo e cor do status vem de `statusDoPedido.ts`, compartilhado com o painel.
//
// Esta tela tinha as proprias copias, e elas discordavam: no painel "conclu"
// ficava verde, aqui nao. O mesmo pedido saia verde para o atendimento e cinza
// para o cliente. Agora a regra e uma so.


export function ClientOrderCard({ order, lines, totalItems, totalValue }: ClientOrderCardProps) {
  const createdAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(order.created_at));
  const statusLabel = rotuloDoStatus(order.status);
  const visibleLines = lines.slice(0, 2);
  const remainingCount = Math.max(lines.length - visibleLines.length, 0);

  return (
    <article className="rounded-xl bg-background/95 ring-1 ring-black/5 p-5 shadow-sm transition-shadow hover:shadow-[0_12px_32px_rgba(16,24,40,0.08)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pedido</p>
          <p className="text-sm text-foreground">{createdAt}</p>
        </div>
        <Badge className={cn("rounded-full border px-3 py-1 text-[0.6875rem] font-medium", classeDoStatus(order.status))}>
          {statusLabel}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Itens</p>
          <p className="mt-2 text-sm font-medium text-foreground">{totalItems}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Valor total</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{formatBRL(totalValue)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Empresa</p>
          <p className="mt-2 truncate text-sm font-medium text-foreground">{order.customer_company}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-background ring-1 ring-black/5 p-4">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Itens do pedido</p>
        <div className="mt-3 space-y-2">
          {visibleLines.map((line) => (
            <div key={`${line.code}-${line.name}`} className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
                  {line.imageUrl ? (
                    <img
                      src={line.imageUrl}
                      alt={line.name}
                      className="h-full w-full object-contain p-1"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground/35" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{line.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {line.quantity} x {formatBRL(line.unitPrice)}
                  </p>
                </div>
              </div>
              <p className="text-sm font-medium text-foreground">{formatBRL(line.subtotal)}</p>
            </div>
          ))}
          {remainingCount > 0 ? <p className="text-xs text-muted-foreground">+ {remainingCount} item(ns) adicionais</p> : null}
          {visibleLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Itens ainda não sincronizados para visualização.</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
