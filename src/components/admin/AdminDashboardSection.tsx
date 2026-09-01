import {
  Bell,
  CreditCard,
  CalendarClock,
  ImageIcon,
  MessageSquareText,
  Package,
  ShoppingBag,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL, coercePrice } from "@/lib/formatMoney";
import { getProductImageUrls } from "@/lib/products";
import { formatDocumentId } from "@/lib/brazilianIds";
import { AdminStatCard } from "./AdminStatCard";
import { AdminDashboardItem } from "./AdminDashboardItem";
import { saudacao } from "@/lib/saudacao";
import type { AdminCustomerSummary, AdminDashboardOrder, AdminOrderRow, AdminProduct } from "./adminTypes";
import type { CustomerProfile } from "@/lib/customerProfile";
import type { CatalogBanner } from "@/lib/catalogBanners";
import type { CatalogNotification } from "@/lib/catalogNotifications";

type AdminDashboardSectionProps = {
  products: AdminProduct[];
  recentOrders: AdminDashboardOrder[];
  customerSummaries: AdminCustomerSummary[];
  notifications: CatalogNotification[];
  banners: CatalogBanner[];
  customerProfiles: CustomerProfile[];
  recentEmployees: CustomerProfile[];
  orderRows: AdminOrderRow[];
  activeProductsCount: number;
  inactiveProductsCount: number;
  newUsersCount: number;
  openConversationsCount: number;
  sentNotificationsCount: number;
  createdBannersCount: number;
  pendingOrdersCount: number;
  totalRevenue: number;
  averageOrderValue: number;
  customersWithOrdersCount: number;
  customersWithoutOrdersCount: number;
  recentCustomers: CustomerProfile[];
  formatDate: (value: string) => string;
  onGoToOrders: () => void;
  onGoToProducts: () => void;
  /**
   * Abre **este** produto, e nao a lista inteira.
   *
   * Os cinco itens do resumo chamavam `onGoToProducts` — o mesmo callback do
   * botao "Gerenciar" ao lado. Clicar num produto especifico levava a lista
   * completa, sem nada indicando qual deles tinha sido clicado: o gesto mais
   * preciso da tela dava o resultado menos preciso.
   */
  onOpenProduct: (product: AdminProduct) => void;
  onGoToCustomers: () => void;
  /** Abre a base de clientes já filtrada nesta pessoa. */
  onGoToCustomer: (busca: string) => void;
  onGoToEmployees: () => void;
  /** Nome de quem está logado, para a saudação. Pode vir e-mail; `saudacao` trata. */
  nomeDoAdmin: string | null;
  onGoToMessages: () => void;
  onGoToNotifications: () => void;
  onGoToBanners: () => void;
};

/** "sábado, 31 de agosto" — situa o resumo no tempo sem pedir espaço de cartão. */
function dataPorExtenso(agora: Date = new Date()): string {
  const texto = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function AdminDashboardSection({
  products,
  recentOrders,
  customerSummaries,
  notifications,
  banners,
  customerProfiles,
  recentEmployees,
  orderRows,
  activeProductsCount,
  inactiveProductsCount,
  newUsersCount,
  openConversationsCount,
  sentNotificationsCount,
  createdBannersCount,
  pendingOrdersCount,
  totalRevenue,
  averageOrderValue,
  customersWithOrdersCount,
  customersWithoutOrdersCount,
  recentCustomers,
  formatDate,
  onGoToOrders,
  onGoToProducts,
  onOpenProduct,
  onGoToCustomers,
  onGoToCustomer,
  onGoToEmployees,
  nomeDoAdmin,
  onGoToMessages,
  onGoToNotifications,
  onGoToBanners,
}: AdminDashboardSectionProps) {
  const now = Date.now();

  const formatCompactDateTime = (value: string | null | undefined) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCompactDate = (value: string | null | undefined) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const isNotificationLive = (notification: CatalogNotification) => {
    if (!notification.active) return false;

    const startsAt = notification.starts_at ? new Date(notification.starts_at).getTime() : null;
    const endsAt = notification.ends_at ? new Date(notification.ends_at).getTime() : null;

    if (startsAt != null && Number.isFinite(startsAt) && startsAt > now) return false;
    if (endsAt != null && Number.isFinite(endsAt) && endsAt < now) return false;
    return true;
  };

  const liveNotifications = notifications.filter(isNotificationLive);
  const scheduledNotifications = notifications.filter((notification) => {
    if (!notification.active || !notification.starts_at) return false;
    const startsAt = new Date(notification.starts_at).getTime();
    return Number.isFinite(startsAt) && startsAt > now;
  });
  const targetedNotifications = notifications.filter((notification) => Boolean(notification.target_user_id));
  const activeBanners = banners.filter((banner) => banner.active);
  const targetedBanners = banners.filter((banner) => Boolean(banner.visible_to && banner.visible_to.length > 0));
  const exportedOrders = orderRows.filter((order) => order.proxis_import_id != null);
  const pendingProxisOrders = Math.max(0, orderRows.length - exportedOrders.length);
  const linkedCustomers = customerProfiles.filter((profile) => profile.proxis_found);
  const unlinkedCustomers = customerProfiles.filter((profile) => !profile.proxis_found);
  const recentSyncCount = customerProfiles.filter((profile) => {
    if (!profile.proxis_synced_at) return false;
    const syncedAt = new Date(profile.proxis_synced_at).getTime();
    return Number.isFinite(syncedAt) && now - syncedAt <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  const recentlySyncedCustomers = [...customerProfiles]
    .filter((profile) => Boolean(profile.proxis_synced_at))
    .sort((a, b) => new Date(b.proxis_synced_at ?? 0).getTime() - new Date(a.proxis_synced_at ?? 0).getTime())
    .slice(0, 4);
  const latestNotifications = [...notifications]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);
  const latestBanners = [...banners]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* A saudação é a primeira coisa da tela por um motivo simples: o painel
          abria direto num paredão de dez números, sem nada dizendo de quem é
          aquilo. É o mesmo recurso dos dois CRMs de referência. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {saudacao(nomeDoAdmin)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {dataPorExtenso()} · veja como o catálogo está hoje
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 gap-y-4 md:grid-cols-2 xl:grid-cols-6">
        <AdminStatCard
          icon={Package}
          label="Produtos ativos"
          value={activeProductsCount}
          tone="primary"
          note={`${products.length} produto(s) no total`}
          onClick={onGoToProducts}
          acaoLabel="abrir a lista de produtos"
        />
        <AdminStatCard
          icon={UserCheck}
          label="Clientes com pedidos"
          value={customersWithOrdersCount}
          tone="success"
          note={`${customerSummaries.length} cliente(s) na base`}
          onClick={onGoToCustomers}
          acaoLabel="abrir a base de clientes"
        />
        <AdminStatCard
          icon={ShoppingBag}
          label="Pedidos recebidos"
          value={recentOrders.length}
          tone="success"
          note={`${pendingOrdersCount} em andamento`}
          onClick={onGoToOrders}
          acaoLabel="abrir os pedidos"
        />
        <AdminStatCard
          icon={Users}
          label="Clientes sem pedidos"
          value={customersWithoutOrdersCount}
          tone="muted"
          note="Cadastros ainda sem movimentação"
          onClick={onGoToCustomers}
          acaoLabel="abrir a base de clientes"
        />
        <AdminStatCard
          icon={CreditCard}
          label="Receita total"
          value={totalRevenue}
          formatar={formatBRL}
          tone="warn"
          note="Valor consolidado dos pedidos"
          onClick={onGoToOrders}
          acaoLabel="abrir os pedidos"
        />
        <AdminStatCard
          icon={TrendingUp}
          label="Ticket médio"
          value={averageOrderValue}
          formatar={formatBRL}
          tone="primary"
          note={`${inactiveProductsCount} produto(s) inativos`}
          onClick={onGoToOrders}
          acaoLabel="abrir os pedidos"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          icon={UserPlus}
          label="Usuários novos"
          value={newUsersCount}
          tone="success"
          note="Últimos 7 dias"
          onClick={onGoToCustomers}
          acaoLabel="abrir a base de clientes"
        />
        <AdminStatCard
          icon={MessageSquareText}
          label="Conversas abertas"
          value={openConversationsCount}
          tone="primary"
          note="Chat interno ativo"
          onClick={onGoToMessages}
          acaoLabel="abrir as mensagens"
        />
        <AdminStatCard
          icon={Bell}
          label="Notificações enviadas"
          value={sentNotificationsCount}
          tone="warn"
          note="Campanhas e avisos"
          onClick={onGoToNotifications}
          acaoLabel="abrir as notificações"
        />
        <AdminStatCard
          icon={ImageIcon}
          label="Banners criados"
          value={createdBannersCount}
          tone="muted"
          note="Hero do catálogo"
          onClick={onGoToBanners}
          acaoLabel="abrir os banners"
        />
      </div>

      <div className="min-w-0 rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)] h-full">
        <div className="mb-4 flex items-center justify-between gap-3 shrink-0">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pedidos recentes</p>
            <p className="text-sm text-foreground">Acompanhe a operação sem sair da visão geral</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-10 sm:h-9 rounded-full px-3 text-sm text-primary hover:bg-primary/5 hover:text-primary shrink-0"
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
                    <p className="truncate font-mono text-[0.8125rem] text-foreground" title={`Pedido ${order.id}`}>
                      {shortOrderId}
                    </p>
                    <p className="truncate text-sm font-medium text-foreground" title={order.customer_company || order.customer_name}>
                      {order.customer_company || order.customer_name}
                    </p>
                  </div>
                  <Badge
                    variant={order.status === "Entregue" ? "default" : order.status === "Cancelado" ? "destructive" : "secondary"}
                    className="rounded-full px-2.5 py-0.5 text-[0.6875rem]"
                  >
                    {order.status}
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-2xl bg-muted/20 px-3 py-2">
                    <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">Data</p>
                    <p className="mt-1 text-foreground">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="rounded-2xl bg-muted/20 px-3 py-2 text-right">
                    <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">Valor</p>
                    <p className="mt-1 font-mono text-foreground">{formatBRL(total)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex-1 hidden overflow-hidden rounded-[1.25rem] border border-border/70 lg:block">
          <table className="w-full table-fixed border-collapse text-sm h-full">
            <thead className="bg-muted/30 text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
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
                        className="inline-flex min-w-[7.75rem] max-w-full justify-center rounded-full px-3 py-1 text-[0.625rem] leading-none"
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

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0 rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Clientes recentes</p>
              <p className="text-sm text-foreground">Cadastros que acabaram de entrar no sistema</p>
            </div>
            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1 text-[0.6875rem] font-medium">
              {recentCustomers.length} registro(s)
            </Badge>
          </div>
          <div className="space-y-3">
            {recentCustomers.slice(0, 4).map((customer) => (
              <AdminDashboardItem
                key={customer.user_id}
                onClick={() => onGoToCustomer(customer.cnpj || customer.name || "")}
                acaoLabel={`Ver ${customer.name} na base de clientes`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-semibold text-foreground">{customer.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{customer.company || "Sem empresa vinculada"}</p>
                  <p className="break-words text-xs text-muted-foreground">Documento {formatDocumentId(customer.cnpj)}</p>
                </div>
                <Badge variant={customer.proxis_found ? "default" : "secondary"} className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6875rem]">
                  {customer.proxis_found ? "Vinculado" : "Sem vínculo"}
                </Badge>
              </AdminDashboardItem>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Funcionários recentes</p>
              <p className="text-sm text-foreground">Equipe vinculada à Clinic+</p>
            </div>
            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1 text-[0.6875rem] font-medium">
              {recentEmployees.length} registro(s)
            </Badge>
          </div>
          <div className="space-y-3">
            {recentEmployees.slice(0, 4).map((employee) => (
              <AdminDashboardItem
                key={employee.user_id}
                onClick={onGoToEmployees}
                acaoLabel={`Ver ${employee.name} na equipe`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-semibold text-foreground">{employee.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{employee.phone || "Sem telefone cadastrado"}</p>
                  <p className="break-words text-xs text-muted-foreground">Documento {formatDocumentId(employee.cnpj)}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    Vinculado a {employee.linked_company_cnpj ? formatDocumentId(employee.linked_company_cnpj) : "—"}
                  </p>
                </div>
                <Badge variant={employee.linked_company_cnpj ? "default" : "secondary"} className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6875rem]">
                  Funcionário
                </Badge>
              </AdminDashboardItem>
            ))}
          </div>
        </div>
      </div>

      <div className="min-w-0 rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Produtos</p>
            <p className="text-sm text-foreground">Resumo rápido dos itens mais recentes</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-10 sm:h-9 rounded-full px-3 text-sm text-primary hover:bg-primary/5 hover:text-primary"
            onClick={onGoToProducts}
          >
            Gerenciar
          </Button>
        </div>
        <div className="space-y-3">
          {products.slice(0, 5).map((product) => (
            <AdminDashboardItem
              key={product.id}
              onClick={() => onOpenProduct(product)}
              acaoLabel={`Abrir ${product.name}`}
              className="items-center"
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
                  <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-2 py-0.5 text-[0.625rem] text-primary">
                    {product.type}
                  </Badge>
                  <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[0.625rem]">
                    {product.family}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-sm font-medium text-foreground">{product.name}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-[0.8125rem] text-foreground">{formatBRL(coercePrice(product.price))}</p>
                <Badge variant={product.active ? "secondary" : "destructive"} className="mt-1 rounded-full px-2.5 py-0.5 text-[0.6875rem]">
                  {product.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </AdminDashboardItem>
          ))}
        </div>
      </div>

      <div className="min-w-0 rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Comunicação do catálogo</p>
            <p className="text-sm text-foreground">Notificações e banners publicados no mesmo padrão visual</p>
          </div>
          <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1 text-[0.6875rem] font-medium">
            {liveNotifications.length + activeBanners.length} ativos
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            icon={Bell}
            label="Notificações ativas"
            value={liveNotifications.length}
            tone="warn"
            note={`${scheduledNotifications.length} agendada(s)`}
            onClick={onGoToNotifications}
            acaoLabel="abrir as notificações"
          />
          <AdminStatCard
            icon={ImageIcon}
            label="Banners ativos"
            value={activeBanners.length}
            tone="primary"
            note={`${targetedBanners.length} com público definido`}
            onClick={onGoToBanners}
            acaoLabel="abrir os banners"
          />
          <AdminStatCard
            icon={MessageSquareText}
            label="Notificações segmentadas"
            value={targetedNotifications.length}
            tone="success"
            note="Enviadas para usuário específico"
            onClick={onGoToNotifications}
            acaoLabel="abrir as notificações"
          />
          <AdminStatCard
            icon={TrendingUp}
            label="Conteúdos publicados"
            value={liveNotifications.length + activeBanners.length}
            tone="muted"
            note="Campanhas e hero do catálogo"
            onClick={onGoToNotifications}
            acaoLabel="abrir as notificações"
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[1.25rem] border border-border/70 bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Últimas notificações</p>
                <p className="text-sm text-foreground">Resumo rápido do que foi publicado</p>
              </div>
              <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[0.6875rem]">
                {notifications.length} total
              </Badge>
            </div>

            <div className="space-y-3">
              {latestNotifications.length > 0 ? (
                latestNotifications.map((notification) => {
                  const live = isNotificationLive(notification);
                  const badgeLabel = !notification.active ? "Inativa" : live ? "Ativa" : "Agendada";
                  const badgeVariant = !notification.active ? "secondary" : live ? "default" : "outline";

                  return (
                    <AdminDashboardItem
                      key={notification.id}
                      onClick={onGoToNotifications}
                      acaoLabel={`Abrir a notificação ${notification.title}`}
                      className="flex-col items-stretch gap-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{notification.title}</p>
                          <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-muted-foreground">
                            {notification.summary || "Sem resumo"}
                          </p>
                        </div>
                        <Badge variant={badgeVariant as never} className="shrink-0 rounded-full px-2.5 py-0.5 text-[0.6875rem]">
                          {badgeLabel}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.6875rem] text-muted-foreground">
                        <span className="rounded-full border border-border/70 px-2 py-0.5">Prioridade {notification.priority}</span>
                        <span>{formatCompactDateTime(notification.created_at)}</span>
                      </div>
                    </AdminDashboardItem>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma notificação cadastrada ainda.</p>
              )}
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-border/70 bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Últimos banners</p>
                <p className="text-sm text-foreground">Controle do hero principal do catálogo</p>
              </div>
              <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[0.6875rem]">
                {banners.length} total
              </Badge>
            </div>

            <div className="space-y-3">
              {latestBanners.length > 0 ? (
                latestBanners.map((banner) => (
                  <AdminDashboardItem
                    key={banner.id}
                    onClick={onGoToBanners}
                    acaoLabel={`Abrir o banner ${banner.label}`}
                    className="flex-col items-stretch gap-2"
                  >
                    {/* A miniatura, e não só o nome: banner é peça visual, e
                        "Whey Concentrado + Crea_Banner" não diz qual arte é. */}
                    {banner.image_url ? (
                      <div className="h-16 w-full shrink-0 overflow-hidden rounded-[0.75rem] border border-border/70 bg-muted">
                        <img
                          src={banner.image_url}
                          alt={banner.label}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{banner.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {banner.visible_to && banner.visible_to.length > 0
                            ? `${banner.visible_to.length} público(s) definido(s)`
                            : "Visível para todos os públicos"}
                        </p>
                      </div>
                      <Badge variant={banner.active ? "default" : "secondary"} className="shrink-0 rounded-full px-2.5 py-0.5 text-[0.6875rem]">
                        {banner.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.6875rem] text-muted-foreground">
                      <span className="rounded-full border border-border/70 px-2 py-0.5">Ordem {banner.sort_order}</span>
                      <span>{formatCompactDate(banner.created_at)}</span>
                    </div>
                  </AdminDashboardItem>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum banner cadastrado ainda.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0 rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Integração / Proxsys</p>
            <p className="text-sm text-foreground">Resumo do vínculo dos clientes e dos pedidos exportados</p>
          </div>
          <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1 text-[0.6875rem] font-medium">
            {linkedCustomers.length} vinculados
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            icon={UserCheck}
            label="Com tabela própria"
            value={linkedCustomers.length}
            tone="success"
            note="Compram por uma tabela negociada"
            onClick={onGoToCustomers}
            acaoLabel="abrir a base de clientes"
          />
          <AdminStatCard
            icon={Users}
            label="Sem tabela própria"
            value={unlinkedCustomers.length}
            tone="warn"
            note="Sem tabela de preço própria"
            onClick={onGoToCustomers}
            acaoLabel="abrir a base de clientes"
          />
          <AdminStatCard
            icon={ShoppingBag}
            label="Pedidos exportados"
            value={exportedOrders.length}
            tone="primary"
            note={`${pendingProxisOrders} ainda sem exportação`}
            onClick={onGoToOrders}
            acaoLabel="abrir os pedidos"
          />
          <AdminStatCard
            icon={CalendarClock}
            label="Sincronizações recentes"
            value={recentSyncCount}
            tone="muted"
            note="Últimos 7 dias"
            onClick={onGoToCustomers}
            acaoLabel="abrir a base de clientes"
          />
        </div>

        <div className="mt-5 rounded-[1.25rem] border border-border/70 bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Últimos clientes sincronizados</p>
              <p className="text-sm text-foreground">Quem teve o vínculo revisado mais recentemente</p>
            </div>
            <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[0.6875rem]">
              {recentlySyncedCustomers.length} exibidos
            </Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {recentlySyncedCustomers.length > 0 ? (
              recentlySyncedCustomers.map((customer) => (
                <AdminDashboardItem
                  key={customer.user_id}
                  onClick={() => onGoToCustomer(customer.cnpj || customer.name || "")}
                  acaoLabel={`Ver ${customer.name} na base de clientes`}
                  className="h-full flex-col items-stretch gap-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{customer.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{customer.company || "Sem empresa vinculada"}</p>
                    </div>
                    <Badge variant={customer.proxis_found ? "default" : "secondary"} className="shrink-0 rounded-full px-2.5 py-0.5 text-[0.6875rem]">
                      {customer.proxis_found ? "OK" : "Sem vínculo"}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-1 text-xs leading-5 text-muted-foreground">
                    <p className="break-words">Documento {formatDocumentId(customer.cnpj)}</p>
                    <p>Sincronizado em {formatCompactDateTime(customer.proxis_synced_at)}</p>
                  </div>
                </AdminDashboardItem>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma sincronização recente encontrada.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
