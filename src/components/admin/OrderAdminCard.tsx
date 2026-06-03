import { useState } from "react";
import { ChevronDown, FileDown, FileSpreadsheet, FileText, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { OrderItemsTable } from "@/components/admin/OrderItemsTable";
import { formatBRL } from "@/lib/formatMoney";
import type { OrderTableLine } from "@/lib/orders";
import { cn } from "@/lib/utils";

export type OrderAdminCardPayload = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_company: string;
  customer_phone: string;
  customer_cnpj: string;
  status: string;
  total_items: number;
  proxis_import_id: number | null;
  items: unknown;
};

type Props = {
  order: OrderAdminCardPayload;
  lines: OrderTableLine[];
  orderTotal: number;
  orderQty: number;
  formatDate: (value: string) => string;
  isProxisExporting: boolean;
  onExportProxis: () => void;
  onExportXlsx: () => void;
  onExportPdf: () => void;
  onDelete: () => void;
};

export function OrderAdminCard({
  order,
  lines,
  orderTotal,
  orderQty,
  formatDate,
  isProxisExporting,
  onExportProxis,
  onExportXlsx,
  onExportPdf,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const itemLabel = lines.length === 1 ? "1 item" : `${lines.length} itens`;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border bg-card">
      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex gap-2 sm:gap-3">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-expanded={open}
              aria-label={open ? "Recolher pedido" : "Expandir pedido"}
            >
              <ChevronDown
                className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
              />
            </button>
          </CollapsibleTrigger>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{order.customer_name}</p>
                <p className="text-sm text-muted-foreground truncate">{order.customer_company}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0">
                <Badge variant="secondary">{order.status}</Badge>
                {order.proxis_import_id != null && (
                  <Badge variant="outline" className="font-mono text-xs">
                    Proxis {order.proxis_import_id}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(order.created_at)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
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
              <span className="text-xs text-muted-foreground">{itemLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-10 sm:pl-11">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 h-8"
            disabled={isProxisExporting}
            onClick={onExportProxis}
          >
            <FileDown className="h-3.5 w-3.5" />
            {isProxisExporting ? "Gerando..." : "Proxis .txt"}
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1 h-8" onClick={onExportXlsx}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1 h-8" onClick={onExportPdf}>
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={onDelete}
            title="Excluir pedido"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <CollapsibleContent className="border-t border-border">
        <div className="space-y-3 p-3 sm:p-4 pt-3">
          <p className="text-xs text-muted-foreground">
            Telefone: <span className="text-foreground">{order.customer_phone}</span>
            {" · "}
            CNPJ: <span className="text-foreground">{order.customer_cnpj}</span>
          </p>
          <OrderItemsTable lines={lines} maxBodyHeight="max-h-52" />
          {order.total_items !== orderQty && (
            <p className="text-[11px] text-muted-foreground">
              Quantidade registrada no envio: {order.total_items}
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
