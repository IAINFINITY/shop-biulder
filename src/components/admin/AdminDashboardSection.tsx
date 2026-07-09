import { CreditCard, ImageIcon, Package, ShoppingBag, TrendingUp, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL, coercePrice } from "@/lib/formatMoney";
import { getProductImageUrls } from "@/lib/products";
import { formatCnpjDisplay } from "@/lib/brazilianIds";
import { AdminStatCard } from "./AdminStatCard";
import type { AdminCustomerSummary, AdminDashboardOrder, AdminProduct } from "./adminTypes";
import type { CustomerProfile } from "@/lib/customerProfile";

type AdminDashboardSectionProps = {
  products: AdminProduct[];
  recentOrders: AdminDashboardOrder[];
  customerSummaries: AdminCustomerSummary[];
  activeProductsCount: number;
  inactiveProductsCount: number;
  pendingOrdersCount: number;
  totalRevenue: number;
  averageOrderValue: number;
  customersWithOrdersCount: number;
  customersWithoutOrdersCount: number;
  recentCustomers: CustomerProfile[];
  formatDate: (value: string) => string;
  onGoToOrders: () => void;
  onGoToProducts: () => void;
};

export function AdminDashboardSection({
  products,
  recentOrders,
  customerSummaries,
  activeProductsCount,
  inactiveProductsCount,
  pendingOrdersCount,
  totalRevenue,
  averageOrderValue,
  customersWithOrdersCount,
  customersWithoutOrdersCount,
  recentCustomers,
  formatDate,
  onGoToOrders,
  onGoToProducts,
}: AdminDashboardSectionProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 gap-y-4 md:grid-cols-2 xl:grid-cols-6">
        <AdminStatCard
          icon={Package}
          label="Produtos ativos"
          value={String(activeProductsCount)}
          tone="primary"
          note={`${products.length} produto(s) no total`}
        />
        <AdminStatCard
          icon={UserCheck}
          label="Clientes com pedidos"
          value={String(customersWithOrdersCount)}
          tone="success"
          note={`${customerSummaries.length} cliente(s) na base`}
        />
        <AdminStatCard
          icon={ShoppingBag}
          label="Pedidos recebidos"
          value={String(recentOrders.length)}
          tone="success"
          note={`${pendingOrdersCount} em andamento`}
        />
        <AdminStatCard
          icon={Users}
          label="Clientes sem pedidos"
          value={String(customersWithoutOrdersCount)}
          tone="muted"
          note="Cadastros ainda sem movimentação"
        />
        <AdminStatCard
          icon={CreditCard}
          label="Receita total"
          value={formatBRL(totalRevenue)}
          tone="warn"
          note="Valor consolidado dos pedidos"
        />
        <AdminStatCard
          icon={TrendingUp}
          label="Ticket médio"
          value={formatBRL(averageOrderValue)}
          tone="primary"
          note={`${inactiveProductsCount} produto(s) inativos`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pedidos recentes</p>
              <p className="text-sm text-foreground">Acompanhe a operação sem sair da visão geral</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-9 rounded-full px-3 text-sm text-primary hover:bg-primary/5 hover:text-primary"
              onClick={onGoToOrders}
            >
              Ver todos
            </Button>
          </div>
          <div className="space-y-3 lg:hidden">
            {recentOrders.map((order) => {
              const total = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
              const shortOrderId = order.id.length > 10 ? `#${order.id.slice(0, 8)}…` : `#${order.id}`;

              return (
                <div
                  key={order.id}
                  className="rounded-[1.1rem] border border-border/70 bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate font-mono text-[13px] text-foreground" title={`Pedido ${order.id}`}>
                        {shortOrderId}
                      </p>
                      <p className="truncate text-[14px] font-medium text-foreground" title={order.customer_company || order.customer_name}>
                        {order.customer_company || order.customer_name}
                      </p>
                    </div>
                    <Badge
                      variant={order.status === "Entregue" ? "default" : order.status === "Cancelado" ? "destructive" : "secondary"}
                      className="rounded-full px-2.5 py-0.5 text-[11px]"
                    >
                      {order.status}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                    <div className="rounded-2xl bg-muted/20 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Data</p>
                      <p className="mt-1 text-foreground">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="rounded-2xl bg-muted/20 px-3 py-2 text-right">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Valor</p>
                      <p className="mt-1 font-mono text-foreground">{formatBRL(total)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-[1.25rem] border border-border/70 lg:block">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead className="bg-muted/30 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="w-[21%] whitespace-nowrap px-4 py-3 text-left font-semibold">Pedido</th>
                  <th className="w-[29%] whitespace-nowrap px-4 py-3 text-left font-semibold">Cliente</th>
                  <th className="w-[21%] whitespace-nowrap px-4 py-3 text-left font-semibold">Data</th>
                  <th className="w-[13%] whitespace-nowrap px-4 py-3 text-right font-semibold">Valor</th>
                  <th className="w-[16%] whitespace-nowrap px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => {
                  const total = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
                  const shortOrderId = order.id.length > 10 ? `#${order.id.slice(0, 8)}…` : `#${order.id}`;
                  return (
                    <tr key={order.id} className="border-t border-border/60 hover:bg-muted/20">
                      <td className="truncate px-4 py-3 font-mono text-sm text-foreground" title={`Pedido ${order.id}`}>
                        {shortOrderId}
                      </td>
                      <td className="truncate px-4 py-3 text-foreground" title={order.customer_company || order.customer_name}>
                        {order.customer_company || order.customer_name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(order.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-foreground">{formatBRL(total)}</td>
                      <td className="whitespace-nowrap px-4 py-3 pr-4">
                        <Badge
                          variant={order.status === "Entregue" ? "default" : order.status === "Cancelado" ? "destructive" : "secondary"}
                          className="inline-flex min-w-[7.75rem] max-w-full justify-center rounded-full px-3 py-1 text-[10px] leading-none"
                        >
                          {order.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Produtos</p>
              <p className="text-sm text-foreground">Resumo rápido dos itens mais recentes</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-9 rounded-full px-3 text-sm text-primary hover:bg-primary/5 hover:text-primary"
              onClick={onGoToProducts}
            >
              Gerenciar
            </Button>
          </div>
          <div className="space-y-3">
            {products.slice(0, 5).map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 rounded-[1.1rem] border border-border/70 bg-card p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background">
                  {getProductImageUrls(product)[0] ? (
                    <img src={getProductImageUrls(product)[0]} alt={product.name} className="h-full w-full object-contain p-1" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground/35" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-primary">
                      {product.type}
                    </Badge>
                    <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
                      {product.family}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-[15px] font-medium text-foreground">{product.name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[13px] text-foreground">{formatBRL(coercePrice(product.price))}</p>
                  <Badge variant={product.active ? "secondary" : "destructive"} className="mt-1 rounded-full px-2.5 py-0.5 text-[11px]">
                    {product.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Clientes recentes</p>
            <p className="text-sm text-foreground">Cadastros que acabaram de entrar no sistema</p>
          </div>
          <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1 text-[11px] font-medium">
            {recentCustomers.length} registro(s)
          </Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {recentCustomers.map((customer) => (
            <div
              key={customer.user_id}
              className="flex h-full flex-col rounded-[1.1rem] border border-border/70 bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-[15px] font-semibold text-foreground">{customer.name}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{customer.company || "Sem empresa vinculada"}</p>
                </div>
                <Badge variant="secondary" className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px]">
                  {customer.proxis_found ? "Proxsys ok" : "Sem vínculo"}
                </Badge>
              </div>
              <div className="mt-4 space-y-1 text-[12px] leading-5 text-muted-foreground">
                <p className="break-words">CNPJ {formatCnpjDisplay(customer.cnpj)}</p>
                <p>{formatDate(customer.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
