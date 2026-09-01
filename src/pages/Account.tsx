import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
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
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { AuthStatusScreen } from "@/components/auth/AuthStatusScreen";
import { ClientWorkspaceShell } from "@/components/client/ClientWorkspaceShell";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ListaComBusca } from "@/components/admin/ListaComBusca";
import { AutenticadoresSection } from "@/components/client/AutenticadoresSection";
import { AparelhosLembradosSection } from "@/components/client/AparelhosLembradosSection";
import { ExcluirContaSection } from "@/components/client/ExcluirContaSection";
import { TrocarEmailSection } from "@/components/shared/TrocarEmailSection";
import { NomeDaEmpresa } from "@/components/shared/NomeDaEmpresa";
import { ClientOrderCard } from "@/components/client/ClientOrderCard";
import { ClientOrderDetail } from "@/components/client/ClientOrderDetail";
import { ClientAddressesSection } from "@/components/client/ClientAddressesSection";
import { CatalogNotificationImageFrame } from "@/components/shared/CatalogNotificationImageFrame";
import { IconeDoAviso, RotuloDoAviso } from "@/components/client/SeloDoAviso";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { ChatWorkspace } from "@/components/support/ChatWorkspace";
import type { ClientSection } from "@/components/client/clientTypes";
import { formatDocumentId, formatPhone, isValidCnpj, isValidCpf, onlyDigits } from "@/lib/brazilianIds";
import { formatCep } from "@/lib/address";
import { customerTypeLabel, DEFAULT_CUSTOMER_TYPE, normalizeCustomerType } from "@/lib/pricing";
import { formatBRL } from "@/lib/formatMoney";
import { getOrderLinesGrandTotal, getOrderLinesQuantityTotal, parseOrderTableLines } from "@/lib/orders";
import type { Order } from "@/lib/orders";
import { useEtapaNaUrl } from "@/hooks/useFiltroNaUrl";
import { useOrders } from "@/hooks/useOrders";
import { useProducts } from "@/hooks/useProducts";
import { useCatalogNotifications } from "@/hooks/useCatalogNotifications";
import { PreferenciaDeCampanhas } from "@/components/client/PreferenciaDeCampanhas";
import { MeusDadosSection } from "@/components/client/MeusDadosSection";
import { useCatalogNotificationReads } from "@/hooks/useCatalogNotificationReads";
import type { CatalogNotification } from "@/lib/catalogNotifications";
import { buildOrderEnrichmentMaps } from "@/lib/products";

import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MODAL_TELA_CHEIA, MODAL_TELA_CHEIA_CORPO } from "@/lib/modais";
import { validarSenha } from "@/lib/validarSenha";
import { MIN_SEM_MFA } from "@/lib/senha";
import { forcaDaSenha } from "@/lib/forcaDaSenha";
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
  "meus-dados": "Meus dados",
};

/**
 * Se o valor da URL é uma seção que existe.
 *
 * Sai de `sectionTitle`, e não de uma lista escrita à mão: era uma cadeia de
 * oito comparações `===` que precisava ser lembrada a cada seção nova.
 */
function ehSecaoDoCliente(valor: string | null): valor is ClientSection {
  return Boolean(valor) && valor! in sectionTitle;
}

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

function AdminAccessNotice({
  onLogout,
  onGoCustomerArea,
}: {
  onLogout: () => void;
  onGoCustomerArea: () => void;
}) {
  return (
    <div className="min-h-screen bg-muted/40 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center">
        <div className="w-full rounded-[1.25rem] bg-card/95 border border-border/70 p-6 shadow-[0_12px_32px_rgba(16,24,40,0.08)] backdrop-blur sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/5 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Acesso administrativo
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                Você está logado como admin
              </h1>
            </div>
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-primary/15 bg-primary/5 p-5 text-sm leading-6 text-foreground">
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
            <span className="text-xs text-muted-foreground">
              Se precisar da área de clientes, faça login com um usuário B2B.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

type InfoTileProps = {
  /** Quando existe, o cartão vira botão e ganha a seta. */
  onClick?: () => void;
  /** O que o clique faz — vira a seta e o rótulo de leitor de tela. */
  acaoLabel?: string;
  label: string;
  /** `ReactNode` e nao `string`: a empresa precisa exibir o selo de MEI ao lado. */
  value: ReactNode;
  hint?: string;
  icon: typeof Mail;
};

/**
 * Itens por página nas listas da conta.
 *
 * Menor que os 24 do painel: quem administra varre listas o dia todo e quer
 * densidade; o cliente vê a própria conta de vez em quando, e cada pedido aqui
 * é um cartão alto com itens dentro. Seis cabem sem virar rolagem.
 */
const ITENS_POR_PAGINA_DO_CLIENTE = 6;

/**
 * Um cartão de resumo da conta.
 *
 * ## Alinhado ao `AdminStatCard`
 *
 * O do painel tem o ícone num círculo **com borda**, raio de `1.25rem` e uma
 * reação ao mouse. Este tinha um círculo sem borda, `rounded-xl` e nada
 * acontecia ao passar por cima — as duas bancadas mostravam o mesmo tipo de
 * informação com duas caras.
 *
 * ⚠️ **Sem `cursor-pointer`**: ao contrário dos do painel, estes não abrem nada.
 * Ganham só borda e sombra no hover; prometer um clique que não existe é pior
 * que não reagir.
 */
function InfoTile({ label, value, hint, icon: Icon, onClick, acaoLabel }: InfoTileProps) {
  const Elemento = onClick ? "button" : "div";

  return (
    <Elemento
      {...(onClick ? { type: "button" as const, onClick, "aria-label": acaoLabel } : {})}
      className={cn(
        "group w-full rounded-[1.25rem] border border-border/70 bg-muted/20 p-4 text-left transition-all duration-200",
        "hover:border-primary/25 hover:bg-primary/[0.03] hover:shadow-[0_4px_16px_rgba(16,24,40,0.06)]",
        // ⚠️ Cursor e seta **só** quando leva a algum lugar. O cartão que não
        // abre nada reage à mesma cor, mas não promete um clique.
        onClick && "cursor-pointer hover:-translate-y-px motion-reduce:hover:translate-y-0",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <p className="min-w-0 truncate text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
      </div>
      {/* `break-words` porque o valor costuma ser e-mail ou CNPJ — cadeia sem
          espaco, que o navegador nao quebra sozinho. Em duas colunas no celular
          sobram ~140px por cartao, e um endereco como
          `nome.sobrenome@empresa.com.br` passava por fora da borda. */}
      <p className="mt-3 break-words text-sm font-medium text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}

      {/* A seta aparece ao passar o mouse — é o mesmo gesto dos cartões do
          Dashboard do painel, e é o que responde "isto abre alguma coisa?". */}
      {onClick ? (
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {acaoLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </Elemento>
  );
}

function EmptyPanel({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  /** Saida da tela vazia, quando existe uma. Nem todo vazio tem o que fazer. */
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/95 p-6 text-sm leading-6 text-muted-foreground">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-2">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}


export default function Account() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin, customerProfile, loading, isResolvingAccess, signOut, refreshCustomerProfile, registerCustomerProfile } = useAuth();
  const { data: orders = [], isLoading: ordersLoading } = useOrders(
    Boolean(user && customerProfile && !isAdmin),
    user?.id ?? "customer",
  );
  const { data: products = [] } = useProducts({ includeInactive: true });
  const { data: notifications = [], isLoading: notificationsLoading } = useCatalogNotifications();
  const {
    data: notificationReads = [],
    isLoading: notificationReadsLoading,
    markAsRead,
    dispensar: dispensarAvisos,
    isDispensando,
  } = useCatalogNotificationReads(user?.id ?? null);
  /**
   * A seção aberta — **na URL, e não em estado local**.
   *
   * ## ⚠️ O bug que isto conserta
   *
   * Havia duas verdades: `section` em `useState` e `?section=` na URL, com um
   * efeito copiando a URL para o estado a cada mudança de `searchParams`. A
   * navegação pela barra lateral mexia só no estado, então a URL guardava a
   * seção **anterior** — e qualquer escrita na URL (abrir um pedido, por
   * exemplo) fazia o efeito disparar e jogar a pessoa de volta para lá.
   *
   * Na prática: quem chegava em Pedidos vindo de um aviso e clicava num cartão
   * era levado para Notificações, porque era isso que ainda estava em
   * `?section=`.
   *
   * Uma verdade só. E de graça: recarregar a página mantém a seção, e o link
   * pode ser colado.
   */
  const secaoNaUrl = searchParams.get("section");
  const section: ClientSection = ehSecaoDoCliente(secaoNaUrl) ? secaoNaUrl : "resumo";

  /**
   * Troca de seção.
   *
   * ⚠️ **Uma escrita só nos parâmetros.** Chamar `setSearchParams` duas vezes no
   * mesmo evento faz a segunda partir dos parâmetros **antigos** e apagar o que
   * a primeira gravou — foi assim que o menu do painel deixou de sair do
   * Dashboard, em agosto. Aqui a seção e o pedido aberto mudam juntos.
   */
  const setSection = useCallback(
    (proxima: ClientSection) => {
      setSearchParams(
        (atuais) => {
          const copia = new URLSearchParams(atuais);
          if (proxima === "resumo") copia.delete("section");
          else copia.set("section", proxima);
          // Sair de Pedidos com um detalhe aberto e voltar depois reabriria o
          // mesmo pedido, sem ninguém ter pedido.
          copia.delete("pedido");
          return copia;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  /**
   * Qual pedido está aberto em tela cheia. `null` = a lista.
   *
   * ⚠️ Vive na URL (`?pedido=`), e não só em estado: assim o botão voltar do
   * navegador fecha o detalhe em vez de sair da conta, e o link de um pedido
   * pode ser colado. É o mesmo que o painel faz com a seção.
   */
  const [pedidoAberto, setPedidoAberto] = useEtapaNaUrl("pedido");

  /**
   * Leva ao destino de um aviso.
   *
   * ⚠️ Os avisos guardam `/conta?section=pedidos` — um caminho **desta mesma
   * página**. Seguir por `window.location` recarregaria o app inteiro para
   * chegar a uma aba que já está montada. Quando o destino é de fora, aí sim o
   * navegador cuida.
   */
  /**
   * Marca um aviso como lido.
   *
   * ⚠️ **Avisa quando falha.** Era `markAsRead(id).catch(() => null)` — o
   * `catch` mudo existia para o clique não virar um alerta vermelho, e engoliu
   * a única pista de que o `upsert` falhava **sempre**: faltava o índice único
   * em `(user_id, notification_id)` que o `onConflict` exige. Ninguém marcou
   * nada como lido desde que a tela existe, e a tela nunca disse nada.
   *
   * Falha de rede continua sendo possível; agora ela aparece.
   */
  const marcarLido = useCallback(
    async (id: string) => {
      try {
        await markAsRead(id);
      } catch {
        toast.error("Não foi possível marcar como lido.", {
          description: "Tente de novo em instantes.",
        });
      }
    },
    [markAsRead],
  );

  const irParaDestinoDoAviso = useCallback((url: string | null | undefined) => {
    const destino = (url ?? "").trim();
    if (!destino) return;

    const daPropriaConta = /^\/conta(?:\?section=([\w-]+))?/.exec(destino);
    if (daPropriaConta) {
      const alvo = daPropriaConta[1] as ClientSection | undefined;
      if (alvo) setSection(alvo);
      return;
    }

    window.location.assign(destino);
    // `setSection` entra na lista: ele deixou de ser o setter estável do
    // `useState` e virou um `useCallback` que depende de `setSearchParams`.
    // Sem isto, um dia ele fecharia sobre uma versão velha.
  }, [setSection]);
  /**
   * A mesma variavel significa duas coisas, e por isso o valor inicial nao pode
   * ser um so.
   *
   * No desktop `true` e "barra lateral expandida" contra "estreita" — nos dois
   * casos ela esta a vista, e expandida e o certo para comecar. No celular a
   * barra vira gaveta sobre o conteudo, e `true` a **abre**. Com `useState(true)`
   * fixo, entrar em `/conta` pelo celular abria o menu por cima da tela.
   */
  const ehDesktop = () =>
    typeof window === "undefined" || window.matchMedia("(min-width: 1024px)").matches;
  const [sidebarOpen, setSidebarOpen] = useState(ehDesktop);

  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editCnpj, setEditCnpj] = useState("");
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
    setAccountName(customerProfile?.name?.trim() || user?.user_metadata?.name?.trim() || "");
  }, [customerProfile?.name, user?.id, user?.user_metadata?.name]);

  useEffect(() => {
    setEditName(customerProfile?.name?.trim() || user?.user_metadata?.name?.trim() || "");
    setEditPhone(customerProfile?.phone?.trim() || user?.user_metadata?.phone?.trim() || "");
    setEditCompany(customerProfile?.company?.trim() || user?.user_metadata?.company?.trim() || "");
    setEditCnpj(customerProfile?.cnpj?.trim() || user?.user_metadata?.cnpj?.trim() || "");
  }, [
    customerProfile?.cnpj,
    customerProfile?.company,
    customerProfile?.name,
    customerProfile?.phone,
    user?.id,
    user?.user_metadata?.cnpj,
    user?.user_metadata?.company,
    user?.user_metadata?.name,
    user?.user_metadata?.phone,
  ]);

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
    const effectiveCnpj = customerProfile.linked_company_cnpj
      ? onlyDigits(customerProfile.linked_company_cnpj)
      : onlyDigits(customerProfile.cnpj);
    return (orders as Order[]).filter((order) => onlyDigits(order.customer_cnpj) === effectiveCnpj);
  }, [orders, customerProfile]);
  const orderEnrichment = useMemo(() => buildOrderEnrichmentMaps(products), [products]);
  const orderViews = useMemo(
    () =>
      customerOrders.map((order, indice) => {
        const lines = parseOrderTableLines(order.items, orderEnrichment);
        return {
          order,
          lines,
          // O numero e a **posicao na lista**, contada do mais novo para o mais
          // antigo — o mesmo criterio do painel. Nasce aqui, e nao na tela do
          // detalhe, para o cartao e o detalhe nao poderem discordar.
          numero: customerOrders.length - indice,
          totalItems: getOrderLinesQuantityTotal(lines),
          totalValue: getOrderLinesGrandTotal(lines),
        };
      }),
    [customerOrders, orderEnrichment],
  );
  /**
   * O pedido aberto, já com o número que a lista mostra.
   *
   * O número é a **posição na lista**, e não um campo do pedido — é o mesmo
   * critério do painel, para as duas telas chamarem o mesmo pedido pelo mesmo
   * nome.
   */
  const pedidoEmFoco = useMemo(
    () => (pedidoAberto ? orderViews.find((item) => item.order.id === pedidoAberto) ?? null : null),
    [orderViews, pedidoAberto],
  );

  const totalSpent = useMemo(
    () => orderViews.reduce((sum, item) => sum + item.totalValue, 0),
    [orderViews],
  );
  const readNotificationIds = useMemo(
    () => new Set(notificationReads.map((item) => item.notification_id)),
    [notificationReads],
  );
  /**
   * Os avisos que esta pessoa tirou da própria lista.
   *
   * A notificação continua existindo — ela é da loja e vale para todo mundo. O
   * que é por pessoa é o `dispensado_em`; ver a migration `20260901180000`.
   */
  const dismissedNotificationIds = useMemo(
    () => new Set(notificationReads.filter((item) => item.dispensado_em).map((item) => item.notification_id)),
    [notificationReads],
  );
  const notificationsWithState = useMemo(
    () =>
      [...notifications]
        .filter((item) => !dismissedNotificationIds.has(item.id))
        .map((item) => ({ ...item, isRead: readNotificationIds.has(item.id) }))
        .sort((left, right) => {
          const readOrder = Number(left.isRead) - Number(right.isRead);
          if (readOrder !== 0) return readOrder;
          return right.priority - left.priority || right.created_at.localeCompare(left.created_at);
        }),
    [notifications, readNotificationIds, dismissedNotificationIds],
  );
  const unreadNotificationCount = useMemo(
    () => notificationsWithState.filter((item) => !item.isRead).length,
    [notificationsWithState],
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
      <SectionHeader
        eyebrow="Minha conta"
        title="Resumo da conta"
        description="Tenha uma leitura rápida do estado da conta, do acesso e do histórico do cliente."
      />

      {/* Uma coluna no celular: os valores aqui sao e-mail, empresa e
          documento — cadeia longa que, em duas colunas de ~170px,
          quebra em tres ou quatro linhas e desalinha os cartoes. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoTile
          label="E-mail"
          value={user.email || "—"}
          hint="Endereço usado no login do cliente."
          icon={Mail}
          onClick={() => setSection("seguranca")}
          acaoLabel="Trocar e-mail"
        />
        <InfoTile
          label="Status"
          value={customerProfile ? "Conta ativa" : "Cadastro em processamento"}
          hint={customerProfile ? "Seu cadastro já está vinculado à área do cliente." : "Aguarde a finalização do cadastro."}
          icon={ShieldCheck}
        />
        {/* "Perfil" nao dizia nada, e a dica falava em "regras de visualizacao" —
            nenhuma das duas deixava claro que o valor ali e Lojista/Cliente/
            Distribuidor nem que e ele que decide o preco que a pessoa ve. */}
        <InfoTile
          label="Tipo de cliente"
          value={displayCustomerType}
          hint="Define a tabela de preço aplicada aos produtos do catálogo."
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
        {/* ⚠️ Clicáveis **só quando há pedido**. Um cartão que abre uma lista
            vazia é pior que um cartão parado: promete e não entrega. */}
        <InfoTile
          label="Pedidos"
          value={`${orderViews.length} pedido(s)`}
          hint="Histórico liberado para acompanhamento do cliente."
          icon={ShoppingBag}
          onClick={orderViews.length > 0 ? () => setSection("pedidos") : undefined}
          acaoLabel="Ver meus pedidos"
        />
        <InfoTile
          label="Valor total"
          value={orderViews.length > 0 ? formatBRL(totalSpent) : "—"}
          hint="Soma dos pedidos encontrados."
          icon={ShoppingBag}
          onClick={orderViews.length > 0 ? () => setSection("pedidos") : undefined}
          acaoLabel="Ver meus pedidos"
        />
        <InfoTile
          label="Último pedido"
          value={orderViews[0] ? formatDateTime(orderViews[0].order.created_at) : "—"}
          hint="Data do pedido mais recente vinculado à conta."
          icon={CalendarClock}
          onClick={orderViews[0] ? () => setSection("pedidos") : undefined}
          acaoLabel="Abrir o último pedido"
        />
      </div>

      {/* O texto anterior era passivo — "assim que os dados forem vinculados" —
          e nao havia nada para fazer na tela. So que **nao e automatico**: sem
          perfil, a secao Empresa mostra o formulario que cria o cadastro, e sem
          esse aviso a pessoa ficava esperando por algo que nunca ia acontecer
          sozinho. Nao ha gatilho no banco criando perfil; quem cria e este
          formulario ou o cadastro completo da tela de login. */}
      {!customerProfile ? (
        <EmptyPanel
          title="Falta completar seu cadastro"
          description="Seu acesso já existe, mas os dados do cliente — empresa, CNPJ e telefone — ainda não foram informados. É o que libera pedidos, endereços e tabela de preço."
          action={
            <Button type="button" className="rounded-full px-4" onClick={() => setSection("empresa")}>
              Completar cadastro
            </Button>
          }
        />
      ) : null}
    </div>
  );

  const companyContent = (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader
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
                setEditCnpj(customerProfile.cnpj);
                setEditingProfile(true);
              }}
              className="h-10 rounded-2xl px-4 text-xs sm:h-9"
            >
              {/* ⚠️ Só abre — não alterna mais.
                  Era o mesmo botão dizendo "Editar" e depois "Cancelar": e
                  cancelar o quê, se nada foi mudado ainda? Quem desiste fecha o
                  diálogo (Esc, clique fora ou o botão lá dentro). */}
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Editar
            </Button>
          ) : undefined
        }
      />

      {customerProfile ? (
        <>
          {/* Uma coluna no celular: os valores aqui sao e-mail, empresa e
              documento — cadeia longa que, em duas colunas de ~170px,
              quebra em tres ou quatro linhas e desalinha os cartoes. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2">
            <InfoTile label="Nome" value={customerProfile.name || "—"} icon={UserRound} />
            <InfoTile
              label="Empresa"
              value={
                <NomeDaEmpresa
                  company={customerProfile.company}
                  cnpj={customerProfile.cnpj}
                  isMei={customerProfile.is_mei}
                />
              }
              icon={Building2}
            />
            <InfoTile label="Telefone" value={formatPhone(customerProfile.phone) || "—"} icon={Phone} />
            <InfoTile label="Documento" value={formatDocumentId(customerProfile.cnpj)} icon={Building2} />
          </div>

          {customerProfile.linked_company_cnpj ? (
            <div className="rounded-[1.25rem] border border-primary/15 bg-primary/5 p-4">
              <p className="text-sm font-medium text-foreground">
                Funcionário vinculado à Clinic+
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Seus pedidos são emitidos em nome de Clinic+ (CNPJ {formatDocumentId(customerProfile.linked_company_cnpj)}).
                A empresa vinculada é gerenciada pelo administrador da plataforma.
              </p>
            </div>
          ) : null}

          {/* ⚠️ **O número da tabela não aparece mais.**

              Dizia "você está habilitado na tabela #8728". `8728` é um
              identificador do ERP: não significa nada para quem compra, não dá
              para conferir contra nada, e expõe a numeração interna a quem
              está do lado de fora. Quem lê quer saber **por que** o preço é
              aquele — e a resposta é o tipo de conta, não um número.

              E o bloco só aparecia com tabela negociada. Sem ela, o cliente
              não via nada — embora o tipo continue decidindo o preço dele. É a
              mesma frase para os dois casos porque, do lado de quem compra, é
              a mesma situação. */}
          <div className="rounded-[1.25rem] border border-primary/15 bg-primary/5 p-4">
            <p className="text-sm font-medium text-foreground">Seus preços</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Você está cadastrado como <strong>{displayCustomerType}</strong>. Os preços do catálogo já saem com a
              condição do seu tipo de conta aplicada.
            </p>
          </div>

          <div className="rounded-[1.25rem] bg-background/95 border border-border/70 p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <MapPinned className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Endereço da empresa</h2>
            </div>

            {/* Dizer de onde vem evita a leitura errada: sem isto, alguem
                olha um endereco que nao reconhece e conclui que o cadastro
                esta furado — quando e o registro oficial da empresa, que
                costuma ser a sede e nao o lugar onde a encomenda chega. */}
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Endereço de registro da empresa, buscado na Receita pelo CNPJ. Para escolher onde
              receber os pedidos, use <strong className="font-medium text-foreground">Meus endereços</strong>.
            </p>

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
                  title="Endereço não encontrado na Receita"
                  description="Este é o endereço de registro da empresa, buscado pelo CNPJ. Para escolher onde receber os pedidos, use Meus endereços."
                />
              </div>
            )}
          </div>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSavingProfile(true);
            try {
              const documentDigits = onlyDigits(editCnpj);
              const isDocumentValid = isValidCpf(documentDigits) || isValidCnpj(documentDigits);
              if (!isDocumentValid) {
                toast.error("Informe um CPF ou CNPJ válido.");
                setSavingProfile(false);
                return;
              }

              const error = await registerCustomerProfile({
                name:
                  accountName.trim() ||
                  user?.user_metadata?.name?.trim() ||
                  user?.email?.split("@")[0]?.trim() ||
                  "",
                phone: editPhone.trim(),
                company: editCompany.trim(),
                cnpj: documentDigits,
                customer_type: DEFAULT_CUSTOMER_TYPE,
              });

              if (error) throw error;

              toast.success("Cadastro concluído");
              if (user) await refreshCustomerProfile(user.id);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Erro ao concluir cadastro");
            } finally {
              setSavingProfile(false);
            }
          }}
          className="rounded-[1.25rem] bg-background/95 border border-border/70 p-5 shadow-sm sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-foreground">Complete seu cadastro</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Telefone</Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(formatPhone(onlyDigits(e.target.value)))}
                className="h-10 rounded-2xl text-[0.8125rem]"
                inputMode="numeric"
                type="tel"
                placeholder="(00) 00000-0000"
                onKeyDown={(e) => {
                  const allowedKeys = [
                    "Backspace",
                    "Delete",
                    "Tab",
                    "ArrowLeft",
                    "ArrowRight",
                    "Home",
                    "End",
                    "Enter",
                  ];
                  if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
                  if (!/^\d$/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Empresa</Label>
              <Input value={editCompany} onChange={(e) => setEditCompany(e.target.value)} className="h-10 rounded-2xl text-[0.8125rem]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Documento</Label>
              <Input
                value={formatDocumentId(editCnpj)}
                onChange={(e) => setEditCnpj(formatDocumentId(e.target.value))}
                className="h-10 rounded-2xl text-[0.8125rem]"
                inputMode="numeric"
                maxLength={18}
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>

          <p className="text-[0.6875rem] leading-5 text-muted-foreground">
            Depois de salvar, você poderá editar os endereços na aba própria e acompanhar pedidos vinculados ao mesmo documento.
            O nome da conta é ajustado em <strong>Dados da conta</strong>.
          </p>

          <div className="flex justify-end">
            <Button type="submit" disabled={savingProfile} className="h-10 sm:h-9 rounded-full px-5 text-[0.8125rem]">
              {savingProfile ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Salvar cadastro
            </Button>
          </div>
        </form>
      )}

      {/* ⚠️ Diálogo, e não troca de tela.
          Clicar em "Editar" substituía a visão inteira pelo formulário — os
          dados que se queria conferir sumiam justamente na hora de corrigi-los,
          e a única saída era um botão "Cancelar" que parecia desfazer algo. O
          diálogo mantém os dados atrás e sai com Esc, clique fora ou Cancelar. */}
      <Dialog open={editingProfile} onOpenChange={setEditingProfile}>
        <DialogContent className="max-h-[92dvh] w-[min(96vw,32rem)] overflow-y-auto rounded-[1.35rem] border-border/70 p-0 sm:rounded-[1.75rem]">
          <DialogHeader className="px-5 pt-5 text-left">
            <DialogDescription className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary">
              Empresa
            </DialogDescription>
            <DialogTitle className="text-xl font-semibold tracking-tight">Editar dados da empresa</DialogTitle>
          </DialogHeader>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSavingProfile(true);
          try {
            const documentDigits = onlyDigits(editCnpj);
            const isDocumentValid = isValidCpf(documentDigits) || isValidCnpj(documentDigits);
            if (!isDocumentValid) {
              toast.error("Informe um CPF ou CNPJ válido.");
              setSavingProfile(false);
              return;
            }

            const { error } = await supabase.rpc("update_own_customer_profile", {
              p_phone: editPhone.trim(),
              p_company: editCompany.trim(),
              p_cnpj: documentDigits,
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
        className="space-y-4 px-5 pb-2"
      >
        <div className="space-y-2">
          <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Telefone</Label>
          <Input
            value={editPhone}
            onChange={(e) => setEditPhone(formatPhone(onlyDigits(e.target.value)))}
            className="h-10 rounded-2xl text-[0.8125rem]"
            inputMode="numeric"
            type="tel"
            placeholder="(00) 00000-0000"
            onKeyDown={(e) => {
              const allowedKeys = [
                "Backspace",
                "Delete",
                "Tab",
                "ArrowLeft",
                "ArrowRight",
                "Home",
                "End",
                "Enter",
              ];
              if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
              if (!/^\d$/.test(e.key)) {
                e.preventDefault();
              }
            }}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Empresa</Label>
          <Input value={editCompany} onChange={(e) => setEditCompany(e.target.value)} className="h-10 rounded-2xl text-[0.8125rem]" />
        </div>
        <div className="space-y-2">
          <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Documento</Label>
          <Input
            value={formatDocumentId(editCnpj)}
            onChange={(e) => setEditCnpj(formatDocumentId(e.target.value))}
            className="h-10 rounded-2xl text-[0.8125rem]"
            inputMode="numeric"
            maxLength={18}
            placeholder="00.000.000/0000-00"
          />
        </div>
        <p className="text-[0.6875rem] leading-5 text-muted-foreground">
          O nome da conta pode ser alterado na seção de configurações. Aqui ficam os dados comerciais do cadastro.
        </p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-4">
          {/* Cancelar à esquerda, ação à direita — a ordem do resto do projeto. */}
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-2xl px-5 text-[0.8125rem]"
            onClick={() => setEditingProfile(false)}
            disabled={savingProfile}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={savingProfile} className="h-10 rounded-2xl px-5 text-[0.8125rem]">
            {savingProfile ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </form>
        </DialogContent>
      </Dialog>
    </div>
  );

  const addressesContent = <ClientAddressesSection />;

  const ordersContent = (
    // ⚠️ O detalhe **substitui** a seção, e não abre por cima dela.
    //
    // Um pedido de dezesseis linhas com endereço e histórico não cabe num
    // diálogo sem virar rolagem dentro de rolagem. É a mesma decisão do painel,
    // e pelo mesmo motivo.
    pedidoEmFoco ? (
      <ClientOrderDetail
        order={pedidoEmFoco.order}
        lines={pedidoEmFoco.lines}
        numeroDoPedido={pedidoEmFoco.numero}
        totalItems={pedidoEmFoco.totalItems}
        totalValue={pedidoEmFoco.totalValue}
        onVoltar={() => setPedidoAberto(null)}
      />
    ) : (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader
        eyebrow="Pedidos"
        title="Meus pedidos"
        description="Visualize os pedidos vinculados ao mesmo CNPJ do seu cadastro."
        actions={<Badge variant="secondary" className="rounded-full px-3 py-1 text-[0.6875rem] font-medium">{orderViews.length} encontrado(s)</Badge>}
      />

      {ordersLoading ? (
        <div className="space-y-3 rounded-[1.25rem] bg-background/95 border border-border/70 p-5 shadow-sm">
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
        // ⚠️ Paginado, como as listas do painel.
        //
        // Hoje o maior cliente tem 3 pedidos, então nada disso aparece — os
        // controles surgem sozinhos a partir do sexto. Mas quem compra todo mês
        // chega a 12 no primeiro ano: sem teto, a página cresce até virar uma
        // rolagem que não acaba, que foi o defeito de Funcionários no painel.
        <ListaComBusca
          itens={orderViews}
          porPagina={ITENS_POR_PAGINA_DO_CLIENTE}
          chaveDoItem={({ order }) => order.id}
          // Busca pelo número e pelo estado: é assim que se procura um pedido
          // de que se lembra pela metade.
          textoDoItem={({ order, numero }) => `#${numero} ${order.id} ${order.status ?? ""}`}
          buscaPlaceholder="Buscar pedido..."
          vazio="Nenhum pedido encontrado."
          renderizar={({ order, lines, numero, totalItems, totalValue }) => (
            <div className="py-2">
              <ClientOrderCard
                order={order}
                lines={lines}
                numero={numero}
                totalItems={totalItems}
                totalValue={totalValue}
                onAbrir={() => setPedidoAberto(order.id)}
              />
            </div>
          )}
        />
      ) : (
        <EmptyPanel
          title="Nenhum pedido encontrado"
          description="Quando um pedido for feito com o CNPJ do seu cadastro, ele vai aparecer aqui automaticamente."
        />
      )}
    </div>
    )
  );

  const securityContent = (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader
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
        className="rounded-[1.25rem] bg-background/95 border border-border/70 p-5 shadow-sm sm:p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <UserRound className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold text-foreground">Dados da conta</p>
        </div>

        {/* Uma coluna no celular: os valores aqui sao e-mail, empresa e
            documento — cadeia longa que, em duas colunas de ~170px,
            quebra em tres ou quatro linhas e desalinha os cartoes. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
          <InfoTile
            label="Usuário"
            value={displayName}
            hint="Conta vinculada ao acesso atual."
            icon={UserRound}
          />
          <InfoTile
            label="E-mail"
            value={user.email || "—"}
            hint="Alterado no bloco abaixo, com a sua senha."
            icon={Mail}
          />
          <InfoTile
            label="Acesso"
            value="Cliente B2B"
            hint="Área exclusiva do cliente."
            icon={ShieldCheck}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.6fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Nome
            </Label>
            <Input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Seu nome"
              className="h-10 rounded-2xl text-[0.8125rem]"
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={savingAccountName} className="h-10 rounded-full px-5 text-[0.8125rem]">
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
          // Politica unica em `src/lib/senha.ts` — as regras de composicao que
          // estavam aqui sao proibidas pela §10 do padrao de autenticacao.
          const validacaoDeSenha = await validarSenha(newPassword, { email: user?.email });
          if (!validacaoDeSenha.ok) {
      toast.error(validacaoDeSenha.problema!);
      return;
    }
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
        className="rounded-[1.25rem] bg-background/95 border border-border/70 p-5 shadow-sm sm:p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold text-foreground">Alterar senha</p>
        </div>

        <div className="space-y-2">
          <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Senha atual</Label>
          <div className="relative">
            <Input
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Sua senha atual"
              // Sem `autoComplete`, o gerenciador de senhas do navegador decide
              // sozinho o que preencher — e preenche escrevendo direto no DOM,
              // sem disparar o `onChange` do React. O campo mostra os pontinhos
              // e o estado continua vazio, o que fazia duas senhas iguais na
              // tela reprovarem em "Senhas nao conferem".
              autoComplete="current-password"
              maxLength={64}
              className="h-10 rounded-2xl pr-10 text-[0.8125rem]"
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
          <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Nova senha</Label>
          <div className="relative">
            <Input
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={`Mínimo ${MIN_SEM_MFA} caracteres`}
              autoComplete="new-password"
              maxLength={64}
              className="h-10 rounded-2xl pr-10 text-[0.8125rem]"
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
                      forcaDaSenha(newPassword, user?.email).score <= 1 ? "w-1/6 bg-red-400" :
                      forcaDaSenha(newPassword, user?.email).score <= 2 ? "w-1/3 bg-orange-400" :
                      forcaDaSenha(newPassword, user?.email).score <= 3 ? "w-1/2 bg-yellow-400" :
                      forcaDaSenha(newPassword, user?.email).score <= 4 ? "w-2/3 bg-yellow-400" :
                      forcaDaSenha(newPassword, user?.email).score <= 5 ? "w-5/6 bg-emerald-400" :
                      "w-full bg-emerald-400",
                    )}
                  />
                </div>
                <span className="text-[0.6875rem] font-medium text-muted-foreground">{forcaDaSenha(newPassword, user?.email).label}</span>
                <span className="ml-auto text-[0.6875rem] tabular-nums text-muted-foreground/60">{newPassword.length}/64</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {forcaDaSenha(newPassword, user?.email).checks.map((c) => (
                  <span key={c.label} className={cn("text-[0.6875rem]", c.ok ? "text-emerald-600" : "text-muted-foreground/60")}>
                    {c.ok ? "✓" : "○"} {c.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Confirmar nova senha</Label>
          <div className="relative">
            <Input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
              maxLength={64}
              className="h-10 rounded-2xl pr-10 text-[0.8125rem]"
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
          {/* Aviso enquanto digita, e nao so no envio.
              A divergencia aparecia como toast depois de clicar em "Alterar
              senha" — e, no bug do autofill, dizia que duas senhas visivelmente
              iguais nao conferiam, sem dar pista do que fazer. */}
          {confirmPassword.length > 0 && newPassword !== confirmPassword ? (
            <p className="text-[0.6875rem] text-destructive">As senhas não conferem.</p>
          ) : null}
          {confirmPassword.length > 0 && newPassword === confirmPassword ? (
            <p className="text-[0.6875rem] text-emerald-600">As senhas conferem.</p>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={savingPassword} className="h-10 sm:h-9 rounded-full px-5 text-[0.8125rem]">
            {savingPassword ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Alterar senha
          </Button>
        </div>
      </form>

      {/* Antes dos autenticadores: trocar e-mail é o que se procura com mais
          frequência, e é o mesmo componente que o painel usa — uma
          implementação só para um fluxo de segurança. */}
      <TrocarEmailSection />

      {/* Logo abaixo da troca de senha: quem veio cuidar do acesso encontra as
          duas coisas juntas, que é onde se olha ao desconfiar de invasão. */}
      <AutenticadoresSection />
      <AparelhosLembradosSection />

      {/* Por último e visualmente separado: é a única ação desta tela que não tem
          volta, e ela não pode ficar ao lado de "salvar telefone". */}
      <ExcluirContaSection />
    </div>
  );

  // A secao de mensagens e so o chat.
  //
  // Antes ela empilhava cabecalho de secao, cartao com o telefone do consultor e
  // o chat por ultimo — o fio ficava espremido no que sobrava. O contato do
  // consultor foi para dentro do proprio cabecalho do chat, que e onde ele e
  // util, e o resto da altura e do fio.
  const messagesContent = <ChatWorkspace mode="customer" />;

  const notificationsContent = (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader
        eyebrow="Comunicação"
        title="Notificações do catálogo"
        description="Atualizações dos seus pedidos, do atendimento e as novidades que o time publica."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {unreadNotificationCount > 0 ? (
              <Badge variant="default" className="rounded-full px-3 py-1 text-[0.6875rem] font-medium">
                {unreadNotificationCount} nova(s)
              </Badge>
            ) : null}
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[0.6875rem] font-medium">
              {notificationsWithState.length} ativa(s)
            </Badge>
            {/* ⚠️ Com confirmação: some tudo de uma vez e a tela não oferece
                volta. Mesma régua das outras ações destrutivas do projeto. */}
            {notificationsWithState.length > 0 ? (
              <ConfirmActionDialog
                title="Limpar suas notificações?"
                description={
                  <>
                    Os {notificationsWithState.length} avisos saem da <strong>sua</strong> lista.
                    Nada é apagado do catálogo, e avisos novos continuam chegando.
                  </>
                }
                confirmLabel="Limpar"
                processingLabel="Limpando…"
                destructive
                onConfirm={async () => {
                  try {
                    await dispensarAvisos(notificationsWithState.map((item) => item.id));
                    toast.success("Notificações limpas.");
                  } catch (erro) {
                    console.error("[conta] falha ao limpar avisos:", erro);
                    toast.error("Não foi possível limpar agora. Tente de novo.");
                    throw erro;
                  }
                }}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 rounded-2xl px-3 text-xs text-muted-foreground"
                    disabled={isDispensando}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Limpar
                  </Button>
                }
              />
            ) : null}
          </div>
        }
      />

      <PreferenciaDeCampanhas />

      {isNotificationsLoading ? (
        <div className="overflow-hidden rounded-[1.25rem] bg-background/95 border border-border/70 shadow-sm">
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
        // ⚠️ **Sem modal, e sem cartão gigante.**
        //
        // Cada aviso ocupava um bloco com faixa de imagem, três selos, título,
        // resumo, corpo cortado em duas linhas e um selo de ação — e o texto
        // completo só aparecia depois de abrir um diálogo. Um aviso de pedido é
        // uma frase; abrir uma janela para lê-la é cerimônia sobre nada.
        //
        // A forma é a do sino do painel, que resolve o mesmo problema: ícone em
        // círculo, título, uma linha de contexto, a hora. O texto inteiro fica à
        // vista porque cabe.
        <div className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-background/95 shadow-sm">
          <ListaComBusca
            itens={notificationsWithState}
            porPagina={ITENS_POR_PAGINA_DO_CLIENTE}
            chaveDoItem={(item) => item.id}
            textoDoItem={(item) => `${item.title} ${item.summary} ${item.body}`}
            buscaPlaceholder="Buscar aviso..."
            vazio="Nenhum aviso ainda."
            className="p-2"
            renderizar={(item) => {
              const quando = formatCompactDateTime(item.starts_at ?? item.created_at);

              return (
                <div
                  className={cn(
                    "flex gap-3 rounded-[1rem] p-3 transition-colors",
                    item.isRead ? "" : "bg-primary/[0.04]",
                  )}
                >
                  <IconeDoAviso tipo={item.tipo} className="h-10 w-10" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* O ponto no lugar do selo "Nova": um selo escrito tem o
                          peso de uma ação, e não-lido é só um estado. */}
                      {!item.isRead ? (
                        <span aria-label="Não lido" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      ) : null}
                      <RotuloDoAviso tipo={item.tipo} />
                      {quando ? (
                        <span className="text-[0.6875rem] text-muted-foreground">
                          {quando.datePart} às {quando.timePart}
                        </span>
                      ) : null}
                    </div>

                    <p
                      className={cn(
                        "mt-1 text-sm text-foreground",
                        item.isRead ? "font-medium" : "font-semibold",
                      )}
                    >
                      {item.title}
                    </p>

                    {/* Sem `line-clamp`: o texto inteiro cabe, e era ele que o
                        modal existia para mostrar. */}
                    {item.body ? (
                      <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{item.body}</p>
                    ) : item.summary ? (
                      <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {/* A ação vira botão de verdade e leva direto ao destino.
                          Antes era um selo cinza que não clicava — o clique
                          abria o modal, e o botão de verdade estava lá dentro. */}
                      {item.cta_url ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-2xl px-3 text-xs"
                          onClick={() => {
                            if (!item.isRead) void marcarLido(item.id);
                            irParaDestinoDoAviso(item.cta_url);
                          }}
                        >
                          {item.cta_label || "Abrir"}
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      ) : null}

                      {!item.isRead ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 rounded-2xl px-3 text-xs text-muted-foreground"
                          onClick={() => void marcarLido(item.id)}
                        >
                          Marcar como lido
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            }}
          />
        </div>
      ) : (
        <EmptyPanel
          title="Nenhuma notificação ativa"
          description="Quando um pedido seu mudar de estado ou o time publicar uma novidade, o aviso aparece aqui."
        />
      )}

    </div>
  );

  return (
    <ClientWorkspaceShell
      section={section}
      title={sectionTitle[section]}
      conteudoCheio={section === "mensagens"}
      onSectionChange={(proxima) => {
        setSection(proxima);
        // No celular a gaveta cobre o conteudo: deixa-la aberta depois de
        // escolher esconderia justamente a secao que a pessoa acabou de pedir.
        // No desktop nao se fecha nada — a barra lateral e permanente.
        if (!ehDesktop()) setSidebarOpen(false);
        window.scrollTo({ top: 0, behavior: "auto" });
      }}
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
      {section === "meus-dados" && <MeusDadosSection />}
    </ClientWorkspaceShell>
  );
}
