import { useMemo, useRef, useState } from "react";
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
import { AdminPaginacao } from "./AdminPaginacao";
import { AdminListaPadrao } from "./AdminListaPadrao";
import { AdminOrderDetail } from "./AdminOrderDetail";
import { useEtapaNaUrl } from "@/hooks/useFiltroNaUrl";
import { paginar } from "@/lib/paginacao";
import { needsProxisReconciliation } from "@/lib/proxisOrderStatus";
import { ehFuncionario, TIPO_FUNCIONARIO } from "@/lib/funcionario";
import { customerTypeLabel, normalizeCustomerType } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/shared/SectionHeader";
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
  onExportProxis: (payload: OrderExportInput) => void | Promise<void>;
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

/**
 * O balde de quem pediu sem ter conta.
 *
 * Escondê-los faria a soma dos filtros não bater com o total da lista — e são 10
 * dos 44 pedidos. "Sem cadastro" também é uma resposta útil para quem atende:
 * é o pedido que não dá para rastrear pela conta.
 */
const SEM_CADASTRO = "__sem_cadastro__";

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

  /**
   * O tipo de conta de quem fez cada pedido.
   *
   * Chaveado por `user_id` **e** por CNPJ, como o mapa de tabela acima: o pedido
   * de funcionário sai com o CNPJ da Clinic+, e o de visitante pode não ter
   * `user_id`. Duas chaves cobrem os dois caminhos.
   */
  const tipoDaContaPorChave = useMemo(() => {
    const map = new Map<string, string>();
    for (const profile of customerProfiles) {
      const tipo = ehFuncionario(profile) ? TIPO_FUNCIONARIO : normalizeCustomerType(profile.customer_type);
      const userKey = profile.user_id?.trim();
      const cnpjKey = String(profile.cnpj ?? "").replace(/\D/g, "");
      if (userKey) map.set(userKey, tipo);
      // O CNPJ não desempata funcionário: são 97 contas com o mesmo CNPJ da
      // Clinic+. Só entra quando ainda não há nada, para não sobrescrever o
      // que veio pelo `user_id`, que é exato.
      if (cnpjKey && !map.has(cnpjKey)) map.set(cnpjKey, tipo);
    }
    return map;
  }, [customerProfiles]);

  const tipoDoPedido = useMemo(
    () => (order: AdminOrderRow) => {
      const porUsuario = order.customer_user_id ? tipoDaContaPorChave.get(order.customer_user_id.trim()) : undefined;
      if (porUsuario) return porUsuario;
      const cnpj = String(order.customer_cnpj ?? "").replace(/\D/g, "");
      return (cnpj && tipoDaContaPorChave.get(cnpj)) || null;
    },
    [tipoDaContaPorChave],
  );

  const [filtroDeTipo, setFiltroDeTipo] = useState<string | null>(null);

  /**
   * O pedido aberto vive na URL, como a tabela em Preços.
   *
   * Assim o botão "voltar" do navegador fecha o detalhe em vez de sair da seção,
   * e o endereço do pedido pode ser mandado para alguém — que é o pedido mais
   * comum de quem atende ("dá uma olhada nesse aqui").
   */
  const [pedidoAberto, definirPedidoAberto] = useEtapaNaUrl("pedido");

  /**
   * Só os tipos que têm pedido, com a contagem.
   *
   * Listar os quatro tipos sempre daria botões que filtram para nada — e a
   * pessoa clicaria neles antes de descobrir. A barra some inteira quando só há
   * um tipo, porque aí não há o que separar.
   */
  const tiposComPedido = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const order of filteredOrders) {
      // Sem cadastro é um balde de verdade, não um buraco: são 10 dos 44
      // pedidos, feitos por quem comprou sem conta. Descartá-los faria as
      // contagens não fecharem com o total da lista.
      const tipo = tipoDoPedido(order) ?? SEM_CADASTRO;
      contagem.set(tipo, (contagem.get(tipo) ?? 0) + 1);
    }
    return [...contagem.entries()]
      .map(([tipo, quantidade]) => ({ tipo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [filteredOrders, tipoDoPedido]);

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
    const porTipo = filtroDeTipo
      ? byErp.filter((order) => (tipoDoPedido(order) ?? SEM_CADASTRO) === filtroDeTipo)
      : byErp;
    if (statusFilter === "all") return porTipo;
    return porTipo.filter((order) => normalizarStatusDoPedido(order.status) === statusFilter);
  }, [filteredOrders, onlyPendingErp, statusFilter, filtroDeTipo, tipoDoPedido]);

  const [pagina, setPagina] = useState(0);
  /** A lista de pedidos só cresce; sem paginar, todo pedido já feito era montado. */
  const paginaDePedidos = useMemo(() => paginar(visibleOrders, pagina), [visibleOrders, pagina]);

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

  const detalhe = useMemo(() => {
    if (!pedidoAberto) return null;
    const indice = visibleOrders.findIndex((order) => order.id === pedidoAberto);
    // Pedido que não está na lista atual — filtro mudou, link antigo — volta
    // para a lista em vez de mostrar tela vazia.
    if (indice === -1) return null;
    return {
      order: visibleOrders[indice],
      lines: parseOrderTableLines(visibleOrders[indice].items, orderEnrichment),
      numero: visibleOrders.length - indice,
    };
  }, [pedidoAberto, visibleOrders, orderEnrichment]);

  if (detalhe) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <SectionHeader
          eyebrow="Pedidos"
          title="Detalhe do pedido"
          description="Tudo o que foi pedido, para onde vai, e por onde este pedido passou."
          actions={null}
        />
        <AdminOrderDetail
          order={detalhe.order}
          lines={detalhe.lines}
          numeroDoPedido={detalhe.numero}
          onVoltar={() => definirPedidoAberto(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-3 sm:space-y-4">
        <SectionHeader
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
      </div>

      <AdminListaPadrao
        busca={orderSearch}
        onBuscaChange={onOrderSearchChange}
        buscaPlaceholder="Buscar por nome, empresa, telefone, CNPJ, status ou observação"
        contagem={visibleOrders.length}
        filtros={
          <>
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Quem pediu
            </span>
            <Button
              type="button"
              variant={filtroDeTipo === null ? "default" : "outline"}
              className="h-9 rounded-full px-3 text-xs"
              onClick={() => setFiltroDeTipo(null)}
            >
              Todos
            </Button>
            {tiposComPedido.map(({ tipo, quantidade }) => (
              <Button
                key={tipo}
                type="button"
                variant={filtroDeTipo === tipo ? "default" : "outline"}
                className="h-9 rounded-full px-3 text-xs"
                onClick={() => setFiltroDeTipo(filtroDeTipo === tipo ? null : tipo)}
              >
                {tipo === SEM_CADASTRO ? "Sem cadastro" : customerTypeLabel(tipo)}
                <Badge variant="secondary" className="ml-1.5 rounded-full px-1.5 py-0 text-[0.625rem] leading-none">
                  {quantidade}
                </Badge>
              </Button>
            ))}
          </>
        }
        abas={
          <>

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
          </>
        }
        filtroAplicado={
          visibleOrders.length > 0 ? (
            <div className="rounded-[1.25rem] border border-border/70 bg-primary/5 px-3 py-2 text-[0.8125rem] leading-6 text-foreground sm:px-4">
              <span className="font-semibold">{visibleOrders.length} pedido(s)</span> no filtro atual · Total:{" "}
              <span className="font-semibold">{formatBRL(summaryTotal)}</span>
            </div>
          ) : null
        }
        rodape={<AdminPaginacao pagina={paginaDePedidos} onMudarPagina={setPagina} />}
      >

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
              ? "Nenhum pedido pendente com os filtros atuais."
              : statusFilter !== "all"
                ? "Nenhum pedido com esse status no filtro atual. Tente outro status ou ajuste a busca."
                : orderSearch.trim()
                  ? "Nenhum pedido encontrado com esse termo. Tente outro termo de busca."
                  : "Ainda não há pedidos registrados no sistema."}
          </p>
        </div>
      ) : (
        <div className="scroll-mt-6 space-y-3">
          {paginaDePedidos.itens.map((order, index) => {
            // O número segue a posição na lista inteira, e não na página: na
            // página 2 a contagem recomeçaria e dois pedidos diferentes
            // apareceriam com o mesmo número.
            const displayOrderNumber = visibleOrders.length - (paginaDePedidos.primeiroItem - 1) - index;
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
              numeroDoPedido: displayOrderNumber,
              customer_address_cep: order.customer_address_cep ?? null,
              customer_address_street: order.customer_address_street ?? null,
              customer_address_number: order.customer_address_number ?? null,
              customer_address_complement: order.customer_address_complement ?? null,
              customer_address_neighborhood: order.customer_address_neighborhood ?? null,
              customer_address_city: order.customer_address_city ?? null,
              customer_address_state: order.customer_address_state ?? null,
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
                onExportProxis={() => onExportProxis(exportPayload)}
                onExportXlsx={() => onExportXlsx(exportPayload)}
                onExportPdf={() => onExportPdf(exportPayload)}
                onDelete={() => onDelete(order.id)}
                onStatusChange={onStatusChange}
                onAbrirDetalhe={() => definirPedidoAberto(order.id)}
              />
            );
          })}
        </div>
      )}

      </AdminListaPadrao>
    </div>
  );
}
