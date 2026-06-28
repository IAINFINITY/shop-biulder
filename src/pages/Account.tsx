import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Building2,
  CalendarClock,
  LogOut,
  Mail,
  MapPinned,
  Phone,
  ShieldCheck,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { AuthStatusScreen } from "@/components/auth/AuthStatusScreen";
import { ClientWorkspaceShell } from "@/components/client/ClientWorkspaceShell";
import { ClientSectionHeader } from "@/components/client/ClientSectionHeader";
import { ClientOrderCard } from "@/components/client/ClientOrderCard";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import type { ClientSection } from "@/components/client/clientTypes";
import { formatCnpjDisplay, formatPhone, onlyDigits } from "@/lib/brazilianIds";
import { formatCep } from "@/lib/address";
import { CUSTOMER_TYPE_LABELS, normalizeCustomerType } from "@/lib/pricing";
import { formatBRL } from "@/lib/formatMoney";
import { getOrderLinesGrandTotal, getOrderLinesQuantityTotal, parseOrderTableLines } from "@/lib/orders";
import type { Order } from "@/lib/orders";
import { useOrders } from "@/hooks/useOrders";

const sectionTitle: Record<ClientSection, string> = {
  resumo: "Resumo da conta",
  empresa: "Dados da empresa",
  pedidos: "Meus pedidos",
  seguranca: "Segurança e acesso",
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function AdminAccessNotice({
  onLogout,
  onGoAdmin,
}: {
  onLogout: () => void;
  onGoAdmin: () => void;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_12%,hsl(var(--primary)/0.08),transparent_30%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--background))_62%,hsl(var(--muted)/0.25)_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center">
        <div className="w-full rounded-[2rem] border border-border/70 bg-card/95 p-6 shadow-[0_16px_40px_rgba(16,24,40,0.08)] backdrop-blur sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/5 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Acesso administrativo
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-foreground">
                Você está logado como admin
              </h1>
            </div>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-primary/15 bg-primary/5 p-5 text-sm leading-6 text-foreground">
            Para acessar a área do cliente, você precisa sair da conta administrativa primeiro. Assim evitamos misturar a
            visualização do admin com o fluxo do cliente.
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button type="button" className="h-11 rounded-2xl px-5 text-sm" onClick={onGoAdmin}>
              Ir para o painel administrativo
            </Button>
            <ConfirmActionDialog
              trigger={
                <Button type="button" variant="outline" className="h-11 rounded-2xl px-5 text-sm">
                  <LogOut className="h-4 w-4" />
                  Sair da conta
                </Button>
              }
              title="Sair da conta"
              description="Deseja encerrar a sessão administrativa atual?"
              confirmLabel="Sair"
              destructive
              onConfirm={onLogout}
            />
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border/70 pt-4 text-sm">
            <Link to="/" viewTransition className="text-muted-foreground transition-colors hover:text-foreground">
              Ir ao catálogo
            </Link>
            <span className="text-[12px] text-muted-foreground">
              Se precisar da área de clientes, faça login com um usuário B2B.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

type InfoTileProps = {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Mail;
};

function InfoTile({ label, value, hint, icon: Icon }: InfoTileProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/95 p-6 text-sm leading-6 text-muted-foreground">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-2">{description}</p>
    </div>
  );
}

export default function Account() {
  const navigate = useNavigate();
  const { user, isAdmin, customerProfile, loading, isResolvingAccess, signOut } = useAuth();
  const { data: orders = [], isLoading: ordersLoading } = useOrders(
    Boolean(user && customerProfile && !isAdmin),
    user?.id ?? "customer",
  );
  const [section, setSection] = useState<ClientSection>("resumo");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true, viewTransition: true });
    }
  }, [loading, user, navigate]);

  const displayName = customerProfile?.company?.trim() || customerProfile?.name?.trim() || user?.email || "Cliente";
  const displayCustomerType = customerProfile
    ? CUSTOMER_TYPE_LABELS[normalizeCustomerType(customerProfile.customer_type)]
    : "Cadastro em processamento";
  const customerOrders = useMemo(() => {
    if (!customerProfile) return [] as Order[];
    const profileCnpj = onlyDigits(customerProfile.cnpj);
    return (orders as Order[]).filter((order) => onlyDigits(order.customer_cnpj) === profileCnpj);
  }, [orders, customerProfile]);
  const orderViews = useMemo(
    () =>
      customerOrders.map((order) => {
        const lines = parseOrderTableLines(order.items);
        return {
          order,
          lines,
          totalItems: getOrderLinesQuantityTotal(lines),
          totalValue: getOrderLinesGrandTotal(lines),
        };
      }),
    [customerOrders],
  );
  const totalSpent = useMemo(
    () => orderViews.reduce((sum, item) => sum + item.totalValue, 0),
    [orderViews],
  );
  if (loading || isResolvingAccess) {
    return (
      <AuthStatusScreen
        eyebrow="Minha conta"
        title="Abrindo sua área"
        description="Estamos conferindo sua sessão para carregar a área correta sem mostrar conteúdo trocado."
      />
    );
  }

  if (!user) {
    return (
      <AuthStatusScreen
        eyebrow="Minha conta"
        title="Direcionando para o login"
        description="A conta de clientes precisa de um acesso B2B ativo. Vamos levar você para a tela de entrada."
      />
    );
  }

  if (isAdmin) {
    return (
      <AdminAccessNotice
        onGoAdmin={() => navigate("/admin", { replace: true, viewTransition: true })}
        onLogout={async () => {
          await signOut();
          navigate("/login", { replace: true, viewTransition: true });
        }}
      />
    );
  }

  const summaryContent = (
    <div className="space-y-6">
      <ClientSectionHeader
        eyebrow="Minha conta"
        title="Resumo da conta"
        description="Tenha uma leitura rápida do estado da conta, do acesso e do histórico do cliente."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoTile
          label="E-mail"
          value={user.email || "—"}
          hint="Endereço usado no login do cliente."
          icon={Mail}
        />
        <InfoTile
          label="Status"
          value={customerProfile ? "Conta ativa" : "Cadastro em processamento"}
          hint={customerProfile ? "Seu cadastro já está vinculado à área do cliente." : "Aguarde a finalização do cadastro."}
          icon={ShieldCheck}
        />
        <InfoTile
          label="Perfil"
          value={displayCustomerType}
          hint="Esse perfil organiza as regras de visualização da conta."
          icon={UserRound}
        />
        <InfoTile
          label="Atualização"
          value={customerProfile ? formatDateTime(customerProfile.updated_at) : "—"}
          hint="Última sincronização do cadastro."
          icon={CalendarClock}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoTile
          label="Pedidos"
          value={`${orderViews.length} pedido(s)`}
          hint="Histórico liberado para acompanhamento do cliente."
          icon={ShoppingBag}
        />
        <InfoTile
          label="Valor total"
          value={orderViews.length > 0 ? formatBRL(totalSpent) : "—"}
          hint="Soma dos pedidos encontrados."
          icon={ShoppingBag}
        />
        <InfoTile
          label="Último pedido"
          value={orderViews[0] ? formatDateTime(orderViews[0].order.created_at) : "—"}
          hint="Data do pedido mais recente vinculado à conta."
          icon={CalendarClock}
        />
      </div>

      {!customerProfile ? (
        <EmptyPanel
          title="Seu cadastro ainda está sendo concluído"
          description="Assim que os dados do cliente forem vinculados ao usuário, esta área vai mostrar empresa, endereço, pedidos e segurança em um só lugar."
        />
      ) : null}
    </div>
  );

  const companyContent = (
    <div className="space-y-6">
      <ClientSectionHeader
        eyebrow="Empresa"
        title="Dados da empresa"
        description="Revise os dados cadastrais associados à sua conta. Tudo fica concentrado para consulta rápida."
      />

      {customerProfile ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <InfoTile label="Nome" value={customerProfile.name || "—"} icon={UserRound} />
            <InfoTile label="Empresa" value={customerProfile.company || "—"} icon={Building2} />
            <InfoTile label="Telefone" value={formatPhone(customerProfile.phone) || "—"} icon={Phone} />
            <InfoTile label="CNPJ" value={formatCnpjDisplay(customerProfile.cnpj)} icon={Building2} />
          </div>

          <div className="rounded-[1.5rem] border border-border/70 bg-background/95 p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <MapPinned className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Endereço</h2>
            </div>

            {customerProfile.address_cep ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <InfoTile label="CEP" value={formatCep(customerProfile.address_cep)} icon={MapPinned} />
                <InfoTile label="Rua" value={customerProfile.address_street || "—"} icon={Building2} />
                <InfoTile label="Número" value={customerProfile.address_number || "—"} icon={Building2} />
                <InfoTile label="Complemento" value={customerProfile.address_complement || "—"} icon={Building2} />
                <InfoTile label="Bairro" value={customerProfile.address_neighborhood || "—"} icon={Building2} />
                <InfoTile label="Cidade/UF" value={`${customerProfile.address_city || "—"}/${customerProfile.address_state || "—"}`} icon={Building2} />
              </div>
            ) : (
              <div className="mt-5">
                <EmptyPanel
                  title="Endereço não cadastrado"
                  description="Quando os dados de endereço forem salvos no perfil, eles aparecem aqui para consulta do cliente."
                />
              </div>
            )}
          </div>
        </>
      ) : (
        <EmptyPanel
          title="Nenhum perfil de empresa encontrado"
          description="Se você acabou de criar a conta, aguarde a finalização do cadastro ou entre novamente após confirmar o acesso."
        />
      )}
    </div>
  );

  const ordersContent = (
    <div className="space-y-6">
      <ClientSectionHeader
        eyebrow="Pedidos"
        title="Meus pedidos"
        description="Visualize os pedidos vinculados ao mesmo CNPJ do seu cadastro."
        actions={<Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-medium">{orderViews.length} encontrado(s)</Badge>}
      />

      {ordersLoading ? (
        <div className="space-y-3 rounded-[1.5rem] border border-border/70 bg-background/95 p-5 shadow-sm">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-[1.25rem] border border-border/60 bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <Skeleton className="h-12 rounded-2xl" />
                <Skeleton className="h-12 rounded-2xl" />
                <Skeleton className="h-12 rounded-2xl" />
                <Skeleton className="h-12 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      ) : orderViews.length > 0 ? (
        <div className="grid gap-4">
          {orderViews.map(({ order, lines, totalItems, totalValue }) => (
            <ClientOrderCard
              key={order.id}
              order={order}
              lines={lines}
              totalItems={totalItems}
              totalValue={totalValue}
            />
          ))}
        </div>
      ) : (
        <EmptyPanel
          title="Nenhum pedido encontrado"
          description="Quando um pedido for feito com o CNPJ do seu cadastro, ele vai aparecer aqui automaticamente."
        />
      )}
    </div>
  );

  const securityContent = (
    <div className="space-y-6">
      <ClientSectionHeader
        eyebrow="Segurança"
        title="Sessão e acesso"
        description="Veja as informações da sessão atual e use os atalhos para sair com segurança ou voltar ao catálogo."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InfoTile
          label="Usuário"
          value={displayName}
          hint="Conta vinculada ao acesso atual."
          icon={UserRound}
        />
        <InfoTile
          label="E-mail"
          value={user.email || "—"}
          hint="Login usado nesta sessão."
          icon={Mail}
        />
        <InfoTile
          label="Acesso"
          value="Cliente B2B"
          hint="Área exclusiva do cliente."
          icon={ShieldCheck}
        />
      </div>

      <div className="rounded-[1.5rem] border border-border/70 bg-background/95 p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold text-foreground">Ações rápidas</p>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link to="/" viewTransition className="flex-1">
            <Button variant="outline" className="h-11 w-full rounded-2xl border-border/70 bg-background px-5 text-sm">
              Ir ao catálogo
            </Button>
          </Link>
          <ConfirmActionDialog
            trigger={
              <Button type="button" className="h-11 flex-1 rounded-2xl px-5 text-sm">
                <LogOut className="h-4 w-4" />
                Sair da conta
              </Button>
            }
            title="Sair da conta"
            description="Deseja encerrar sua sessão de cliente?"
            confirmLabel="Sair"
            destructive
            onConfirm={async () => {
              await signOut();
              navigate("/login", { replace: true, viewTransition: true });
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <ClientWorkspaceShell
      section={section}
      title={sectionTitle[section]}
      onSectionChange={setSection}
      onLogout={async () => {
        await signOut();
        navigate("/login", { replace: true, viewTransition: true });
      }}
      userLabel={displayName}
      sidebarOpen={sidebarOpen}
      onSidebarToggle={() => setSidebarOpen((current) => !current)}
    >
      {section === "resumo" && summaryContent}
      {section === "empresa" && companyContent}
      {section === "pedidos" && ordersContent}
      {section === "seguranca" && securityContent}
    </ClientWorkspaceShell>
  );
}
