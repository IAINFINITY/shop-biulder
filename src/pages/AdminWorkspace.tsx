import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { Images, LogOut, ShieldCheck, Upload } from "lucide-react";
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
  PRODUCT_MAX_IMAGES,
  buildOrderEnrichmentMaps,
  buildProductDbPayload,
  detectMissingProductColumn,
  omitProductColumn,
  type Product,
} from "@/lib/products";
import {
  coercePrice,
  formatBRL,
  normalizePriceInputDraft,
  parsePriceInput,
  priceToAdminInput,
} from "@/lib/formatMoney";
import { uploadProductImageFile, deleteStorageImage, nextProductImageObjectName, normalizeProductGalleryNames } from "@/lib/productImageStorage";
import {
  PRODUCT_IMAGE_FRAME,
  PRODUCT_IMAGE_MIN_SIZE,
  PRODUCT_IMAGE_TARGET_WIDTH,
  PRODUCT_IMAGE_TARGET_HEIGHT,
  checkProductImage,
} from "@/lib/productImageNormalization";
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
import { AdminBulkImagesSection } from "@/components/admin/AdminBulkImagesSection";
import { AdminMediaLibrarySection } from "@/components/admin/AdminMediaLibrarySection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPricingSection } from "@/components/admin/AdminPricingSection";
import { AdminOrdersSection } from "@/components/admin/AdminOrdersSection";
import { AdminClientsSection } from "@/components/admin/AdminClientsSection";
import { AdminUsersSection } from "@/components/admin/AdminUsersSection";
import { AdminSettingsSection } from "@/components/admin/AdminSettingsSection";
import { ChatWorkspace } from "@/components/support/ChatWorkspace";
import { CUSTOMER_PROFILES_TABLE, type CustomerProfile } from "@/lib/customerProfile";
import { listEmployees } from "@/lib/employeeUsers";
import { canAccessAdminSection } from "@/lib/adminUsers";
import {
  CUSTOMER_TYPE_OVERRIDES_TABLE,
  buildCustomerTypeOverrideMap,
  type CustomerTypeOverride,
  normalizeCustomerCnpj,
} from "@/lib/customerTypeOverrides";
import { normalizeCustomerType } from "@/lib/pricing";
import { onlyDigits } from "@/lib/brazilianIds";
import { getOrderLinesGrandTotal, parseOrderTableLines, type OrderTableLine } from "@/lib/orders";
import { addressToProxisPayload } from "@/lib/address";
import { sendProxisOrder, ProxisSendError } from "@/lib/proxisOrder";
import type { AdminPermissions } from "@/lib/adminUsers";
import { useCatalogBanners } from "@/hooks/useCatalogBanners";
import { useCatalogNotifications } from "@/hooks/useCatalogNotifications";
import { useSupportInbox } from "@/hooks/useSupportChat";
import { campoLocalParaIso, isoParaCampoLocal } from "@/lib/dataHoraLocal";
import { motivoParaNaoDestacar } from "@/lib/promocao";
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

const ADMIN_SECTION_TITLES: Record<AdminSection, string> = {
  dashboard: "Dashboard",
  banners: "Banners do catálogo",
  notificacoes: "Notificações",
  produtos: "Produtos",
  imagens: "Imagens",
  precos: "Preços",
  pedidos: "Pedidos",
  clientes: "Clientes",
  mensagens: "Mensagens",
  usuarios: "Usuários",
  funcionarios: "Funcionários",
  configuracoes: "Configurações",
};

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
  const { data: adminPermissions } = useQuery({
    queryKey: ["admin_permissions", user?.id],
    enabled: Boolean(user && isAdmin && !isSuperadmin),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic+b2b_admin_users")
        .select("permissions")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return (data?.permissions ?? null) as AdminPermissions | null;
    },
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
  // Mesma correcao da area de cliente: a variavel significa "expandida" no
  // desktop e "gaveta aberta" no celular, entao o valor inicial nao pode ser um
  // so — com `true` fixo, entrar no admin pelo celular ja abria o menu por cima
  // do conteudo.
  const ehDesktop = () =>
    typeof window === "undefined" || window.matchMedia("(min-width: 1024px)").matches;
  const [sidebarOpen, setSidebarOpen] = useState(ehDesktop);
  const [proxisExportingId, setProxisExportingId] = useState<string | null>(null);
  const [proxisResendingId, setProxisResendingId] = useState<string | null>(null);
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
    [dashboardOrderRows, orderEnrichment],
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
  const typeOptions = adminTypes.length
    ? adminTypes.map((t) => t.name)
    : derivedTypes.length
      ? derivedTypes
      : getProductTypes();
  const displayUserLabel = user?.user_metadata?.name?.trim() || user?.email || "Administrador";
  const allowedSections = useMemo(() => {
    if (isSuperadmin) return null;
    const allowed = new Set(
      (Object.keys(ADMIN_SECTION_TITLES) as AdminSection[]).filter((sectionId) =>
        canAccessAdminSection(sectionId, { isSuperadmin, permissions: adminPermissions ?? null }),
      ),
    );
    return allowed;
  }, [isSuperadmin, adminPermissions]);

  useEffect(() => {
    if (allowedSections && !allowedSections.has(section)) {
      setSection("dashboard");
    }
  }, [allowedSections, section]);

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
      brand: "",
      type: "Chá",
      family: "",
      image_urls: [],
      image_alts: [],
      image_fit: "contain",
      active: true,
      is_promotion: false,
      is_featured: false,
      priceInput: "",
      compareAtPriceInput: "",
      promoPercentInput: "",
      promoStartsAtInput: "",
      promoEndsAtInput: "",
      stockInput: "",
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
      brand: p.brand ?? "",
      type: p.type,
      family: p.family.trim(),
      image_urls: getProductImageUrls(p),
      image_alts: getProductImageUrls(p).map((_, index) => p.image_alts?.[index] ?? ""),
      image_fit: p.image_fit,
      active: p.active,
      is_promotion: p.is_promotion,
      is_featured: p.is_featured,
      priceInput: priceToAdminInput(coercePrice(p.price)),
      compareAtPriceInput: p.compare_at_price ? priceToAdminInput(coercePrice(p.compare_at_price)) : "",
      promoPercentInput: p.promo_percent ? String(p.promo_percent).replace(".", ",") : "",
      // `slice(0, 16)` entregava o UTC cru ao campo, que le como hora local:
      // 18:55 salvo reabria como 21:55, e cada edicao empurrava mais tres horas.
      promoStartsAtInput: isoParaCampoLocal(p.promo_starts_at),
      promoEndsAtInput: isoParaCampoLocal(p.promo_ends_at),
      stockInput: typeof p.stock === "number" && Number.isFinite(p.stock) ? String(Math.max(0, Math.trunc(p.stock))) : "",
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

    if (!editing) {
      toast.error("Abra ou crie um produto antes de enviar a foto.");
      return;
    }
    // A foto vai para o storage com o codigo do produto como nome (`7912.webp`,
    // `7912_2.webp`) — mesma convencao do envio em lote. Sem codigo nao ha nome,
    // e o arquivo entraria como UUID, invisivel para o lote e para a biblioteca.
    if (!editing.productCode.trim()) {
      toast.error("Informe o código do produto antes de enviar a foto.");
      return;
    }
    if (editing.image_urls.length >= PRODUCT_MAX_IMAGES) {
      toast.error(`Máximo de ${PRODUCT_MAX_IMAGES} imagens por produto.`);
      return;
    }

    setUploading(true);
    const check = await checkProductImage(file);
    if (check.dimensions) {
      const { width, height } = check.dimensions;
      if (check.isTooSmall) {
        toast.error(
          `Foto de ${width}×${height}px: abaixo do mínimo de ${PRODUCT_IMAGE_MIN_SIZE}×${PRODUCT_IMAGE_MIN_SIZE}px. Ela não será enviada.`,
        );
        setUploading(false);
        return;
      } else if (check.isOffAspectRatio) {
        // Nao e erro: o upload estende a borda da propria foto para fechar o
        // quadro. O aviso existe porque quem fotografou consegue enquadrar
        // melhor do que qualquer estender automatico.
        toast.info(
          `Foto de ${width}×${height}px fora de 4:5: o fundo vai ser estendido para fechar a moldura. O ideal é entregar em ${PRODUCT_IMAGE_TARGET_WIDTH}×${PRODUCT_IMAGE_TARGET_HEIGHT}px.`,
        );
      }
    }

    const result = await uploadProductImageFile(file, {
      frame: PRODUCT_IMAGE_FRAME,
      nome: nextProductImageObjectName(editing.productCode, editing.image_urls) ?? undefined,
    });
    setUploading(false);

    if (result.ok === false) {
      toast.error(result.message);
      return;
    }

    setEditing((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        image_urls: [...prev.image_urls, result.publicUrl],
        image_alts: [...prev.image_alts, ""],
      };
    });
    toast.success("Foto adicionada!");
  };

  // Reordenar ou remover precisa mover a descricao junto com a foto, senao os
  // alt textos passam a descrever a imagem errada.
  const moveImageAt = (from: number, to: number) => {
    setEditing((prev) => {
      if (!prev) return prev;
      if (from === to) return prev;
      if (from < 0 || from >= prev.image_urls.length) return prev;
      if (to < 0 || to >= prev.image_urls.length) return prev;

      const nextUrls = [...prev.image_urls];
      const [movedUrl] = nextUrls.splice(from, 1);
      nextUrls.splice(to, 0, movedUrl);

      const nextAlts = [...prev.image_alts];
      const [movedAlt] = nextAlts.splice(from, 1);
      nextAlts.splice(to, 0, movedAlt ?? "");

      return { ...prev, image_urls: nextUrls, image_alts: nextAlts };
    });
  };

  const setImageAltAt = (index: number, alt: string) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const nextAlts = prev.image_urls.map((_, position) =>
        position === index ? alt : prev.image_alts[position] ?? "",
      );
      return { ...prev, image_alts: nextAlts };
    });
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

    const compareAtRaw = editing.compareAtPriceInput.trim();
    const normalizedCompareAt = compareAtRaw === "" ? null : Math.max(0, parsePriceInput(compareAtRaw));
    if (normalizedCompareAt !== null && normalizedCompareAt <= normalizedPrice) {
      toast.error('O preço "de" precisa ser maior que o preço atual.');
      return;
    }

    // Promocao sem desconto nao passa daqui.
    //
    // O formulario ja desliga a chave sozinho, mas isso e a interface. Esta e a
    // porta por onde o dado entra: rascunho antigo carregado do cache, colagem
    // de outro produto, ou simplesmente um caminho de codigo novo que esqueca a
    // regra. A validacao que vale e a que fica junto da escrita.
    const percentualPromocao =
      editing.promoPercentInput.trim() === "" ? null : parsePriceInput(editing.promoPercentInput);
    if (editing.is_promotion) {
      const motivo = motivoParaNaoDestacar({ promo_percent: percentualPromocao });
      if (motivo) {
        toast.error(motivo);
        return;
      }
    }

    const stockInput = editing.stockInput.trim();
    const stock = stockInput === "" ? null : Number.parseInt(stockInput, 10);
    if (stockInput !== "" && (!Number.isInteger(stock) || stock < 0)) {
      toast.error("Informe um estoque válido ou deixe em branco.");
      return;
    }

    // O nome do arquivo acompanha a posicao na galeria (`7912.webp` = capa,
    // `7912_2.webp` = segunda foto). Remover uma foto do meio ou reordenar deixa
    // os nomes dessincronizados com as posicoes; renomear aqui, antes de gravar,
    // garante que o banco e o storage saiam sempre coerentes.
    const cleanUrls = editing.image_urls.filter((u) => u.trim() !== "");
    const normalized = await normalizeProductGalleryNames(editing.productCode, cleanUrls);
    if (!normalized.ok) {
      toast.error(normalized.message);
      return;
    }
    const finalUrls = normalized.urls;

    const { withGallery } = buildProductDbPayload({
      name: editing.name,
      description,
      brand: editing.brand,
      type: editing.type,
      family: editing.family.trim(),
      image_urls: finalUrls,
      image_alts: editing.image_alts,
      image_fit: editing.image_fit,
      active: editing.active,
      is_promotion: editing.is_promotion,
      is_featured: editing.is_featured,
      price: normalizedPrice,
      compare_at_price: normalizedCompareAt,
      promo_percent: percentualPromocao,
      promo_starts_at: campoLocalParaIso(editing.promoStartsAtInput),
      promo_ends_at: campoLocalParaIso(editing.promoEndsAtInput),
      stock,
      product_code: editing.productCode,
      visible_to: editing.visible_to.length > 0 ? editing.visible_to.map((t) => t.trim().toLowerCase()) : null,
    });

    const persist = async (payload: Record<string, unknown>) => {
      if (isNew) return supabase.from(PRODUCTS_TABLE).insert(payload as never);
      return supabase.from(PRODUCTS_TABLE).update(payload as never).eq("id", editing.id!);
    };

    // Mesma degradacao progressiva da leitura: descarta a coluna que o banco
    // ainda nao tem e tenta de novo, avisando o que ficou de fora.
    const MISSING_COLUMN_WARNINGS: Record<string, string> = {
      image_urls: "Só a primeira foto foi salva. Execute supabase/APLICAR_NO_SUPABASE_image_urls.sql no Supabase para várias imagens.",
      is_promotion: "Promoção não salva. Execute a migração da coluna is_promotion no Supabase e tente de novo.",
      is_featured: "Destaque não salvo. Execute supabase/migrations/20260801160000_product_is_featured.sql no Supabase e tente de novo.",
      product_code: "Código não salvo. Execute supabase/APLICAR_NO_SUPABASE_product_code.sql no Supabase e tente de novo.",
      brand: "Marca não salva. Execute supabase/APLICAR_NO_SUPABASE_product_taxonomy_brands.sql no Supabase e tente de novo.",
      visible_to: "Visibilidade não salva. Execute supabase/APLICAR_NO_SUPABASE_visible_to.sql no Supabase e tente de novo.",
      stock: "Estoque não salvo. Execute a migração da coluna stock no Supabase e tente de novo.",
    };

    let body: Record<string, unknown> = withGallery;
    const dropped: string[] = [];
    let { error } = await persist(body);

    while (error) {
      const missingColumn = detectMissingProductColumn(error.message);
      if (!missingColumn || dropped.includes(missingColumn)) break;

      const warning = MISSING_COLUMN_WARNINGS[missingColumn];
      if (warning) toast.warning(warning);

      dropped.push(missingColumn);
      body = omitProductColumn(body, missingColumn);
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

  const resendProxisOrder = async (orderPayload: {
    id: string;
    submission_key?: string | null;
    customer_name: string;
    customer_cnpj: string;
    customer_company: string;
    customer_observation: string | null;
    address: Parameters<typeof addressToProxisPayload>[0];
    items: Array<{ product_code: string; quantity: number; unit_price: number; name: string }>;
    note?: string | null;
  }) => {
    const { id, ...payload } = orderPayload;
    setProxisResendingId(id);
    console.groupCollapsed(`[Proxis debug] resend order ${id}`);
    console.log("payload", payload);
    console.log("items", payload.items);
    console.log("address", payload.address);
    try {
      const response = await sendProxisOrder(payload);
      console.log("response", response);
      const sentCount = response.items_count ?? orderPayload.items.length;
      if (response.already_sent) {
        toast.info("Este pedido já constava no Proxis. Nada foi duplicado.");
      } else if (response.failed_products && response.failed_products.length > 0) {
        console.warn("failed_products", response.failed_products);
        toast.warning(`Pedido reenviado ao Proxis com ${response.failed_products.length} produto(s) sem correspondência.`);
      } else {
        toast.success(`Pedido reenviado ao Proxis (${sentCount} item(ns)).`);
      }
    } catch (err) {
      if (err instanceof ProxisSendError) {
        const failedEndpoint = err.response.upstream?.endpoint;
        console.error("Proxis send error", {
          status: err.status,
          message: err.message,
          response: err.response,
        });
        if (err.response.failed_products?.length) {
          console.warn("failed_products", err.response.failed_products);
        }
        toast.error(
          failedEndpoint
            ? `Erro no Proxis em ${failedEndpoint} (${err.response.upstream?.status ?? err.status}). Veja o console.`
            : `Erro ao reenviar para Proxis (${err.status}). Veja o console.`,
        );
      } else {
        console.error("Erro ao reenviar pedido ao Proxis", err);
        toast.error(err instanceof Error ? err.message : "Erro ao reenviar pedido ao Proxis.");
      }
    } finally {
      setProxisResendingId(null);
      console.groupEnd();
      // A rota reescreve o status de sincronia em qualquer desfecho, entao o
      // selo do cartao e a fila de pendentes precisam recarregar dos dois lados.
      refreshOrders();
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
  const chatContent = <ChatWorkspace mode="admin" />;

  return (
    <AdminWorkspaceShell
      section={section}
      conteudoCheio={section === "mensagens"}
      title={ADMIN_SECTION_TITLES[section]}
      onSectionChange={(proxima) => {
        setSection(proxima);
        // No celular a gaveta cobre o conteudo: deixa-la aberta esconderia a
        // secao que a pessoa acabou de escolher.
        if (!ehDesktop()) setSidebarOpen(false);
        window.scrollTo({ top: 0, behavior: "auto" });
      }}
      onLogout={signOut}
      userLabel={displayUserLabel}
      sidebarOpen={sidebarOpen}
      onSidebarToggle={() => setSidebarOpen((value) => !value)}
      isSuperadmin={isSuperadmin}
      permissions={adminPermissions}
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
          onMoveImageAt={moveImageAt}
          onImageAltChange={setImageAltAt}
          onRemoveImageAt={async (index) => {
            const currentUrl = editing?.image_urls[index];
            setEditing((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                image_urls: prev.image_urls.filter((_, i) => i !== index),
                image_alts: prev.image_urls
                  .map((_, position) => prev.image_alts[position] ?? "")
                  .filter((_, i) => i !== index),
              };
            });

            if (currentUrl) {
              const result = await deleteStorageImage(currentUrl);
              if (!result.ok) {
                toast.warning(`Imagem removida da edição, mas não foi possível apagar do storage: ${result.message}`);
              }
            }

            toast.success("Foto removida.");
          }}
          onSave={save}
          onCancel={cancel}
        />
      )}

      {/* Duas tarefas diferentes, em duas abas: enviar fotos novas e cuidar do
          que ja esta la. Empilhadas numa pagina so, quem vinha subir um lote
          rolava por toda a biblioteca antes de achar a area de envio. */}
      {section === "imagens" && (
        <Tabs defaultValue="enviar" className="space-y-6">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-full bg-muted/60 p-1 sm:w-auto">
            <TabsTrigger value="enviar" className="gap-2 rounded-full px-4 py-2 text-[0.8125rem]">
              <Upload className="h-4 w-4" />
              Enviar fotos
            </TabsTrigger>
            <TabsTrigger value="biblioteca" className="gap-2 rounded-full px-4 py-2 text-[0.8125rem]">
              <Images className="h-4 w-4" />
              Biblioteca
            </TabsTrigger>
          </TabsList>

          <TabsContent value="enviar" className="mt-0">
            <AdminBulkImagesSection products={products} />
          </TabsContent>
          <TabsContent value="biblioteca" className="mt-0">
            <AdminMediaLibrarySection products={products} />
          </TabsContent>
        </Tabs>
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
          proxisResendingId={proxisResendingId}
          onExportProxis={exportProxisOrder}
          onResendProxis={resendProxisOrder}
          onExportXlsx={exportOrderXlsx}
          onExportPdf={exportOrderPdf}
          onDelete={deleteOrder}
          onStatusChange={updateOrderStatus}
          customerProfiles={clientProfiles}
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
