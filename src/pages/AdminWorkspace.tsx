import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
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
import { useAdminProductTypes } from "@/hooks/useAdminProductTypes";
import {
  getProductTypes,
  PRODUCTS_TABLE,
  PRODUCT_TYPES_TABLE,
  getProductImageUrls,
  buildOrderEnrichmentMaps,
  buildProductDbPayload,
  isMissingImageUrlsColumnError,
  isMissingProductCodeColumnError,
  omitProductCode,
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
import { useQueryClient } from "@tanstack/react-query";
import { isRichTextEmpty, sanitizeRichText } from "@/lib/richText";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { AdminDashboardSection } from "@/components/admin/AdminDashboardSection";
import { AdminProductsSection } from "@/components/admin/AdminProductsSection";
import { AdminOrdersSection } from "@/components/admin/AdminOrdersSection";
import { AdminClientsSection } from "@/components/admin/AdminClientsSection";
import type {
  AdminCustomerSummary,
  AdminDashboardOrder,
  AdminOrderRow,
  AdminOrderSummaryLine,
  AdminProductFormState,
  AdminSection,
} from "@/components/admin/adminTypes";

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
  type?: string;
  autoComplete?: string;
  required?: boolean;
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
    setLoading(true);
    const error = await onLogin(email, password);
    if (error) setLoginError(error.message || "Não foi possível autenticar.");
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
                Esqueceu a senha?
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
  const { data: products = [], isLoading } = useProducts({ includeInactive: true });
  const { data: orders = [], isLoading: ordersLoading } = useOrders(!loading && !!user && isAdmin);
  const { data: adminTypes = [] } = useAdminProductTypes();
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
  const orderRows = orders as AdminOrderRow[];
  const filteredOrders = useMemo<AdminOrderRow[]>(() => {
    const term = orderSearch.trim().toLowerCase();
    if (!term) return orderRows;
    return orderRows.filter((order) => {
      const fields = [
        order.customer_name,
        order.customer_company,
        order.customer_phone,
        order.customer_cnpj,
        order.status,
        order.id,
      ];
      return fields.some((value) => value?.toLowerCase().includes(term));
    });
  }, [orderRows, orderSearch]);
  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => {
      const fields = [product.name, product.family, product.type, product.product_code ?? ""];
      return fields.some((value) => value?.toLowerCase().includes(term));
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
        name: string;
        company: string | null | undefined;
        phone: string | null | undefined;
        cnpj: string | null | undefined;
        total: number;
        orders: number;
      }
    >();

    for (const order of orderRows) {
      const key = order.customer_cnpj || order.customer_name;
      const current = customers.get(key);
      const orderTotal = summarizeOrderItems(order.items).reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

      if (!current) {
        customers.set(key, {
          name: order.customer_name,
          company: order.customer_company,
          phone: order.customer_phone,
          cnpj: order.customer_cnpj,
          total: orderTotal,
          orders: 1,
        });
      } else {
        current.total += orderTotal;
        current.orders += 1;
      }
    }

    return [...customers.values()].sort((a, b) => b.total - a.total || b.orders - a.orders);
  }, [orderRows]);
  const activeProductsCount = useMemo(() => products.filter((p) => p.active).length, [products]);
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
  const sectionTitle: Record<AdminSection, string> = {
    dashboard: "Dashboard",
    produtos: "Produtos",
    pedidos: "Pedidos",
    clientes: "Clientes",
  };
  const typeOptions = adminTypes.length
    ? adminTypes.map((t) => t.name)
    : derivedTypes.length
      ? derivedTypes
      : getProductTypes();

  if (loading || isResolvingAccess) {
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
      <LoginForm
        onLogin={signIn}
        helperMessage={
          user.email
            ? `Você está logado como ${user.email}. Se quiser acessar o painel, entre com a conta administrativa.`
            : "Você está com uma sessão ativa. Entre com a conta administrativa para acessar o painel."
        }
      />
    );
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["products"] });
  const refreshTypes = () => queryClient.invalidateQueries({ queryKey: ["product-types"] });
  const refreshOrders = () => queryClient.invalidateQueries({ queryKey: ["orders"] });

  const startNew = () => {
    setEditing({
      name: "",
      description: "",
      type: "Chá",
      family: "",
      image_urls: [],
      active: true,
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
      family: p.family,
      image_urls: getProductImageUrls(p),
      active: p.active,
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
    const file = e.target.files?.[0];
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
      family: editing.family,
      image_urls: editing.image_urls.filter((u) => u.trim() !== ""),
      active: editing.active,
      price: Math.max(0, parsePriceInput(editing.priceInput)),
      product_code: editing.productCode,
    });

    const persist = async (body: typeof withGallery | typeof legacyOnly) => {
      if (isNew) return supabase.from(PRODUCTS_TABLE).insert(body);
      return supabase.from(PRODUCTS_TABLE).update(body).eq("id", editing.id!);
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
    const { error } = await supabase.from(PRODUCTS_TABLE).update({ active: !active }).eq("id", id);
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
    const { error } = await supabase.from(PRODUCT_TYPES_TABLE).insert({ name });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewType("");
    toast.success("Tipo adicionado!");
    refreshTypes();
  };

  const deleteType = async (id: string) => {
    const { error } = await supabase.from(PRODUCT_TYPES_TABLE).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tipo removido.");
    refreshTypes();
  };

  const deleteOrder = async (id: string) => {
    const shouldDelete = window.confirm("Deseja remover este pedido?");
    if (!shouldDelete) return;
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
      {section === "dashboard" && (
        <AdminDashboardSection
          products={products}
          recentOrders={recentOrders}
          customerSummaries={customerSummaries}
          activeProductsCount={activeProductsCount}
          pendingOrdersCount={pendingOrdersCount}
          totalRevenue={totalRevenue}
          formatDate={formatDate}
          onGoToOrders={() => setSection("pedidos")}
          onGoToProducts={() => setSection("produtos")}
        />
      )}

      {section === "produtos" && (
        <AdminProductsSection
          isLoading={isLoading}
          filteredProducts={filteredProducts}
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
          customerSummaries={customerSummaries}
          clientSearch={clientSearch}
          onClientSearchChange={setClientSearch}
          clientFilter={clientFilter}
          onClientFilterChange={setClientFilter}
        />
      )}
    </AdminWorkspaceShell>
  );
}

