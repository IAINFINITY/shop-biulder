import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-6">
      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <AdminSectionHeader
          eyebrow="Pedidos"
          title="Operação diária"
          description="Filtre pedidos por cliente, empresa, telefone, CNPJ ou status."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[11px] text-primary">
                {ordersLoading ? "Carregando" : `${filteredOrders.length} pedido(s)`}
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
                {pendingOrdersCount} em andamento
              </Badge>
            </div>
          }
        />

        <div className="mt-4">
          <Input
            placeholder="Pesquisar pedido (nome, empresa, telefone, CNPJ, status)"
            value={orderSearch}
            onChange={(e) => onOrderSearchChange(e.target.value)}
            className="h-11 rounded-2xl border-border/70 bg-background text-[13px]"
          />
        </div>
      </div>

      {ordersLoading ? (
        <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background p-8 text-center text-muted-foreground">
          Carregando pedidos...
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
            const exportPayload = {
              id: order.id,
              created_at: order.created_at,
              customer_name: order.customer_name,
              customer_company: order.customer_company,
              customer_phone: order.customer_phone,
              customer_cnpj: order.customer_cnpj,
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
