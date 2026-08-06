import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrderItemsTable } from "@/components/admin/OrderItemsTable";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { formatBRL } from "@/lib/formatMoney";
import type { OrderTableLine } from "@/lib/orders";
import {
  PROXIS_SYNC_ERROR,
  PROXIS_SYNC_LABELS,
  PROXIS_SYNC_LEGACY,
  PROXIS_SYNC_PENDING,
  PROXIS_SYNC_SENT,
  normalizeProxisSyncStatus,
} from "@/lib/proxisOrderStatus";
import { cn } from "@/lib/utils";

export type OrderAdminCardPayload = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_company: string | null | undefined;
  customer_phone: string | null | undefined;
  customer_cnpj: string | null | undefined;
  customer_observation?: string | null;
  status: string;
  total_items: number;
  proxis_import_id: number | null;
  proxis_status?: string | null;
  proxis_error?: string | null;
  proxis_doc_ped_web?: string | null;
  proxis_attempts?: number | null;
  proxis_last_attempt_at?: string | null;
  items: unknown;
};

const PROXIS_SYNC_BADGE = {
  [PROXIS_SYNC_SENT]: { icon: CheckCircle2, className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  [PROXIS_SYNC_PENDING]: { icon: Clock, className: "border-amber-200 bg-amber-50 text-amber-800" },
  [PROXIS_SYNC_ERROR]: { icon: AlertTriangle, className: "border-red-200 bg-red-50 text-red-700" },
  [PROXIS_SYNC_LEGACY]: { icon: Clock, className: "border-border/70 bg-muted/30 text-muted-foreground" },
} as const;

const ORDER_STATUSES = [
  "NOVO CARRINHO",
  "Separando",
  "Processando",
  "Entregue",
  "Cancelado",
] as const;

type Props = {
  order: OrderAdminCardPayload;
  displayOrderNumber: number;
  lines: OrderTableLine[];
  orderTotal: number;
  orderQty: number;
  formatDate: (value: string) => string;
  isProxisExporting: boolean;
  onExportProxis: () => void;
  isProxisResending: boolean;
  onResendProxis: () => void;
  onExportXlsx: () => void;
  onExportPdf: () => void;
  onDelete: () => void;
  onStatusChange?: (orderId: string, status: string) => void;
};

function formatOrderStatus(status: string) {
  const normalized = status.trim().replace(/_/g, " ");
  if (!normalized) return "Pedido";
  return normalized
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function statusClassName(status: string) {
  const s = status.toLowerCase();
  if (s.includes("cancel")) return "border-red-200 bg-red-50 text-red-700";
  if (s.includes("entreg") || s.includes("conclu")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s.includes("separ") || s.includes("process") || s.includes("prepar") || s.includes("novo")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-border/70 bg-muted/30 text-foreground";
}

export function OrderAdminCard({
  order,
  displayOrderNumber,
  lines,
  orderTotal,
  orderQty,
  formatDate,
  isProxisExporting,
  onExportProxis,
  isProxisResending,
  onResendProxis,
  onExportXlsx,
  onExportPdf,
  onDelete,
  onStatusChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const itemLabel = lines.length === 1 ? "1 item" : `${lines.length} itens`;
  const syncStatus = normalizeProxisSyncStatus(order.proxis_status);
  const syncBadge = PROXIS_SYNC_BADGE[syncStatus];
  const SyncIcon = syncBadge.icon;
  const syncError = order.proxis_error?.trim() ?? "";
  const syncAttempts = typeof order.proxis_attempts === "number" ? order.proxis_attempts : 0;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-[1.25rem] border border-border/70 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_8px_24px_rgba(16,24,40,0.06)]"
    >
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex gap-2 sm:gap-3">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="mt-0.5 flex h-10 sm:h-9 w-10 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-expanded={open}
              aria-label={open ? "Recolher pedido" : "Expandir pedido"}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
            </button>
          </CollapsibleTrigger>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{order.customer_name}</p>
                <p className="truncate text-xs text-muted-foreground">{order.customer_company || "Sem empresa"}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                {onStatusChange ? (
                  <Select value={order.status} onValueChange={(value) => onStatusChange(order.id, value)}>
                    <SelectTrigger
                      className={cn(
                        "h-9 sm:h-7 w-auto gap-1 rounded-full border px-2.5 py-0 text-[0.6875rem] font-medium",
                        statusClassName(order.status),
                        "[&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-50",
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {ORDER_STATUSES.map((status) => (
                        <SelectItem key={status} value={status} className="text-[0.8125rem]">
                          {formatOrderStatus(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={cn("rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium", statusClassName(order.status))}>
                    {formatOrderStatus(order.status)}
                  </Badge>
                )}
                <Badge
                  className={cn(
                    "gap-1 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium",
                    syncBadge.className,
                  )}
                  title={
                    syncError
                      ? `${PROXIS_SYNC_LABELS[syncStatus]}: ${syncError}`
                      : PROXIS_SYNC_LABELS[syncStatus]
                  }
                >
                  <SyncIcon className="h-3 w-3" />
                  {PROXIS_SYNC_LABELS[syncStatus]}
                </Badge>
                {order.proxis_import_id != null ? (
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 font-mono text-[0.6875rem]">
                    Pedido {displayOrderNumber}
                  </Badge>
                ) : null}
                <span className="whitespace-nowrap text-[0.6875rem] text-muted-foreground">{formatDate(order.created_at)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem]">
              <span className="tabular-nums">
                <span className="text-muted-foreground">Qtd:</span>{" "}
                <span className="font-medium text-foreground">{orderQty}</span>
              </span>
              <span className="text-muted-foreground hidden sm:inline">·</span>
              <span className="tabular-nums">
                <span className="text-muted-foreground">Total:</span>{" "}
                <span className="font-semibold text-foreground">{formatBRL(orderTotal)}</span>
              </span>
              <span className="text-muted-foreground hidden sm:inline">·</span>
              <span className="text-[0.6875rem] text-muted-foreground">{itemLabel}</span>
              {order.customer_cnpj ? (
                <>
                  <span className="text-muted-foreground hidden sm:inline">·</span>
                  <span className="text-[0.6875rem] tabular-nums text-muted-foreground">CNPJ: {order.customer_cnpj}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-10 sm:pl-11">
          <Button type="button" variant="outline" size="sm" className="h-10 sm:h-8 gap-1 rounded-full px-3 text-[0.8125rem] sm:text-xs" disabled={isProxisExporting} onClick={onExportProxis}>
            <img src="/icons/txt-file.png" alt="" className="h-3.5 w-3.5" />
            {isProxisExporting ? "Gerando..." : "FOCCO .txt"}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-10 sm:h-8 gap-1 rounded-full px-3 text-[0.8125rem] sm:text-xs" disabled={isProxisResending} onClick={onResendProxis}>
            <RotateCcw className="h-3.5 w-3.5" />
            {isProxisResending ? "Enviando..." : "Reenviar Proxis"}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-10 sm:h-8 gap-1 rounded-full px-3 text-[0.8125rem] sm:text-xs" onClick={onExportXlsx}>
            <img src="/icons/xls.png" alt="" className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-10 sm:h-8 gap-1 rounded-full px-3 text-[0.8125rem] sm:text-xs" onClick={onExportPdf}>
            <img src="/icons/pdf.png" alt="" className="h-3.5 w-3.5" /> PDF
          </Button>
          <ConfirmActionDialog
            trigger={
              <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-8 sm:w-8 rounded-full text-destructive" title="Excluir pedido">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            }
            title="Excluir pedido"
            description="Deseja excluir este pedido permanentemente"
            confirmLabel="Excluir"
            cancelLabel="Cancelar"
            destructive
            onConfirm={onDelete}
          />
        </div>
      </div>

      <CollapsibleContent className="border-t border-border/70">
        <div className="space-y-3 p-3 pt-3 sm:p-4">
          <p className="text-[0.6875rem] text-muted-foreground">
            Telefone: <span className="text-foreground">{order.customer_phone || "—"}</span>
          </p>

          {syncStatus !== PROXIS_SYNC_SENT && syncStatus !== PROXIS_SYNC_LEGACY ? (
            <div
              className={cn(
                "rounded-2xl border p-3",
                syncStatus === PROXIS_SYNC_ERROR
                  ? "border-red-200 bg-red-50/60"
                  : "border-amber-200 bg-amber-50/60",
              )}
            >
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Sincronia com o Proxis
              </p>
              <p className="mt-1 text-[0.8125rem] leading-6 text-foreground">
                {syncStatus === PROXIS_SYNC_ERROR
                  ? "O ERP recusou este pedido. Corrija o motivo abaixo antes de reenviar."
                  : "Este pedido ainda não foi confirmado no ERP. Use “Reenviar Proxis” — o reenvio não duplica."}
              </p>
              {syncError ? (
                <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-background/70 p-2 font-mono text-[0.6875rem] leading-5 text-muted-foreground">
                  {syncError}
                </p>
              ) : null}
              {syncAttempts > 0 ? (
                <p className="mt-2 text-[0.6875rem] text-muted-foreground">
                  {syncAttempts} tentativa(s)
                  {order.proxis_last_attempt_at
                    ? ` · última em ${formatDate(order.proxis_last_attempt_at)}`
                    : ""}
                </p>
              ) : null}
            </div>
          ) : null}

          {order.proxis_doc_ped_web ? (
            <p className="text-[0.6875rem] text-muted-foreground">
              Documento no ERP: <span className="font-mono text-foreground">{order.proxis_doc_ped_web}</span>
            </p>
          ) : null}
          {order.customer_observation?.trim() ? (
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Observação do pedido
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                {order.customer_observation.trim()}
              </p>
            </div>
          ) : null}
          <OrderItemsTable lines={lines} maxBodyHeight="max-h-52" />
          {order.total_items !== orderQty ? (
            <p className="text-[0.6875rem] text-muted-foreground">
              Quantidade registrada no envio: {order.total_items}
            </p>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
