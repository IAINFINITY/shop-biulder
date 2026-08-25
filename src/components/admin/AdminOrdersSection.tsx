import { useMemo, useState } from "react";
import { AlertTriangle, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { CustomerProfile } from "@/lib/customerProfile";
import {
  ESTADOS_DO_PEDIDO,
  ROTULOS_PLURAL,
  normalizarStatusDoPedido,
  type StatusDoPedido,
} from "@/lib/statusDoPedido";
import { OrderAdminCard } from "@/components/admin/OrderAdminCard";
import { getOrderLinesGrandTotal, getOrderLinesQuantityTotal, parseOrderTableLines } from "@/lib/orders";
import { formatBRL } from "@/lib/formatMoney";
import type { OrderExportInput } from "@/lib/orderExportTypes";
import type { ProxisOrderRequest } from "@/lib/proxisOrder";
import { needsProxisReconciliation } from "@/lib/proxisOrderStatus";
import { cn } from "@/lib/utils";
import { AdminSectionHeader } from "./AdminSectionHeader";
import type { AdminOrderRow } from "./adminTypes";

type OrderEnrichmentMaps = Parameters<typeof parseOrderTableLines>[1];
type ProxisResendPayload = ProxisOrderRequest & { id: string };

type AdminOrdersSectionProps = {
  ordersLoading: boolean;
  filteredOrders: AdminOrderRow[];
  orderSearch: string;
  onOrderSearchChange: (value: string) => void;
  pendingOrdersCount: number;
  orderEnrichment: OrderEnrichmentMaps;
  formatDate: (value: string) => string;
  proxisExportingId: string | null;
  proxisResendingId: string | null;
  onExportProxis: (payload: OrderExportInput) => void | Promise<void>;
  onResendProxis: (payload: ProxisResendPayload) => void | Promise<void>;
  onExportXlsx: (payload: OrderExportInput) => void | Promise<void>;
  onExportPdf: (payload: OrderExportInput) => void | Promise<void>;
  onDelete: (id: string) => void;
  onStatusChange?: (orderId: string, status: string) => void;
  customerProfiles: CustomerProfile[];
};

// As abas saem dos estados, e nao de uma lista propria.
//
// A versao anterior tinha um `statusFilterKey` local com uma gaveta `outros` que
// **nenhuma aba mostrava**: um status fora do esperado sumia de todas as abas
// menos "Todos". E faltava "Novo" — pedido recem-chegado e pedido ja sendo
// separado caiam na mesma aba, e a fila deixava de dizer o que falta fazer.
const STATUS_FILTERS = [
  { id: "all" as const, label: "Todos" },
  ...ESTADOS_DO_PEDIDO.map((estado) => ({ id: estado, label: ROTULOS_PLURAL[estado] })),
];

type StatusFilterId = StatusDoPedido | "all";

export function AdminOrdersSection({
  ordersLoading,
  filteredOrders,
  orderSearch,
  onOrderSearchChange,
  pendingOrdersCount,
  orderEnrichment,
  formatDate,
  proxisExportingId,
  proxisResendingId,
  onExportProxis,
  onResendProxis,
  onExportXlsx,
  onExportPdf,
  onDelete,
  onStatusChange,
  customerProfiles,
}: AdminOrdersSectionProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilterId>("all");
  // Dimensao independente do status comercial: um pedido "Entregue" tambem pode
  // nunca ter chegado ao ERP.
  const [onlyPendingErp, setOnlyPendingErp] = useState(false);

  const pendingErpCount = useMemo(
    () => filteredOrders.filter((order) => needsProxisReconciliation(order.proxis_status)).length,
    [filteredOrders],
  );

  const customerTprByKey = useMemo(() => {
    const map = new Map<string, number>();

    for (const profile of customerProfiles) {
      const tprId = Number(profile.proxis_tpr_id);
      if (!Number.isFinite(tprId) || tprId <= 0) continue;

      const normalizedTprId = Math.trunc(tprId);
      const userKey = profile.user_id.trim();
      const cnpjKey = String(profile.cnpj ?? "").replace(/\D/g, "");

      if (userKey) map.set(userKey, normalizedTprId);
      if (cnpjKey) map.set(cnpjKey, normalizedTprId);
    }

    return map;
  }, [customerProfiles]);

  const statusCounts = useMemo(() => {
    // Zerado a partir dos estados, e nao escrito a mao: a versao anterior
    // listava as chaves aqui, e acrescentar um estado deixava a contagem dele
    // silenciosamente fora — a aba apareceria sempre com zero.
    const counts = { all: filteredOrders.length } as Record<StatusFilterId, number>;
    for (const estado of ESTADOS_DO_PEDIDO) counts[estado] = 0;
    for (const order of filteredOrders) counts[normalizarStatusDoPedido(order.status)] += 1;
    return counts;
  }, [filteredOrders]);

  const visibleOrders = useMemo(() => {
    const byErp = onlyPendingErp
      ? filteredOrders.filter((order) => needsProxisReconciliation(order.proxis_status))
      : filteredOrders;
    if (statusFilter === "all") return byErp;
    return byErp.filter((order) => normalizarStatusDoPedido(order.status) === statusFilter);
  }, [filteredOrders, onlyPendingErp, statusFilter]);

  const summaryTotal = useMemo(() => {
    let total = 0;
    for (const order of visibleOrders) {
      const lines = parseOrderTableLines(order.items, orderEnrichment);
      total += getOrderLinesGrandTotal(lines);
    }
    return Math.round(total * 100) / 100;
  }, [visibleOrders, orderEnrichment]);

  function normalizeAddressPayload(order: AdminOrderRow): ProxisOrderRequest["address"] {
    return {
      cep: String(order.customer_address_cep ?? ""),
      street: String(order.customer_address_street ?? ""),
      number: String(order.customer_address_number ?? ""),
      complement: String(order.customer_address_complement ?? ""),
      neighborhood: String(order.customer_address_neighborhood ?? ""),
      city: String(order.customer_address_city ?? ""),
      state: String(order.customer_address_state ?? ""),
      ibge: String(order.customer_address_ibge ?? ""),
    };
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-3 sm:space-y-4">
        <AdminSectionHeader
          eyebrow="Pedidos"
          title="Operação diária"
          description="Filtre pedidos por cliente, empresa, telefone, CNPJ ou status."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[0.6875rem] text-primary">
                {visibleOrders.length} pedido(s)
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-[0.6875rem]">
                {pendingOrdersCount} em andamento
              </Badge>
              {pendingErpCount > 0 ? (
                <Badge className="gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[0.6875rem] font-medium text-amber-800">
                  <AlertTriangle className="h-3 w-3" />
                  {pendingErpCount} fora do ERP
                </Badge>
              ) : null}
            </div>
          }
        />
        <Input
          placeholder="Pesquisar pedido (nome, empresa, telefone, CNPJ, status, observação)"
          value={orderSearch}
          onChange={(e) => onOrderSearchChange(e.target.value)}
          className="h-11 rounded-2xl border-border/70 bg-background text-[0.8125rem]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter.id}
            type="button"
            variant={statusFilter === filter.id ? "default" : "outline"}
            className="h-10 sm:h-9 rounded-full px-3 text-[0.8125rem] sm:text-xs"
            onClick={() => setStatusFilter(filter.id)}
          >
            {filter.label}
            <Badge variant="secondary" className="ml-1.5 rounded-full px-1.5 py-0 text-[0.625rem] leading-none">
              {statusCounts[filter.id]}
            </Badge>
          </Button>
        ))}

        <Button
          type="button"
          variant={onlyPendingErp ? "default" : "outline"}
          className={cn(
            "h-10 gap-1 rounded-full px-3 text-[0.8125rem] sm:h-9 sm:text-xs",
            !onlyPendingErp && pendingErpCount > 0 && "border-amber-300 text-amber-800 hover:bg-amber-50",
          )}
          onClick={() => setOnlyPendingErp((value) => !value)}
          disabled={pendingErpCount === 0 && !onlyPendingErp}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Pendentes no ERP
          <Badge variant="secondary" className="ml-1.5 rounded-full px-1.5 py-0 text-[0.625rem] leading-none">
            {pendingErpCount}
          </Badge>
        </Button>
      </div>

      {visibleOrders.length > 0 && (
        <div className="rounded-[1.25rem] border border-border/70 bg-primary/5 px-3 sm:px-4 py-3 text-xs sm:text-[0.8125rem] leading-5 sm:leading-6 text-foreground">
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
          <p className="mt-4 text-sm font-semibold text-foreground">Nenhum pedido encontrado</p>
          <p className="mt-1 text-[0.8125rem] leading-6 text-muted-foreground">
            {onlyPendingErp
              ? "Nenhum pedido pendente no ERP com os filtros atuais. Tudo que passou por aqui chegou ao Proxis."
              : statusFilter !== "all"
                ? "Nenhum pedido com esse status no filtro atual. Tente outro status ou ajuste a busca."
                : orderSearch.trim()
                  ? "Nenhum pedido encontrado com esse termo. Tente outro termo de busca."
                  : "Ainda não há pedidos registrados no sistema."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleOrders.map((order, index) => {
            const displayOrderNumber = visibleOrders.length - index;
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
              customer_tpr_id: (() => {
                const userId = typeof order.customer_user_id === "string" ? order.customer_user_id.trim() : "";
                if (userId && customerTprByKey.has(userId)) return customerTprByKey.get(userId) ?? null;

                const cnpj = typeof order.customer_cnpj === "string" ? order.customer_cnpj.replace(/\D/g, "") : "";
                if (cnpj && customerTprByKey.has(cnpj)) return customerTprByKey.get(cnpj) ?? null;

                return null;
              })(),
              customer_observation: customerObservation || null,
              status: order.status,
              items: order.items,
              proxis_import_id: order.proxis_import_id,
              enrichmentMaps: orderEnrichment,
            } as const;
            const resendPayload: ProxisResendPayload = {
              id: order.id,
              // Reaproveitar a chave faz o reenvio reivindicar o mesmo documento
              // no ERP, entao apertar o botao de novo nunca cria um segundo pedido.
              submission_key: order.submission_key ?? null,
              customer_name: order.customer_name,
              customer_cnpj: order.customer_cnpj ?? "",
              customer_company: order.customer_company || order.customer_name,
              customer_observation: customerObservation || null,
              address: normalizeAddressPayload(order),
              items: lines.map((line) => ({
                product_code: line.code === "—" ? "" : line.code,
                quantity: line.quantity,
                unit_price: line.unitPrice,
                name: line.name,
              })),
              note: customerObservation || "Pedido reenviado pelo admin.",
            };

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
                  proxis_status: order.proxis_status,
                  proxis_error: order.proxis_error,
                  proxis_doc_ped_web: order.proxis_doc_ped_web,
                  proxis_attempts: order.proxis_attempts,
                  proxis_last_attempt_at: order.proxis_last_attempt_at,
                  items: order.items,
                }}
                displayOrderNumber={displayOrderNumber}
                lines={lines}
                orderTotal={orderTotal}
                orderQty={orderQty}
                formatDate={formatDate}
                isProxisExporting={proxisExportingId === order.id}
                isProxisResending={proxisResendingId === order.id}
                onExportProxis={() => onExportProxis(exportPayload)}
                onResendProxis={() => onResendProxis(resendPayload)}
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
