import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/formatMoney";
import { cn } from "@/lib/utils";
import type { Order, OrderTableLine } from "@/lib/orders";

type ClientOrderCardProps = {
  order: Order;
  lines: OrderTableLine[];
  totalItems: number;
  totalValue: number;
};

function formatOrderStatus(status: string) {
  const normalized = status.trim().replace(/_/g, " ");
  if (!normalized) return "Pedido";
  return normalized
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getStatusClassName(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("cancel")) return "border-destructive/20 bg-destructive/5 text-destructive";
  if (normalized.includes("entreg")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized.includes("separ") || normalized.includes("process") || normalized.includes("prepar")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-border/70 bg-muted/30 text-foreground";
}

export function ClientOrderCard({ order, lines, totalItems, totalValue }: ClientOrderCardProps) {
  const createdAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(order.created_at));
  const statusLabel = formatOrderStatus(order.status);
  const visibleLines = lines.slice(0, 2);
  const remainingCount = Math.max(lines.length - visibleLines.length, 0);

  return (
    <article className="rounded-[1.5rem] border border-border/70 bg-background/95 p-5 shadow-sm transition-shadow hover:shadow-[0_10px_30px_rgba(16,24,40,0.08)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Pedido</p>
          <p className="text-sm text-foreground">{createdAt}</p>
        </div>
        <Badge className={cn("rounded-full border px-3 py-1 text-[11px] font-medium", getStatusClassName(order.status))}>
          {statusLabel}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Itens</p>
          <p className="mt-2 text-sm font-medium text-foreground">{totalItems}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Valor total</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{formatBRL(totalValue)}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Empresa</p>
          <p className="mt-2 truncate text-sm font-medium text-foreground">{order.customer_company}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border/70 bg-background p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Itens do pedido</p>
        <div className="mt-3 space-y-2">
          {visibleLines.map((line) => (
            <div key={`${line.code}-${line.name}`} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{line.name}</p>
                <p className="text-xs text-muted-foreground">
                  {line.quantity} x {formatBRL(line.unitPrice)}
                </p>
              </div>
              <p className="text-sm font-medium text-foreground">{formatBRL(line.subtotal)}</p>
            </div>
          ))}
          {remainingCount > 0 ? (
            <p className="text-xs text-muted-foreground">+ {remainingCount} item(ns) adicionais</p>
          ) : null}
          {visibleLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Itens ainda não sincronizados para visualização.</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
