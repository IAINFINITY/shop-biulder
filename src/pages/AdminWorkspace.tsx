import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { OrderExportInput } from "@/lib/orderExportTypes";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isRichTextEmpty, sanitizeRichText } from "@/lib/richTextPure";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { AdminDashboardSection } from "@/components/admin/AdminDashboardSection";
import { AdminBannersSection } from "@/components/admin/AdminBannersSection";
import { AdminNotificationsSection } from "@/components/admin/AdminNotificationsSection";
import { AdminEmployeesSection } from "@/components/admin/AdminEmployeesSection";
import { AdminProductsSection } from "@/components/admin/AdminProductsSection";
import { AdminPricingSection } from "@/components/admin/AdminPricingSection";
import { AdminOrdersSection } from "@/components/admin/AdminOrdersSection";
import { AdminClientsSection } from "@/components/admin/AdminClientsSection";
import { AdminUsersSection } from "@/components/admin/AdminUsersSection";
import { AdminSettingsSection } from "@/components/admin/AdminSettingsSection";
import { SupportChatPanel } from "@/components/support/SupportChatPanel";
import { CUSTOMER_PROFILES_TABLE, type CustomerProfile } from "@/lib/customerProfile";
import { listEmployees } from "@/lib/employeeUsers";
import {
  CUSTOMER_TYPE_OVERRIDES_TABLE,
  buildCustomerTypeOverrideMap,
  type CustomerTypeOverride,
  normalizeCustomerCnpj,
} from "@/lib/customerTypeOverrides";
import { normalizeCustomerType } from "@/lib/pricing";
import { onlyDigits } from "@/lib/brazilianIds";
import { getOrderLinesGrandTotal, parseOrderTableLines, type OrderTableLine } from "@/lib/orders";
import { useCatalogBanners } from "@/hooks/useCatalogBanners";
import { useCatalogNotifications } from "@/hooks/useCatalogNotifications";
import { useSupportInbox } from "@/hooks/useSupportChat";
import type {
  AdminCustomerSummary,
  AdminDashboardOrder,
  AdminOrderRow,
  AdminProductFormState,
  AdminSection,
} from "@/components/admin/adminTypes";

function summarizeOrderItems(items: unknown, maps: Parameters<typeof parseOrderTableLines>[1]): OrderTableLine[] {
  return parseOrderTableLines(items, maps);
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export default function AdminWorkspace() {
  const { user, isAdmin, isSuperadmin, loading, isResolvingAccess, signOut } = useAuth();
  const { data: products = [], isLoading } = useProducts({ includeInactive: true });
  const { data: orders = [], isLoading: ordersLoading } = useOrders(!loading && !!user && isAdmin, "admin");
  const { data: notifications = [] } = useCatalogNotifications({ activeOnly: false });
  const { data: banners = [] } = useCatalogBanners({ activeOnly: false });
  const { data: inboxConversations = [] } = useSupportInbox(Boolean(user && isAdmin));
  const { data: adminTypes = [] } = useAdminProductTypes();
  const { data: employeeProfiles = [] } = useQuery({
    queryKey: ["employee_users"],
    enabled: Boolean(user && isAdmin),
    queryFn: listEmployees,
    staleTime: 30_000,
  });
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
  const clientProfiles = useMemo(
    () =>
      customerProfiles.filter(
        (profile) => normalizeCustomerType(profile.customer_type) !== "funcionario" && !profile.linked_company_cnpj,
      ),
    [customerProfiles],
  );
  const activeCustomerLookup = useMemo(() => {
    const userIdSet = new Set<string>();
    const cnpjSet = new Set<string>();
    const nameSet = new Set<string>();
    const companySet = new Set<string>();

    for (const profile of clientProfiles) {
      const userId = profile.user_id.trim();
      if (userId) userIdSet.add(userId);

      const cnpj = onlyDigits(profile.cnpj);
      if (cnpj) cnpjSet.add(cnpj);

      const name = normalizeText(profile.name);
      if (name) nameSet.add(name);

      const company = normalizeText(profile.company || "");
      if (company) companySet.add(company);
    }

    return { userIdSet, cnpjSet, nameSet, companySet };
  }, [clientProfiles]);
  const dashboardOrderRows = useMemo(
    () =>
      orderRows.filter((order) => {
        const orderUserId = typeof order.customer_user_id === "string" ? order.customer_user_id.trim() : "";
        if (orderUserId) {
          return activeCustomerLookup.userIdSet.has(orderUserId);
        }

        const orderCnpj = onlyDigits(order.customer_cnpj);
        if (orderCnpj) {
          return activeCustomerLookup.cnpjSet.has(orderCnpj);
        }

        const orderName = normalizeText(order.customer_name);
        if (orderName && activeCustomerLookup.nameSet.has(orderName)) return true;

        const orderCompany = normalizeText(order.customer_company ?? "");
        return orderCompany ? activeCustomerLookup.companySet.has(orderCompany) : false;
      }),
    [activeCustomerLookup, orderRows],
  );
  const newUsersCount = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    return clientProfiles.filter((profile) => {
      const createdAt = new Date(profile.created_at).getTime();
      return Number.isFinite(createdAt) && now - createdAt <= sevenDaysMs;
    }).length;
  }, [clientProfiles]);
  const openConversationsCount = useMemo(
    () => inboxConversations.filter((conversation) => conversation.status === "open").length,
    [inboxConversations],
  );
  const sentNotificationsCount = notifications.length;
  const createdBannersCount = banners.length;
  const productSalesById = useMemo(() => {
    const counts = new Map<string, number>();

    for (const order of dashboardOrderRows) {
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
  }, [dashboardOrderRows]);
  const filteredOrders = useMemo<AdminOrderRow[]>(() => {
    const term = orderSearch.trim().toLowerCase();
    if (!term) return dashboardOrderRows;
    return dashboardOrderRows.filter((order) => {
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
  }, [dashboardOrderRows, orderSearch]);
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
      [...dashboardOrderRows]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map((order) => ({
          id: order.id,
          created_at: order.created_at,
          customer_user_id: order.customer_user_id ?? null,
          customer_name: order.customer_name,
          customer_company: order.customer_company,
          customer_phone: order.customer_phone,
          customer_cnpj: order.customer_cnpj,
          customer_observation: order.customer_observation ?? null,
          status: order.status,
          total_items: order.total_items,
          proxis_import_id: order.proxis_import_id,
          items: summarizeOrderItems(order.items, orderEnrichment).map((line) => ({
            unitPrice: line.unitPrice,
            quantity: line.quantity,
          })),
          })),
    [dashboardOrderRows],
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

    for (const profile of clientProfiles) {
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

    for (const order of dashboardOrderRows) {
      const key = onlyDigits(order.customer_cnpj) || order.customer_name;
      const current = customers.get(key);
      const orderLines = summarizeOrderItems(order.items, orderEnrichment);
      const orderTotal = getOrderLinesGrandTotal(orderLines);

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
  }, [clientProfiles, customerTypeOverrideMap, dashboardOrderRows, orderEnrichment]);
  const activeProductsCount = useMemo(() => products.filter((p) => p.active).length, [products]);
  const inactiveProductsCount = useMemo(() => products.filter((p) => !p.active).length, [products]);
  const pendingOrdersCount = useMemo(
    () => dashboardOrderRows.filter((o) => {
      const s = o.status.toLowerCase();
      return s.includes("novo") || s.includes("separ") || s.includes("process") || s.includes("prepar");
    }).length,
    [dashboardOrderRows],
  );
  const totalRevenue = useMemo(
    () =>
      dashboardOrderRows.reduce(
        (sum, order) =>
          sum + getOrderLinesGrandTotal(summarizeOrderItems(order.items, orderEnrichment)),
        0,
      ),
    [dashboardOrderRows, orderEnrichment],
  );
  const averageOrderValue = useMemo(
    () => (dashboardOrderRows.length > 0 ? totalRevenue / dashboardOrderRows.length : 0),
    [dashboardOrderRows.length, totalRevenue],
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
      [...clientProfiles]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [clientProfiles],
  );
  const recentEmployees = useMemo(
    () =>
      [...employeeProfiles]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [employeeProfiles],
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
    usuarios: "Usuários",
    configuracoes: "Configurações",
  };
  const typeOptions = adminTypes.length
    ? adminTypes.map((t) => t.name)
    : derivedTypes.length
      ? derivedTypes
      : getProductTypes();
  const displayUserLabel = user?.user_metadata?.name?.trim() || user?.email || "Administrador";

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
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/login" replace />;
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
    customerType: string;
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
      visible_to: [],
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
      visible_to: p.visible_to ?? [],
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
      if (prev.image_urls.length >= 5) {
        toast.error("Máximo de 5 imagens por produto.");
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
    const normalizedPrice = Math.max(0, parsePriceInput(editing.priceInput));
    if (normalizedPrice <= 0) {
      toast.error("O preço precisa ser maior que zero para salvar o produto.");
      return;
    }

    const { withGallery, legacyOnly } = buildProductDbPayload({
      name: editing.name,
      description,
      type: editing.type,
      family: editing.family.trim(),
      image_urls: editing.image_urls.filter((u) => u.trim() !== ""),
      active: editing.active,
      is_promotion: editing.is_promotion,
      price: normalizedPrice,
      product_code: editing.productCode,
      visible_to: editing.visible_to.length > 0 ? editing.visible_to.map((t) => t.trim().toLowerCase()) : null,
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
      console.error("Erro ao salvar produto", error);
      toast.error("Erro ao salvar produto.");
      return;
    }

    toast.success(isNew ? "Produto adicionado!" : "Produto atualizado!");
    cancel();
    refresh();
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from(PRODUCTS_TABLE).update({ active: !active } as never).eq("id", id);
    if (error) {
      console.error("Erro ao atualizar produto", error);
      toast.error("Erro ao atualizar produto.");
      return;
    }
    toast.success(active ? "Produto desativado" : "Produto ativado");
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from(PRODUCTS_TABLE).delete().eq("id", id);
    if (error) {
      console.error("Erro ao remover produto", error);
      toast.error("Erro ao remover produto.");
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
      console.error("Erro ao adicionar tipo", error);
      toast.error("Erro ao adicionar tipo.");
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
      console.error("Erro ao remover tipo", error);
      toast.error("Erro ao remover tipo.");
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
      console.error("Erro ao remover pedido", error);
      toast.error("Erro ao remover pedido.");
      return;
    }
    toast.success("Pedido removido.");
    refreshOrders();
  };

  const updateOrderStatus = async (id: string, status: string) => {
    const { error } = await supabase.from(ORDERS_TABLE).update({ status }).eq("id", id);
    if (error) {
      console.error("Erro ao atualizar status do pedido", error);
      toast.error("Erro ao atualizar status.");
      return;
    }
    toast.success("Status atualizado.");
    refreshOrders();
  };

  const exportProxisOrder = async (exportPayload: OrderExportInput) => {
    setProxisExportingId(exportPayload.id);
    try {
      const { downloadProxisImportTxt } = await import("@/lib/orderExport");
      const proxisId = await downloadProxisImportTxt(exportPayload);
      toast.success(`Arquivo Proxis gerado (ID ${proxisId}).`);
      refreshOrders();
    } catch (err) {
        console.error("Erro ao exportar para Proxis", err);
        toast.error("Erro ao exportar para Proxis.");
    } finally {
      setProxisExportingId(null);
    }
  };

  const exportOrderXlsx = async (exportPayload: OrderExportInput) => {
    const { downloadOrderXlsx } = await import("@/lib/orderExport");
    downloadOrderXlsx(exportPayload);
  };

  const exportOrderPdf = async (exportPayload: OrderExportInput) => {
    const { downloadOrderPdf } = await import("@/lib/orderExport");
    downloadOrderPdf(exportPayload);
  };

  const formatDate = (value: string) => new Date(value).toLocaleString("pt-BR");
  const chatContent = <SupportChatPanel mode="admin" />;

  return (
    <AdminWorkspaceShell
      section={section}
      title={sectionTitle[section]}
      onSectionChange={setSection}
      onLogout={signOut}
      userLabel={displayUserLabel}
      sidebarOpen={sidebarOpen}
      onSidebarToggle={() => setSidebarOpen((value) => !value)}
      isSuperadmin={isSuperadmin}
    >
      {section === "banners" && <AdminBannersSection />}
      {section === "notificacoes" && <AdminNotificationsSection />}

      {section === "dashboard" && (
        <AdminDashboardSection
          products={products}
          recentOrders={recentOrders}
          customerSummaries={customerSummaries}
          notifications={notifications}
          banners={banners}
          customerProfiles={clientProfiles}
          orderRows={orderRows}
          activeProductsCount={activeProductsCount}
          inactiveProductsCount={inactiveProductsCount}
          newUsersCount={newUsersCount}
          openConversationsCount={openConversationsCount}
          sentNotificationsCount={sentNotificationsCount}
          createdBannersCount={createdBannersCount}
          pendingOrdersCount={pendingOrdersCount}
          totalRevenue={totalRevenue}
          averageOrderValue={averageOrderValue}
          customersWithOrdersCount={customersWithOrdersCount}
          customersWithoutOrdersCount={customersWithoutOrdersCount}
          recentCustomers={recentCustomers}
          recentEmployees={recentEmployees}
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
        <AdminPricingSection
          products={products}
          onRefreshPricing={refreshPricing}
          onGoToProduct={(productCode) => {
            setProductSearch(productCode.trim().toUpperCase());
            setSection("produtos");
          }}
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
          onExportXlsx={exportOrderXlsx}
          onExportPdf={exportOrderPdf}
          onDelete={deleteOrder}
          onStatusChange={updateOrderStatus}
        />
      )}

      {section === "clientes" && (
        <AdminClientsSection
          customerProfiles={clientProfiles}
          customerSummaries={customerSummaries}
          clientSearch={clientSearch}
          onClientSearchChange={setClientSearch}
          clientFilter={clientFilter}
          onClientFilterChange={setClientFilter}
          onUpdateCustomerType={updateCustomerType}
        />
      )}

      {section === "mensagens" && chatContent}
      {section === "usuarios" && <AdminUsersSection />}
      {section === "funcionarios" && <AdminEmployeesSection />}
      {section === "configuracoes" && <AdminSettingsSection />}
    </AdminWorkspaceShell>
  );
}
