import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  Building2,
  CalendarClock,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Mail,
  MapPinned,
  Pencil,
  Phone,
  Save,
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
import { ClientAddressesSection } from "@/components/client/ClientAddressesSection";
import { CatalogNotificationImageFrame } from "@/components/shared/CatalogNotificationImageFrame";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { SupportChatPanel } from "@/components/support/SupportChatPanel";
import type { ClientSection } from "@/components/client/clientTypes";
import { formatCnpjDisplay, formatPhone, onlyDigits } from "@/lib/brazilianIds";
import { formatCep } from "@/lib/address";
import { customerTypeLabel, normalizeCustomerType } from "@/lib/pricing";
import { formatBRL } from "@/lib/formatMoney";
import { getOrderLinesGrandTotal, getOrderLinesQuantityTotal, parseOrderTableLines } from "@/lib/orders";
import type { Order } from "@/lib/orders";
import { useOrders } from "@/hooks/useOrders";
import { useProducts } from "@/hooks/useProducts";
import { useCatalogNotifications } from "@/hooks/useCatalogNotifications";
import { useCatalogNotificationReads } from "@/hooks/useCatalogNotificationReads";
import type { CatalogNotification } from "@/lib/catalogNotifications";
import { buildOrderEnrichmentMaps } from "@/lib/products";

import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  REPRESENTATIVE_PHONE_DISPLAY,
  REPRESENTATIVE_PHONE_TEL,
  REPRESENTATIVE_PHONE_WHATSAPP_URL,
} from "@/lib/supportContact";

const sectionTitle: Record<ClientSection, string> = {
  resumo: "Resumo da conta",
  empresa: "Dados da empresa",
  enderecos: "Meus endereços",
  pedidos: "Meus pedidos",
  seguranca: "Configurações",
  mensagens: "Mensagens",
  notificacoes: "Notificações",
};

type CustomerCatalogNotification = CatalogNotification & { isRead: boolean };

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function formatCompactDateTime(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const datePart = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return { datePart, timePart };
}

function passwordStrength(password: string): { label: string; score: number; checks: { label: string; ok: boolean }[] } {
  const checks = [
    { label: "Mínimo 8 caracteres", ok: password.length >= 8 },
    { label: "Máximo 64 caracteres", ok: password.length <= 64 },
    { label: "Letra maiúscula", ok: /[A-Z]/.test(password) },
    { label: "Letra minúscula", ok: /[a-z]/.test(password) },
    { label: "Número", ok: /\d/.test(password) },
    { label: "Caractere especial", ok: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];
  const okCount = checks.filter((c) => c.ok).length;
  const labels = ["Fraca", "Fraca", "Regular", "Média", "Boa", "Forte", "Forte"];
  return { label: labels[Math.min(okCount, 6)], score: okCount, checks };
}

function AdminAccessNotice({
  onLogout,
  onGoCustomerArea,
}: {
  onLogout: () => void;
  onGoCustomerArea: () => void;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_8%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_30%),radial-gradient(circle_at_82%_18%,color-mix(in_oklch,var(--primary)_5%,transparent),transparent_28%),radial-gradient(circle_at_55%_42%,color-mix(in_oklch,var(--primary)_3%,transparent),transparent_25%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--background))_50%,hsl(var(--muted)/0.10)_100%)] px-4 py-6 sm:px-6 lg:px-8">
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
            <Button type="button" className="h-11 rounded-2xl px-5 text-sm" onClick={onGoCustomerArea}>
              Ir para a área de cliente
            </Button>
            <ConfirmActionDialog
              trigger={
                <Button type="button" variant="outline" className="h-11 rounded-2xl px-5 text-sm">
                  <LogOut className="h-4 w-4" />
                  Sair da conta
                </Button>
              }
              title="Sair da conta"
              description="Deseja encerrar a sessão administrativa atual"
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

function CustomerNotificationPreview({ notification }: { notification: CustomerCatalogNotification }) {
  const notificationDateTime = formatCompactDateTime(notification.starts_at ?? notification.created_at);
  const ctaLabel = notification.cta_label?.trim();
  const ctaUrl = notification.cta_url?.trim();

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
      <CatalogNotificationImageFrame src={notification.image_url} alt={notification.title} className="aspect-[3/1]" fit="cover" />

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={notification.isRead ? "outline" : "default"} className="rounded-full px-3 py-1 text-[11px]">
              {notification.isRead ? "Lida" : "Nova"}
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
              Campanha do catálogo
            </Badge>
          </div>
          {notificationDateTime ? (
            <p className="text-[11px] text-muted-foreground">
              {notification.starts_at ? "Início" : "Publicado"} {notificationDateTime.datePart} às {notificationDateTime.timePart}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Campanha</p>
          <p className="text-[1.03rem] font-semibold text-foreground">{notification.title}</p>
          {notification.summary ? <p className="text-sm text-muted-foreground">{notification.summary}</p> : null}
        </div>

        {notification.body ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">{notification.body}</p>
        ) : null}

        {ctaLabel || ctaUrl ? (
          <div className="mt-auto flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ação</p>
              <p className="truncate text-sm font-medium text-foreground">{ctaLabel || "Abrir link"}</p>
              <p className="truncate text-xs text-muted-foreground">{ctaUrl || "Sem link configurado"}</p>
            </div>
            {ctaUrl ? (
              <Button asChild className="h-10 rounded-2xl px-4 text-sm">
                <a href={ctaUrl} target="_blank" rel="noreferrer">
                  {ctaLabel || "Abrir link"}
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function Account() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAdmin, customerProfile, loading, isResolvingAccess, signOut, refreshCustomerProfile } = useAuth();
  const { data: orders = [], isLoading: ordersLoading } = useOrders(
    Boolean(user && customerProfile && !isAdmin),
    user?.id ?? "customer",
  );
  const { data: products = [] } = useProducts({ includeInactive: true });
  const { data: notifications = [], isLoading: notificationsLoading } = useCatalogNotifications();
  const { data: notificationReads = [], isLoading: notificationReadsLoading, markAsRead } = useCatalogNotificationReads(user?.id ?? null);
  const [section, setSection] = useState<ClientSection>("resumo");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);

  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [savingAccountName, setSavingAccountName] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    const sectionParam = searchParams.get("section");
    if (sectionParam === "resumo" || sectionParam === "empresa" || sectionParam === "enderecos" || sectionParam === "pedidos" || sectionParam === "seguranca" || sectionParam === "mensagens" || sectionParam === "notificacoes") {
      setSection(sectionParam);
    }
  }, [searchParams]);

  useEffect(() => {
    setAccountName(customerProfile?.name?.trim() || user?.user_metadata?.name?.trim() || "");
  }, [customerProfile?.name, user?.id, user?.user_metadata?.name]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true, viewTransition: true });
    }
  }, [loading, user, navigate]);

  const displayName = customerProfile?.company?.trim() || customerProfile?.name?.trim() || user?.email || "Cliente";
  const displayCustomerType = customerProfile
    ? customerTypeLabel(normalizeCustomerType(customerProfile.customer_type))
    : "Cadastro em processamento";
  const customerOrders = useMemo(() => {
    if (!customerProfile) return [] as Order[];
    const profileCnpj = onlyDigits(customerProfile.cnpj);
    return (orders as Order[]).filter((order) => onlyDigits(order.customer_cnpj) === profileCnpj);
  }, [orders, customerProfile]);
  const orderEnrichment = useMemo(() => buildOrderEnrichmentMaps(products), [products]);
  const orderViews = useMemo(
    () =>
      customerOrders.map((order) => {
        const lines = parseOrderTableLines(order.items, orderEnrichment);
        return {
          order,
          lines,
          totalItems: getOrderLinesQuantityTotal(lines),
          totalValue: getOrderLinesGrandTotal(lines),
        };
      }),
    [customerOrders, orderEnrichment],
  );
  const totalSpent = useMemo(
    () => orderViews.reduce((sum, item) => sum + item.totalValue, 0),
    [orderViews],
  );
  const readNotificationIds = useMemo(
    () => new Set(notificationReads.map((item) => item.notification_id)),
    [notificationReads],
  );
  const notificationsWithState = useMemo(
    () =>
      [...notifications]
        .map((item) => ({ ...item, isRead: readNotificationIds.has(item.id) }))
        .sort((left, right) => {
          const readOrder = Number(left.isRead) - Number(right.isRead);
          if (readOrder !== 0) return readOrder;
          return right.priority - left.priority || right.created_at.localeCompare(left.created_at);
        }),
    [notifications, readNotificationIds],
  );
  const unreadNotificationCount = useMemo(
    () => notificationsWithState.filter((item) => !item.isRead).length,
    [notificationsWithState],
  );
  const selectedNotification = useMemo(
    () => notificationsWithState.find((item) => item.id === selectedNotificationId) ?? null,
    [notificationsWithState, selectedNotificationId],
  );
  const isNotificationsLoading = notificationsLoading || notificationReadsLoading;
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
    return <Navigate to="/admin" replace />;
  }

  const summaryContent = (
    <div className="space-y-4 sm:space-y-6">
      <ClientSectionHeader
        eyebrow="Minha conta"
        title="Resumo da conta"
        description="Tenha uma leitura rápida do estado da conta, do acesso e do histórico do cliente."
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
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
    <div className="space-y-4 sm:space-y-6">
      <ClientSectionHeader
        eyebrow="Empresa"
        title="Dados da empresa"
        description="Revise e edite os dados cadastrais associados a sua conta."
        actions={
          customerProfile ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEditName(customerProfile.name);
                setEditPhone(customerProfile.phone);
                setEditCompany(customerProfile.company);
                setEditingProfile(!editingProfile);
              }}
              className="h-8 rounded-full px-4 text-[12px]"
            >
              {editingProfile ? <Save className="mr-1.5 h-3.5 w-3.5" /> : <Pencil className="mr-1.5 h-3.5 w-3.5" />}
              {editingProfile ? "Cancelar" : "Editar"}
            </Button>
          ) : undefined
        }
      />

      {customerProfile ? (
        editingProfile ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSavingProfile(true);
              try {
                const { error } = await supabase.rpc("update_own_customer_profile", {
                  p_name: editName.trim(),
                  p_phone: editPhone.trim(),
                  p_company: editCompany.trim(),
                });
                if (error) throw error;
                toast.success("Perfil atualizado");
                setEditingProfile(false);
                if (user) await refreshCustomerProfile(user.id);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Erro ao atualizar perfil");
              } finally {
                setSavingProfile(false);
              }
            }}
            className="rounded-[1.5rem] border border-border/70 bg-background/95 p-5 shadow-sm sm:p-6 space-y-4"
          >
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-10 rounded-2xl text-[13px]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Telefone</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="h-10 rounded-2xl text-[13px]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Empresa</Label>
              <Input value={editCompany} onChange={(e) => setEditCompany(e.target.value)} className="h-10 rounded-2xl text-[13px]" readOnly />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={savingProfile} className="h-9 rounded-full px-5 text-[13px]">
                {savingProfile ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2">
              <InfoTile label="Nome" value={customerProfile.name || "—"} icon={UserRound} />
              <InfoTile label="Empresa" value={customerProfile.company || "—"} icon={Building2} />
              <InfoTile label="Telefone" value={formatPhone(customerProfile.phone) || "—"} icon={Phone} />
              <InfoTile label="CNPJ" value={formatCnpjDisplay(customerProfile.cnpj)} icon={Building2} />
            </div>

            <div className="rounded-[1.5rem] border border-border/70 bg-background/95 p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2">
                <MapPinned className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Endereco</h2>
              </div>

              {customerProfile.address_cep ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <InfoTile label="CEP" value={formatCep(customerProfile.address_cep)} icon={MapPinned} />
                  <InfoTile label="Rua" value={customerProfile.address_street || "—"} icon={Building2} />
                  <InfoTile label="Numero" value={customerProfile.address_number || "—"} icon={Building2} />
                  <InfoTile label="Complemento" value={customerProfile.address_complement || "—"} icon={Building2} />
                  <InfoTile label="Bairro" value={customerProfile.address_neighborhood || "—"} icon={Building2} />
                  <InfoTile label="Cidade/UF" value={`${customerProfile.address_city || "—"}/${customerProfile.address_state || "—"}`} icon={Building2} />
                </div>
              ) : (
                <div className="mt-5">
                  <EmptyPanel
                    title="Endereco nao cadastrado"
                    description="Quando os dados de endereco forem salvos no perfil, eles aparecem aqui para consulta do cliente."
                  />
                </div>
              )}
            </div>
          </>
        )
      ) : (
        <EmptyPanel
          title="Nenhum perfil de empresa encontrado"
          description="Se voce acabou de criar a conta, aguarde a finalizacao do cadastro ou entre novamente apos confirmar o acesso."
        />
      )}
    </div>
  );

  const addressesContent = <ClientAddressesSection />;

  const ordersContent = (
    <div className="space-y-4 sm:space-y-6">
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
    <div className="space-y-4 sm:space-y-6">
      <ClientSectionHeader
        eyebrow="Configurações"
        title="Senha e perfil"
        description="Gerencie sua sessão e altere sua senha de acesso."
      />

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const nextName = accountName.trim();
          if (!user?.id) {
            toast.error("Usuário não autenticado");
            return;
          }
          if (!nextName) {
            toast.error("Informe um nome para salvar");
            return;
          }

          setSavingAccountName(true);
          try {
            const { error: authError } = await supabase.auth.updateUser({
              data: { name: nextName },
            });
            if (authError) throw authError;

            const { error: profileError } = await supabase.rpc("update_own_customer_profile", {
              p_name: nextName,
            });
            if (profileError) throw profileError;

            setAccountName(nextName);
            await refreshCustomerProfile(user.id);
            toast.success("Dados da conta atualizados");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erro ao atualizar o nome");
          } finally {
            setSavingAccountName(false);
          }
        }}
        className="rounded-[1.5rem] border border-border/70 bg-background/95 p-5 shadow-sm sm:p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <UserRound className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold text-foreground">Dados da conta</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
          <InfoTile
            label="Usuário"
            value={displayName}
            hint="Conta vinculada ao acesso atual."
            icon={UserRound}
          />
          <InfoTile
            label="E-mail"
            value={user.email || "—"}
            hint="Login usado nesta sessao."
            icon={Mail}
          />
          <InfoTile
            label="Acesso"
            value="Cliente B2B"
            hint="Area exclusiva do cliente."
            icon={ShieldCheck}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.6fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Nome
            </Label>
            <Input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Seu nome"
              className="h-10 rounded-2xl text-[13px]"
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={savingAccountName} className="h-10 rounded-full px-5 text-[13px]">
              {savingAccountName ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Salvar nome
            </Button>
          </div>
        </div>
      </form>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!currentPassword) { toast.error("Informe a senha atual"); return; }
          if (newPassword.length < 8) { toast.error("Nova senha deve ter no mínimo 8 caracteres"); return; }
          if (newPassword.length > 64) { toast.error("Nova senha deve ter no máximo 64 caracteres"); return; }
          if (!/[A-Z]/.test(newPassword)) { toast.error("Nova senha deve conter pelo menos uma letra maiúscula"); return; }
          if (!/[a-z]/.test(newPassword)) { toast.error("Nova senha deve conter pelo menos uma letra minúscula"); return; }
          if (!/\d/.test(newPassword)) { toast.error("Nova senha deve conter pelo menos um número"); return; }
          if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) { toast.error("Nova senha deve conter pelo menos um caractere especial"); return; }
          if (newPassword !== confirmPassword) { toast.error("Senhas não conferem"); return; }
          setSavingPassword(true);
          try {
            const { error: signInErr } = await supabase.auth.signInWithPassword({
              email: user!.email!,
              password: currentPassword,
            });
            if (signInErr) { toast.error("Senha atual incorreta"); setSavingPassword(false); return; }
            const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
            if (updateErr) throw updateErr;
            toast.success("Senha alterada com sucesso");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erro ao alterar senha");
          } finally {
            setSavingPassword(false);
          }
        }}
        className="rounded-[1.5rem] border border-border/70 bg-background/95 p-5 shadow-sm sm:p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold text-foreground">Alterar senha</p>
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Senha atual</Label>
          <div className="relative">
            <Input
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Sua senha atual"
              maxLength={64}
              className="h-10 rounded-2xl pr-10 text-[13px]"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nova senha</Label>
          <div className="relative">
            <Input
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              maxLength={64}
              className="h-10 rounded-2xl pr-10 text-[13px]"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {newPassword.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      passwordStrength(newPassword).score <= 1 ? "w-1/6 bg-red-400" :
                      passwordStrength(newPassword).score <= 2 ? "w-1/3 bg-orange-400" :
                      passwordStrength(newPassword).score <= 3 ? "w-1/2 bg-yellow-400" :
                      passwordStrength(newPassword).score <= 4 ? "w-2/3 bg-yellow-400" :
                      passwordStrength(newPassword).score <= 5 ? "w-5/6 bg-emerald-400" :
                      "w-full bg-emerald-400",
                    )}
                  />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">{passwordStrength(newPassword).label}</span>
                <span className="ml-auto text-[11px] tabular-nums text-muted-foreground/60">{newPassword.length}/64</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {passwordStrength(newPassword).checks.map((c) => (
                  <span key={c.label} className={cn("text-[11px]", c.ok ? "text-emerald-600" : "text-muted-foreground/60")}>
                    {c.ok ? "✓" : "○"} {c.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Confirmar nova senha</Label>
          <div className="relative">
            <Input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              maxLength={64}
              className="h-10 rounded-2xl pr-10 text-[13px]"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={savingPassword} className="h-9 rounded-full px-5 text-[13px]">
            {savingPassword ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Alterar senha
          </Button>
        </div>
      </form>

    </div>
  );

  const messagesContent = (
    <div className="space-y-4 sm:space-y-6">
      <ClientSectionHeader
        eyebrow="Atendimento"
        title="Mensagens e suporte"
        description="Fale com o time e use o contato do consultor quando precisar de uma resposta mais direta."
      />

      <div className="rounded-[1.5rem] border border-border/70 bg-background/95 p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold text-foreground">Consultor / representante</p>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Precisa de ajuda com pedidos, campanhas ou orientações do catálogo? Fale direto com o representante.
        </p>
        <p className="mt-3 text-base font-semibold text-foreground">{REPRESENTATIVE_PHONE_DISPLAY}</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <a href={REPRESENTATIVE_PHONE_TEL} className="sm:flex-1">
            <Button variant="outline" className="h-11 w-full rounded-2xl border-border/70 bg-background px-5 text-sm">
              Ligar
            </Button>
          </a>
          <a href={REPRESENTATIVE_PHONE_WHATSAPP_URL} target="_blank" rel="noreferrer" className="sm:flex-1">
            <Button className="h-11 w-full rounded-2xl px-5 text-sm">WhatsApp</Button>
          </a>
        </div>
      </div>

      <SupportChatPanel mode="customer" />
    </div>
  );

  const notificationsContent = (
    <div className="space-y-4 sm:space-y-6">
      <ClientSectionHeader
        eyebrow="Comunicação"
        title="Notificações do catálogo"
        description="Veja campanhas, avisos e destaques que o time quer comunicar dentro do catálogo."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {unreadNotificationCount > 0 ? (
              <Badge variant="default" className="rounded-full px-3 py-1 text-[11px] font-medium">
                {unreadNotificationCount} nova(s)
              </Badge>
            ) : null}
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-medium">
              {notificationsWithState.length} ativa(s)
            </Badge>
          </div>
        }
      />

      {isNotificationsLoading ? (
        <div className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-background/95 shadow-sm">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex gap-4 border-b border-border/60 p-4 last:border-b-0">
              <Skeleton className="aspect-[16/10] w-20 sm:w-36 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-28 rounded-full" />
                <Skeleton className="h-5 w-2/5 rounded-full" />
                <Skeleton className="h-4 w-3/5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : notificationsWithState.length > 0 ? (
        <div className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-background/95 shadow-sm">
          {notificationsWithState.map((item) => {
            const notificationDateTime = formatCompactDateTime(item.starts_at ?? item.created_at);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedNotificationId(item.id);
                  if (!item.isRead) {
                    void markAsRead(item.id).catch(() => null);
                  }
                }}
                className={`group flex w-full gap-4 border-b border-border/60 p-4 text-left transition-colors last:border-b-0 hover:bg-muted/35 ${
                  item.isRead ? "bg-background" : "bg-primary/[0.035]"
                }`}
              >
                <CatalogNotificationImageFrame
                  src={item.image_url}
                  alt={item.title}
                  className="aspect-[16/10] w-20 sm:w-36 shrink-0 rounded-xl border border-border/60"
                  iconClassName="h-7 w-7 text-muted-foreground/35"
                  fit="cover"
                />

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.isRead ? "outline" : "default"} className="rounded-full px-3 py-1 text-[11px] font-medium">
                      {item.isRead ? "Lida" : "Nova"}
                    </Badge>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Campanha</span>
                    {notificationDateTime ? (
                      <span className="text-[11px] text-muted-foreground">
                        {item.starts_at ? "Início" : "Publicado"} {notificationDateTime.datePart} às {notificationDateTime.timePart}
                      </span>
                    ) : null}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <h2 className="line-clamp-1 text-base font-semibold text-foreground sm:text-lg">{item.title}</h2>
                    {item.summary ? <p className="text-sm font-medium leading-6 text-foreground">{item.summary}</p> : null}
                    {item.body ? <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{item.body}</p> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[12px] font-medium text-primary transition-colors group-hover:text-primary/80">
                      Ver detalhes
                    </span>
                    {item.cta_label ? (
                      <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-medium">
                        {item.cta_label}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyPanel
          title="Nenhuma notificação ativa"
          description="Quando o time publicar uma campanha, ela vai aparecer nesta área da conta do cliente."
        />
      )}

      <Dialog
        open={Boolean(selectedNotification)}
        onOpenChange={(open) => {
          if (!open) setSelectedNotificationId(null);
        }}
      >
        <DialogContent className="max-h-[92vh] w-[min(96vw,860px)] overflow-hidden rounded-[1.75rem] border-border/70 p-0">
          {selectedNotification ? (
            <div className="flex max-h-[92vh] flex-col overflow-hidden">
              <DialogHeader className="border-b border-border/70 px-5 py-4">
                <DialogTitle className="text-left text-[1.1rem] font-black tracking-[-0.04em] text-foreground">
                  Detalhes da notificação
                </DialogTitle>
                <DialogDescription className="text-left text-[13px] text-muted-foreground">
                  Visualização completa da campanha enviada pelo catálogo.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <CustomerNotificationPreview notification={selectedNotification} />
              </div>

              <DialogFooter className="border-t border-border/70 bg-background px-5 py-4">
                <Button type="button" variant="outline" className="h-11 rounded-2xl px-5 text-sm" onClick={() => setSelectedNotificationId(null)}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
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
      unreadNotificationCount={unreadNotificationCount}
    >
      {section === "resumo" && summaryContent}
      {section === "empresa" && companyContent}
      {section === "enderecos" && addressesContent}
      {section === "pedidos" && ordersContent}
      {section === "seguranca" && securityContent}
      {section === "mensagens" && messagesContent}
      {section === "notificacoes" && notificationsContent}
    </ClientWorkspaceShell>
  );
}
