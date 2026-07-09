import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderAdminCard } from "@/components/admin/OrderAdminCard";
import { getOrderLinesGrandTotal, getOrderLinesQuantityTotal, parseOrderTableLines } from "@/lib/orders";
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
  onExportProxis: (payload: Parameters<typeof import("@/lib/orderExport").downloadProxisImportTxt>[0]) => void;
  onExportXlsx: (payload: Parameters<typeof import("@/lib/orderExport").downloadOrderXlsx>[0]) => void;
  onExportPdf: (payload: Parameters<typeof import("@/lib/orderExport").downloadOrderPdf>[0]) => void;
  onDelete: (id: string) => void;
};

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
}: AdminOrdersSectionProps) {
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
                {filteredOrders.length} pedido(s)
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
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background p-8 text-center text-muted-foreground">
          Nenhum pedido encontrado com esse filtro.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
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
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
