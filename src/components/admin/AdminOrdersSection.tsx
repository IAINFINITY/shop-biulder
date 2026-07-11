import { useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderAdminCard } from "@/components/admin/OrderAdminCard";
import { getOrderLinesGrandTotal, getOrderLinesQuantityTotal, parseOrderTableLines } from "@/lib/orders";
import { formatBRL } from "@/lib/formatMoney";
import type { OrderExportInput } from "@/lib/orderExportTypes";
import { AdminSectionHeader } from "./AdminSectionHeader";
import type { AdminOrderRow } from "./adminTypes";

type OrderEnrichmentMaps = Parameters<typeof parseOrderTableLines>[1];

type AdminOrdersSectionProps = {
  ordersLoading: boolean;
  filteredOrders: AdminOrderRow[];
  orderSearch: string;
  onOrderSearchChange: (value: string) => void;
  pendingOrdersCount: number;
  orderEnrichment: OrderEnrichmentMaps;
  formatDate: (value: string) => string;
  proxisExportingId: string | null;
  onExportProxis: (payload: OrderExportInput) => void | Promise<void>;
  onExportXlsx: (payload: OrderExportInput) => void | Promise<void>;
  onExportPdf: (payload: OrderExportInput) => void | Promise<void>;
  onDelete: (id: string) => void;
  onStatusChange?: (orderId: string, status: string) => void;
};

function statusFilterKey(status: string) {
  const s = status.toLowerCase();
  if (s.includes("cancel")) return "cancelado";
  if (s.includes("entreg") || s.includes("conclu")) return "concluido";
  if (s.includes("separ") || s.includes("process") || s.includes("prepar") || s.includes("novo")) return "em_andamento";
  return "outros";
}

const STATUS_FILTERS = [
  { id: "all", label: "Todos" },
  { id: "em_andamento", label: "Em andamento" },
  { id: "concluido", label: "Concluídos" },
  { id: "cancelado", label: "Cancelados" },
] as const;

type StatusFilterId = (typeof STATUS_FILTERS)[number]["id"];

export function AdminOrdersSection({
  ordersLoading,
  filteredOrders,
  orderSearch,
  onOrderSearchChange,
  pendingOrdersCount,
  orderEnrichment,
  formatDate,
  proxisExportingId,
  onExportProxis,
  onExportXlsx,
  onExportPdf,
  onDelete,
  onStatusChange,
}: AdminOrdersSectionProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilterId>("all");

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilterId, number> = { all: filteredOrders.length, em_andamento: 0, concluido: 0, cancelado: 0 };
    for (const order of filteredOrders) {
      const key = statusFilterKey(order.status);
      if (key in counts) counts[key as StatusFilterId] += 1;
    }
    return counts;
  }, [filteredOrders]);

  const visibleOrders = useMemo(() => {
    if (statusFilter === "all") return filteredOrders;
    return filteredOrders.filter((order) => statusFilterKey(order.status) === statusFilter);
  }, [filteredOrders, statusFilter]);

  const summaryTotal = useMemo(() => {
    let total = 0;
    for (const order of visibleOrders) {
      const lines = parseOrderTableLines(order.items, orderEnrichment);
      total += getOrderLinesGrandTotal(lines);
    }
    return Math.round(total * 100) / 100;
  }, [visibleOrders, orderEnrichment]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-3 sm:space-y-4">
        <AdminSectionHeader
          eyebrow="Pedidos"
          title="Operação diária"
          description="Filtre pedidos por cliente, empresa, telefone, CNPJ ou status."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[11px] text-primary">
                {visibleOrders.length} pedido(s)
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
                {pendingOrdersCount} em andamento
              </Badge>
            </div>
          }
        />
        <Input
          placeholder="Pesquisar pedido (nome, empresa, telefone, CNPJ, status, observação)"
          value={orderSearch}
          onChange={(e) => onOrderSearchChange(e.target.value)}
          className="h-11 rounded-2xl border-border/70 bg-background text-[13px]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter.id}
            type="button"
            variant={statusFilter === filter.id ? "default" : "outline"}
            className="h-10 sm:h-9 rounded-full px-3 text-[13px] sm:text-[12px]"
            onClick={() => setStatusFilter(filter.id)}
          >
            {filter.label}
            <Badge variant="secondary" className="ml-1.5 rounded-full px-1.5 py-0 text-[10px] leading-none">
              {statusCounts[filter.id]}
            </Badge>
          </Button>
        ))}
      </div>

      {visibleOrders.length > 0 && (
        <div className="rounded-[1.25rem] border border-border/70 bg-primary/5 px-3 sm:px-4 py-3 text-[12px] sm:text-[13px] leading-5 sm:leading-6 text-foreground">
          <span className="font-semibold">{visibleOrders.length} pedido(s)</span> no filtro atual · Total:{" "}
          <span className="font-semibold">{formatBRL(summaryTotal)}</span>
        </div>
      )}

      {ordersLoading ? (
        <div className="space-y-3 rounded-[1.25rem] border border-dashed border-border/70 bg-background p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-[1.25rem] border border-border/60 bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                <Skeleton className="h-14 rounded-2xl" />
                <Skeleton className="h-14 rounded-2xl" />
                <Skeleton className="h-14 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border/70 bg-muted/20">
            <ShoppingBag className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="mt-4 text-[15px] font-semibold text-foreground">Nenhum pedido encontrado</p>
          <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
            {statusFilter !== "all"
              ? "Nenhum pedido com esse status no filtro atual. Tente outro status ou ajuste a busca."
              : orderSearch.trim()
                ? "Nenhum pedido encontrado com esse termo. Tente outro termo de busca."
                : "Ainda não há pedidos registrados no sistema."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleOrders.map((order) => {
            const lines = parseOrderTableLines(order.items, orderEnrichment);
            const orderTotal = getOrderLinesGrandTotal(lines);
            const orderQty = getOrderLinesQuantityTotal(lines);
            const customerObservation =
              typeof order.customer_observation === "string" ? order.customer_observation : "";
            const exportPayload = {
              id: order.id,
              created_at: order.created_at,
              customer_name: order.customer_name,
              customer_company: order.customer_company,
              customer_phone: order.customer_phone,
              customer_cnpj: order.customer_cnpj,
              customer_observation: customerObservation || null,
              status: order.status,
              items: order.items,
              proxis_import_id: order.proxis_import_id,
              enrichmentMaps: orderEnrichment,
            } as const;

            return (
              <OrderAdminCard
                key={order.id}
                order={{
                  id: order.id,
                  created_at: order.created_at,
                  customer_name: order.customer_name,
                  customer_company: order.customer_company,
                  customer_phone: order.customer_phone,
                  customer_cnpj: order.customer_cnpj,
                  customer_observation: customerObservation || null,
                  status: order.status,
                  total_items: order.total_items,
                  proxis_import_id: order.proxis_import_id,
                  items: order.items,
                }}
                lines={lines}
                orderTotal={orderTotal}
                orderQty={orderQty}
                formatDate={formatDate}
                isProxisExporting={proxisExportingId === order.id}
                onExportProxis={() => onExportProxis(exportPayload)}
                onExportXlsx={() => onExportXlsx(exportPayload)}
                onExportPdf={() => onExportPdf(exportPayload)}
                onDelete={() => onDelete(order.id)}
                onStatusChange={onStatusChange}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
