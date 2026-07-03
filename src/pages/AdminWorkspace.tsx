import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LockKeyhole, LogOut, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AdminAuthStage } from "@/components/auth/AdminAuthStage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AuthStatusScreen } from "@/components/auth/AuthStatusScreen";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { useAdminProductTypes, type ProductType } from "@/hooks/useAdminProductTypes";
import {
  getProductTypes,
  PRODUCTS_TABLE,
  PRODUCT_TYPES_TABLE,
  getProductImageUrls,
  buildOrderEnrichmentMaps,
  buildProductDbPayload,
  isMissingImageUrlsColumnError,
  isMissingProductCodeColumnError,
  isMissingPromotionColumnError,
  omitProductCode,
  omitProductPromotion,
  type Product,
} from "@/lib/products";
import {
  coercePrice,
  formatBRL,
  normalizePriceInputDraft,
  parsePriceInput,
  priceToAdminInput,
} from "@/lib/formatMoney";
import { uploadProductImageFile } from "@/lib/productImageStorage";
import { ORDERS_TABLE } from "@/lib/orders";
import { downloadOrderPdf, downloadOrderXlsx, downloadProxisImportTxt } from "@/lib/orderExport";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isRichTextEmpty, sanitizeRichText } from "@/lib/richText";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { AdminDashboardSection } from "@/components/admin/AdminDashboardSection";
import { AdminBannersSection } from "@/components/admin/AdminBannersSection";
import { AdminNotificationsSection } from "@/components/admin/AdminNotificationsSection";
import { AdminProductsSection } from "@/components/admin/AdminProductsSection";
import { AdminPricingSection } from "@/components/admin/AdminPricingSection";
import { AdminOrdersSection } from "@/components/admin/AdminOrdersSection";
import { AdminClientsSection } from "@/components/admin/AdminClientsSection";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { SupportChatPanel } from "@/components/support/SupportChatPanel";
import { CUSTOMER_PROFILES_TABLE, type CustomerProfile } from "@/lib/customerProfile";
import {
  CUSTOMER_TYPE_OVERRIDES_TABLE,
  buildCustomerTypeOverrideMap,
  type CustomerTypeOverride,
  normalizeCustomerCnpj,
} from "@/lib/customerTypeOverrides";
import { normalizeCustomerType, type CustomerType } from "@/lib/pricing";
import { onlyDigits } from "@/lib/brazilianIds";
import type {
  AdminCustomerSummary,
  AdminDashboardOrder,
  AdminOrderRow,
  AdminOrderSummaryLine,
  AdminProductFormState,
  AdminSection,
} from "@/components/admin/adminTypes";

const AUTH_FEEDBACK_MIN_MS = 700;

function LoginField({
  id,
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  autoComplete,
  required = false,
  icon: Icon,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type: string;
  autoComplete: string;
  required: boolean;
  icon: typeof Mail;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <span className="pointer-events-none absolute left-10 top-1/2 h-7 w-px -translate-y-1/2 bg-border/80" />
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className="h-12 rounded-2xl border-border/70 bg-background pl-14 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30"
        />
      </div>
    </div>
  );
}

function LoginForm({
  onLogin,
  helperMessage,
}: {
  onLogin: (email: string, password: string) => Promise<Error | null>;
  helperMessage?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const startedAt = Date.now();
    setLoading(true);
    const error = await onLogin(email, password);
    if (error) setLoginError(error.message || "Não foi possível autenticar.");
    const elapsed = Date.now() - startedAt;
    if (elapsed < AUTH_FEEDBACK_MIN_MS) {
      await new Promise((resolve) => window.setTimeout(resolve, AUTH_FEEDBACK_MIN_MS - elapsed));
    }
    setLoading(false);
  };

  return (
    <AdminAuthStage>
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2.25rem] border border-border/70 bg-background text-foreground shadow-[0_16px_40px_rgba(16,24,40,0.08)]">
        <div className="border-b border-border/70 px-6 py-7 sm:px-8">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-primary/25 bg-primary/5 shadow-[0_8px_22px_rgba(16,24,40,0.05)]">
            <img src="/faviconV2.png" alt="Clinic+ logo" className="h-14 w-auto" />
          </div>

          <div className="mt-5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary">Acesso interno</p>
            <h2 className="mt-3 text-[clamp(1.9rem,2.8vw,2.7rem)] font-black leading-[1] tracking-[-0.05em] text-foreground">
              Entrar no painel administrativo
            </h2>
            <p className="mx-auto mt-3 max-w-[32ch] text-sm leading-6 text-muted-foreground">
              Use seu acesso de administrador para abrir o painel do Clinic+.
            </p>
            {helperMessage ? (
              <div className="mx-auto mt-4 max-w-[30rem] rounded-[1.25rem] border border-primary/15 bg-primary/5 px-4 py-3 text-left text-sm leading-6 text-foreground">
                {helperMessage}
              </div>
            ) : null}

            {loginError ? (
              <div className="mx-auto mt-4 max-w-[30rem] rounded-[1.25rem] border border-destructive/20 bg-destructive/5 px-4 py-3 text-left text-sm leading-6 text-foreground">
                {loginError}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 sm:px-8">
          <form
            onSubmit={handleSubmit}
            className="flex min-h-full flex-col space-y-4 rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]"
          >
            <LoginField
              id="admin-email"
              label="E-mail corporativo"
              placeholder="seu@empresa.com"
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="email"
              required
              icon={Mail}
            />

            <LoginField
              id="admin-password"
              label="Senha"
              placeholder="Sua senha"
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete="current-password"
              required
              icon={LockKeyhole}
            />

            <div className="flex items-center justify-between gap-4 text-[12.5px]">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
                <Checkbox className="h-4 w-4 border-primary data-[state=checked]:bg-primary" />
                Lembrar acesso
              </label>
              <a href="#" className="text-primary transition-colors hover:text-primary/80">
                Esqueceu a senha
              </a>
            </div>

            <Button type="submit" className="h-12 w-full rounded-2xl text-[15px] font-semibold" disabled={loading}>
              {loading ? "Autenticando..." : "Entrar"}
            </Button>

            <div className="flex items-center justify-center gap-2 pt-1 text-[12px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Ambiente seguro - acesso exclusivo do time interno
            </div>
          </form>
        </div>
      </div>
    </AdminAuthStage>
  );
}

function ClientAccessNotice({
  email,
  onGoCatalog,
  onLogout,
}: {
  email: string | null;
  onGoCatalog: () => void;
  onLogout: () => void;
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
                Você está logado como cliente
              </h1>
            </div>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-primary/15 bg-primary/5 p-5 text-sm leading-6 text-foreground">
            {email
              ? `Você está logado como ${email}. Para acessar o painel, entre com uma conta administrativa.`
              : "Você está com uma sessão de cliente ativa. Para acessar o painel, entre com uma conta administrativa."}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button type="button" className="h-11 rounded-2xl px-5 text-sm" onClick={onGoCatalog}>
              Ir ao catálogo
            </Button>
            <ConfirmActionDialog
              trigger={
                <Button type="button" variant="outline" className="h-11 rounded-2xl px-5 text-sm">
                  <LogOut className="h-4 w-4" />
                  Sair da conta
                </Button>
              }
              title="Sair da conta"
              description="Deseja encerrar a sessão atual? Você vai precisar entrar novamente para voltar ao painel."
              confirmLabel="Sair"
              destructive
              onConfirm={onLogout}
            />
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border/70 pt-4 text-sm">
            <Link to="/conta" viewTransition className="text-muted-foreground transition-colors hover:text-foreground">
              Ir para minha conta
            </Link>
            <span className="text-[12px] text-muted-foreground">
              Se precisar do painel administrativo, use uma conta com role de admin.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function isOrderLineSummary(value: unknown): value is AdminOrderSummaryLine {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.unitPrice === "number" && typeof candidate.quantity === "number";
}

function summarizeOrderItems(items: unknown): AdminOrderSummaryLine[] {
  if (!Array.isArray(items)) return [];
  return items.filter(isOrderLineSummary);
}

export default function AdminWorkspace() {
  const { user, isAdmin, loading, isResolvingAccess, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: products = [], isLoading } = useProducts({ includeInactive: true });
  const { data: orders = [], isLoading: ordersLoading } = useOrders(!loading && !!user && isAdmin, "admin");
  const { data: adminTypes = [] } = useAdminProductTypes();
  const { data: customerProfiles = [] } = useQuery({
    queryKey: ["admin-customer-profiles"],
    enabled: Boolean(user && isAdmin),
    queryFn: async () => {
      const { data, error } = await supabase
        .from(CUSTOMER_PROFILES_TABLE)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
        return (data ?? []) as CustomerProfile[];
    },
    staleTime: 30_000,
  });
  const { data: customerTypeOverrides = [] } = useQuery({
    queryKey: ["admin-customer-type-overrides"],
    enabled: Boolean(user && isAdmin),
    queryFn: async () => {
      const { data, error } = await supabase
        .from(CUSTOMER_TYPE_OVERRIDES_TABLE)
        .select("cnpj, customer_type, created_at, updated_at")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as CustomerTypeOverride[];
    },
    staleTime: 30_000,
  });
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminProductFormState | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newType, setNewType] = useState("");
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [orderSearch, setOrderSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<"all" | "orders" | "revenue">("all");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [proxisExportingId, setProxisExportingId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const orderEnrichment = useMemo(() => buildOrderEnrichmentMaps(products), [products]);
  const derivedTypes = useMemo(() => [...new Set(products.map((p) => p.type))].sort(), [products]);
  const customerTypeOverrideMap = useMemo(
    () => buildCustomerTypeOverrideMap(customerTypeOverrides),
    [customerTypeOverrides],
  );
  const orderRows = orders as unknown as AdminOrderRow[];
  const productSalesById = useMemo(() => {
    const counts = new Map<string, number>();

    for (const order of orderRows) {
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const productId = typeof record.product_id === "string" ? record.product_id.trim() : "";
        if (!productId) continue;
        const quantity = typeof record.quantity === "number" ? record.quantity : Number(record.quantity) || 0;
        counts.set(productId, (counts.get(productId) ?? 0) + Math.max(1, Math.trunc(quantity) || 1));
      }
    }

    return counts;
  }, [orderRows]);
  const filteredOrders = useMemo<AdminOrderRow[]>(() => {
    const term = orderSearch.trim().toLowerCase();
    if (!term) return orderRows;
    return orderRows.filter((order) => {
      const fields = [
        order.customer_name,
        order.customer_company ?? "",
        order.customer_phone ?? "",
        order.customer_cnpj ?? "",
        order.customer_observation ?? "",
        order.status,
        order.id,
      ].map((value) => String(value).toLowerCase());
      return fields.some((value) => value.includes(term));
    });
  }, [orderRows, orderSearch]);
  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => {
      const fields = [product.name, product.family, product.type, product.product_code ?? ""];
      return fields.some((value) => value.toLowerCase().includes(term));
    });
  }, [products, productSearch]);
  const recentOrders = useMemo(
    (): AdminDashboardOrder[] =>
      [...orderRows]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map((order) => ({
          id: order.id,
          created_at: order.created_at,
          customer_name: order.customer_name,
          customer_company: order.customer_company,
          customer_phone: order.customer_phone,
          customer_cnpj: order.customer_cnpj,
          customer_observation: order.customer_observation ?? null,
          status: order.status,
          total_items: order.total_items,
          proxis_import_id: order.proxis_import_id,
          items: summarizeOrderItems(order.items),
        })),
    [orderRows],
  );
  const customerSummaries = useMemo<AdminCustomerSummary[]>(() => {
    const customers = new Map<
      string,
      {
        userId: string | null;
        name: string;
        company: string | null | undefined;
        phone: string | null | undefined;
        cnpj: string | null | undefined;
        customerType: AdminCustomerSummary["customerType"];
        total: number;
        orders: number;
      }
    >();

    for (const profile of customerProfiles) {
      const key = onlyDigits(profile.cnpj) || profile.user_id;
      const overrideType = customerTypeOverrideMap.get(onlyDigits(profile.cnpj));
      customers.set(key, {
        userId: profile.user_id,
        name: profile.name,
        company: profile.company,
        phone: profile.phone,
        cnpj: profile.cnpj,
        customerType: normalizeCustomerType(overrideType ?? profile.customer_type),
        total: 0,
        orders: 0,
      });
    }

    for (const order of orderRows) {
      const key = onlyDigits(order.customer_cnpj) || order.customer_name;
      const current = customers.get(key);
      const orderTotal = summarizeOrderItems(order.items).reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

      if (!current) {
        customers.set(key, {
          userId: null,
          name: order.customer_name,
          company: order.customer_company,
          phone: order.customer_phone,
          cnpj: order.customer_cnpj,
          customerType: customerTypeOverrideMap.get(onlyDigits(order.customer_cnpj)) ?? null,
          total: orderTotal,
          orders: 1,
        });
      } else {
        current.total += orderTotal;
        current.orders += 1;
        current.name = current.name || order.customer_name;
        current.company = current.company || order.customer_company;
        current.phone = current.phone || order.customer_phone;
        current.cnpj = current.cnpj || order.customer_cnpj;
      }
    }

    return [...customers.values()].sort((a, b) => b.orders - a.orders || b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));
  }, [customerProfiles, customerTypeOverrideMap, orderRows]);
  const activeProductsCount = useMemo(() => products.filter((p) => p.active).length, [products]);
  const inactiveProductsCount = useMemo(() => products.filter((p) => !p.active).length, [products]);
  const pendingOrdersCount = useMemo(
    () => orderRows.filter((o) => o.status === "Separando" || o.status === "Processando").length,
    [orderRows],
  );
  const totalRevenue = useMemo(
    () =>
      orderRows.reduce(
        (sum, order) =>
          sum + summarizeOrderItems(order.items).reduce((inner, item) => inner + item.unitPrice * item.quantity, 0),
        0,
      ),
    [orderRows],
  );
  const averageOrderValue = useMemo(
    () => (orderRows.length > 0 ? totalRevenue / orderRows.length : 0),
    [orderRows.length, totalRevenue],
  );
  const customersWithOrdersCount = useMemo(
    () => customerSummaries.filter((customer) => customer.orders > 0).length,
    [customerSummaries],
  );
  const customersWithoutOrdersCount = useMemo(
    () => customerSummaries.filter((customer) => customer.orders === 0).length,
    [customerSummaries],
  );
  const recentCustomers = useMemo(
    () =>
      [...customerProfiles]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [customerProfiles],
  );
  const sectionTitle: Record<AdminSection, string> = {
    dashboard: "Dashboard",
    banners: "Banners do catálogo",
    notificacoes: "Notificações",
    produtos: "Produtos",
    precos: "Preços",
    pedidos: "Pedidos",
    clientes: "Clientes",
    mensagens: "Mensagens",
  };
  const typeOptions = adminTypes.length
    ? adminTypes.map((t) => t.name)
    : derivedTypes.length
      ? derivedTypes
      : getProductTypes();

  if ((!user && loading) || (!user && isResolvingAccess)) {
    return (
      <AuthStatusScreen
        eyebrow="Painel administrativo"
        title="Abrindo o painel"
        description="Estamos validando sua sessão administrativa antes de carregar os controles do sistema."
      />
    );
  }

  if (!user) {
    return <LoginForm onLogin={signIn} />;
  }

  if (!isAdmin) {
    return (
      <ClientAccessNotice
        email={user.email}
        onGoCatalog={() => navigate("/", { replace: true, viewTransition: true })}
        onLogout={async () => {
          await signOut();
          navigate("/login", { replace: true, viewTransition: true });
        }}
      />
    );
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["products"] });
  const refreshPricing = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-price-overrides"] });
    queryClient.invalidateQueries({ queryKey: ["customer-pricing"] });
  };
  const refreshTypes = () => queryClient.invalidateQueries({ queryKey: ["product-types"] });
  const refreshOrders = () => queryClient.invalidateQueries({ queryKey: ["orders"] });
  const updateCustomerType = async ({
    userId,
    cnpj,
    customerType,
  }: {
    userId: string | null;
    cnpj: string;
    customerType: CustomerType;
  }) => {
    const normalizedType = normalizeCustomerType(customerType);
    const normalizedCnpj = normalizeCustomerCnpj(cnpj);

    if (!normalizedCnpj) {
      return new Error("Não foi possível identificar o CNPJ deste cadastro.");
    }

    if (userId) {
      const { error: profileError } = await supabase
        .from(CUSTOMER_PROFILES_TABLE)
        .update({ customer_type: normalizedType } as never)
        .eq("user_id", userId);

      if (profileError) {
        return profileError;
      }
    }

    const { error: overrideError } = await supabase
      .from(CUSTOMER_TYPE_OVERRIDES_TABLE)
      .upsert({ cnpj: normalizedCnpj, customer_type: normalizedType }, { onConflict: "cnpj" });

    if (overrideError) {
      return overrideError;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-customer-profiles"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-customer-type-overrides"] }),
      queryClient.invalidateQueries({ queryKey: ["customer-pricing"] }),
    ]);

    return null;
  };

  const startNew = () => {
    setEditing({
      name: "",
      description: "",
      type: "Chá",
      family: "",
      image_urls: [],
      active: true,
      is_promotion: false,
      priceInput: "",
      productCode: "",
    });
    setIsNew(true);
  };

  const startEdit = (p: Product) => {
    setEditing({
      id: p.id,
      name: p.name,
      description: p.description,
      type: p.type,
      family: p.family.trim(),
      image_urls: getProductImageUrls(p),
      active: p.active,
      is_promotion: p.is_promotion,
      priceInput: priceToAdminInput(coercePrice(p.price)),
      productCode: p.product_code ?? "",
    });
    setIsNew(false);
  };

  const cancel = () => {
    setEditing(null);
    setIsNew(false);
  };

  const handleImageFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    const result = await uploadProductImageFile(file);
    setUploading(false);

    if (result.ok === false) {
      toast.error(result.message);
      return;
    }

    setEditing((prev) => {
      if (!prev) {
        toast.error("Abra ou crie um produto antes de enviar a foto.");
        return prev;
      }
      return { ...prev, image_urls: [...prev.image_urls, result.publicUrl] };
    });
    toast.success("Foto adicionada!");
  };

  const save = async () => {
    if (!editing || !editing.name || !editing.family) {
      toast.error("Preencha nome e família do produto.");
      return;
    }

    const description = isRichTextEmpty(editing.description) ? "" : sanitizeRichText(editing.description);
    const { withGallery, legacyOnly } = buildProductDbPayload({
      name: editing.name,
      description,
      type: editing.type,
      family: editing.family.trim(),
      image_urls: editing.image_urls.filter((u) => u.trim() !== ""),
      active: editing.active,
      is_promotion: editing.is_promotion,
      price: Math.max(0, parsePriceInput(editing.priceInput)),
      product_code: editing.productCode,
    });

    const persist = async (body: typeof withGallery | typeof legacyOnly) => {
      if (isNew) return supabase.from(PRODUCTS_TABLE).insert(body as never);
      return supabase.from(PRODUCTS_TABLE).update(body as never).eq("id", editing.id!);
    };

    const imageCount = editing.image_urls.filter((u) => u.trim() !== "").length;
    let body: typeof withGallery | typeof legacyOnly = withGallery;
    let { error } = await persist(body);
    if (error && isMissingImageUrlsColumnError(error.message)) {
      if (imageCount > 1) {
        toast.warning("Só a primeira foto foi salva. Execute supabase/APLICAR_NO_SUPABASE_image_urls.sql no Supabase para várias imagens.");
      }
      body = legacyOnly;
      ({ error } = await persist(body));
    }
    if (error && isMissingPromotionColumnError(error.message)) {
      toast.warning("Promoção não salva. Execute a migração da coluna is_promotion no Supabase e tente de novo.");
      body = omitProductPromotion(body) as typeof withGallery;
      ({ error } = await persist(body));
    }
    if (error && isMissingProductCodeColumnError(error.message)) {
      toast.warning("Código não salvo. Execute supabase/APLICAR_NO_SUPABASE_product_code.sql no Supabase e tente de novo.");
      body = omitProductCode(body) as typeof withGallery;
      ({ error } = await persist(body));
    }

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(isNew ? "Produto adicionado!" : "Produto atualizado!");
    cancel();
    refresh();
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from(PRODUCTS_TABLE).update({ active: !active } as never).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(active ? "Produto desativado" : "Produto ativado");
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from(PRODUCTS_TABLE).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Produto removido.");
    refresh();
  };

  const addType = async () => {
    const name = newType.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from(PRODUCT_TYPES_TABLE)
      .insert({ name } as never)
      .select("id,name,created_at")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewType("");
    toast.success("Tipo adicionado!");
    queryClient.setQueryData<ProductType[]>(["product-types"], (current = []) => {
      const next = [...current.filter((type) => type.name !== name), data ?? { id: name, name, created_at: new Date().toISOString() }];
      return next.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    });
    refreshTypes();
  };

  const deleteType = async (id: string) => {
    const { error } = await supabase.from(PRODUCT_TYPES_TABLE).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tipo removido.");
    queryClient.setQueryData<ProductType[]>(["product-types"], (current = []) =>
      current.filter((type) => type.id !== id),
    );
    refreshTypes();
  };

  const deleteOrder = async (id: string) => {
    const { error } = await supabase.from(ORDERS_TABLE).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pedido removido.");
    refreshOrders();
  };

  const exportProxisOrder = async (exportPayload: Parameters<typeof downloadProxisImportTxt>[0]) => {
    setProxisExportingId(exportPayload.id);
    try {
      const proxisId = await downloadProxisImportTxt(exportPayload);
      toast.success(`Arquivo Proxis gerado (ID ${proxisId}).`);
      refreshOrders();
    } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao exportar para Proxis.");
    } finally {
      setProxisExportingId(null);
    }
  };

  const formatDate = (value: string) => new Date(value).toLocaleString("pt-BR");
  const chatContent = <SupportChatPanel mode="admin" />;

  return (
    <AdminWorkspaceShell
      section={section}
      title={sectionTitle[section]}
      onSectionChange={setSection}
      onLogout={signOut}
      userLabel={user.email || "Administrador"}
      sidebarOpen={sidebarOpen}
      onSidebarToggle={() => setSidebarOpen((value) => !value)}
    >
      {section === "banners" && <AdminBannersSection />}
      {section === "notificacoes" && <AdminNotificationsSection />}

      {section === "dashboard" && (
        <AdminDashboardSection
          products={products}
          recentOrders={recentOrders}
          customerSummaries={customerSummaries}
          activeProductsCount={activeProductsCount}
          inactiveProductsCount={inactiveProductsCount}
          pendingOrdersCount={pendingOrdersCount}
          totalRevenue={totalRevenue}
          averageOrderValue={averageOrderValue}
          customersWithOrdersCount={customersWithOrdersCount}
          customersWithoutOrdersCount={customersWithoutOrdersCount}
          recentCustomers={recentCustomers}
          formatDate={formatDate}
          onGoToOrders={() => setSection("pedidos")}
          onGoToProducts={() => setSection("produtos")}
        />
      )}

      {section === "produtos" && (
        <AdminProductsSection
          isLoading={isLoading}
          allProducts={products}
          filteredProducts={filteredProducts}
          salesByProductId={productSalesById}
          editing={editing}
          isNew={isNew}
          productSearch={productSearch}
          onProductSearchChange={setProductSearch}
          onStartNew={startNew}
          onStartEdit={startEdit}
          onToggleActive={toggleActive}
          onRemove={remove}
          title="Catálogo e manutenção"
          typeOptions={typeOptions}
          newType={newType}
          onNewTypeChange={setNewType}
          adminTypes={adminTypes}
          uploading={uploading}
          fileInputRef={fileInputRef}
          onEditChange={setEditing}
          onAddType={addType}
          onDeleteType={deleteType}
          onFileChange={handleImageFile}
          onRemoveImageAt={(index) =>
            setEditing((prev) =>
              prev
                ? {
                    ...prev,
                    image_urls: prev.image_urls.filter((_, i) => i !== index),
                  }
                : prev,
            )
          }
          onSave={save}
          onCancel={cancel}
        />
      )}

      {section === "precos" && (
        <AdminPricingSection products={products} onRefreshPricing={refreshPricing} />
      )}

      {section === "pedidos" && (
        <AdminOrdersSection
          ordersLoading={ordersLoading}
          filteredOrders={filteredOrders}
          orderSearch={orderSearch}
          onOrderSearchChange={setOrderSearch}
          pendingOrdersCount={pendingOrdersCount}
          orderEnrichment={orderEnrichment}
          formatDate={formatDate}
          proxisExportingId={proxisExportingId}
          onExportProxis={exportProxisOrder}
          onExportXlsx={downloadOrderXlsx}
          onExportPdf={downloadOrderPdf}
          onDelete={deleteOrder}
        />
      )}

      {section === "clientes" && (
        <AdminClientsSection
          customerProfiles={customerProfiles}
          customerSummaries={customerSummaries}
          clientSearch={clientSearch}
          onClientSearchChange={setClientSearch}
          clientFilter={clientFilter}
          onClientFilterChange={setClientFilter}
          onUpdateCustomerType={updateCustomerType}
        />
      )}

      {section === "mensagens" && chatContent}
    </AdminWorkspaceShell>
  );
}
