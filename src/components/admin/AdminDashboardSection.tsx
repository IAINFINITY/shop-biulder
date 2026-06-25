import { CreditCard, ImageIcon, Package, ShoppingBag, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL, coercePrice } from "@/lib/formatMoney";
import { getProductImageUrls } from "@/lib/products";
import { AdminStatCard } from "./AdminStatCard";
import type { AdminCustomerSummary, AdminDashboardOrder, AdminProduct } from "./adminTypes";

type AdminDashboardSectionProps = {
  products: AdminProduct[];
  recentOrders: AdminDashboardOrder[];
  customerSummaries: AdminCustomerSummary[];
  activeProductsCount: number;
  pendingOrdersCount: number;
  totalRevenue: number;
  formatDate: (value: string) => string;
  onGoToOrders: () => void;
  onGoToProducts: () => void;
};

export function AdminDashboardSection({
  products,
  recentOrders,
  customerSummaries,
  activeProductsCount,
  pendingOrdersCount,
  totalRevenue,
  formatDate,
  onGoToOrders,
  onGoToProducts,
}: AdminDashboardSectionProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          icon={Package}
          label="Produtos ativos"
          value={String(activeProductsCount)}
          tone="primary"
          note={`${products.length} produto(s) no total`}
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
          label="Clientes ativos"
          value={String(customerSummaries.length)}
          tone="muted"
          note="Base consolidada por CNPJ"
        />
        <AdminStatCard
          icon={CreditCard}
          label="Receita total"
          value={formatBRL(totalRevenue)}
          tone="warn"
          note="Valor consolidado dos pedidos"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pedidos recentes</p>
              <p className="text-sm text-foreground">Acompanhe a operação sem sair da visão geral</p>
            </div>
            <Button type="button" variant="ghost" className="h-9 rounded-full px-3 text-sm text-primary hover:bg-primary/5 hover:text-primary" onClick={onGoToOrders}>
              Ver todos
            </Button>
          </div>
          <div className="overflow-hidden rounded-[1.25rem] border border-border/70">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/30 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Pedido</th>
                  <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-left font-semibold">Data</th>
                  <th className="px-4 py-3 text-right font-semibold">Valor</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => {
                  const total = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
                  return (
                    <tr key={order.id} className="border-t border-border/60 hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-sm text-foreground">#{order.id}</td>
                      <td className="px-4 py-3 text-foreground">{order.customer_company || order.customer_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(order.created_at)}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{formatBRL(total)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={order.status === "Entregue" ? "default" : order.status === "Cancelado" ? "destructive" : "secondary"} className="rounded-full px-2.5 py-0.5 text-[11px]">
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
            <Button type="button" variant="ghost" className="h-9 rounded-full px-3 text-sm text-primary hover:bg-primary/5 hover:text-primary" onClick={onGoToProducts}>
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
                  <p className="truncate text-[15px] font-medium text-foreground">{product.name}</p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {product.type} · {product.family}
                  </p>
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
    </div>
  );
}
