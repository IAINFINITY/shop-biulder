import { useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Plus, Pencil, Trash2, Save, X, LogOut, Eye, EyeOff, ImageIcon, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { ClinicPlusLogo } from "@/components/shared/ClinicPlusLogo";
import { isRichTextEmpty, sanitizeRichText } from "@/lib/richText";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import {
  ORDERS_TABLE,
  getOrderLinesGrandTotal,
  getOrderLinesQuantityTotal,
  parseOrderTableLines,
} from "@/lib/orders";
import { downloadOrderPdf, downloadOrderXlsx, downloadProxisImportTxt } from "@/lib/orderExport";
import { OrderAdminCard } from "@/components/admin/OrderAdminCard";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ProductImageCarouselEditor } from "@/components/admin/ProductImageCarouselEditor";
import { AdminAuthStage } from "@/components/auth/AdminAuthStage";

interface ProductForm {
  id?: string;
  name: string;
  description: string;
  type: string;
  family: string;
  image_urls: string[];
  active: boolean;
  priceInput: string;
  productCode: string;
}

const emptyForm: ProductForm = {
  name: "",
  description: "",
  type: "Chá",
  family: "",
  image_urls: [],
  active: true,
  priceInput: "",
  productCode: "",
};

type LoginFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  icon: LucideIcon;
};

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
}: LoginFieldProps) {
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

function LoginForm({ onLogin }: { onLogin: (email: string, password: string) => Promise<Error | null> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const error = await onLogin(email, password);
    if (error) toast.error(error.message);
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
              {loading ? "Entrando..." : "Entrar"}
            </Button>

            <div className="flex items-center justify-center gap-2 pt-1 text-[12px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Ambiente seguro — acesso exclusivo do time interno
            </div>
          </form>
        </div>
      </div>
    </AdminAuthStage>
  );
}

export default function Admin() {
  const { user, isAdmin, loading, signIn, signOut } = useAuth();
  const { data: products = [], isLoading } = useProducts({ includeInactive: true });
  const { data: orders = [], isLoading: ordersLoading } = useOrders(!loading && !!user && isAdmin);
  const { data: adminTypes = [] } = useAdminProductTypes();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ProductForm | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newType, setNewType] = useState("");
  const [activeTab, setActiveTab] = useState("produtos");
  const [orderSearch, setOrderSearch] = useState("");
  const [proxisExportingId, setProxisExportingId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const orderEnrichment = useMemo(() => buildOrderEnrichmentMaps(products), [products]);

  const derivedTypes = useMemo(() => {
    return [...new Set(products.map((p) => p.type))].sort();
  }, [products]);

  const filteredOrders = useMemo(() => {
    const term = orderSearch.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => {
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
  }, [orders, orderSearch]);

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => {
      const fields = [product.name, product.family, product.type, product.product_code ?? ""];
      return fields.some((value) => value?.toLowerCase().includes(term));
    });
  }, [products, productSearch]);

  const typeOptions = adminTypes.length
    ? adminTypes.map((t) => t.name)
    : (derivedTypes.length ? derivedTypes : getProductTypes());

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (!user) return <LoginForm onLogin={signIn} />;
  if (!isAdmin) return (
    <div className="min-h-screen flex items-center justify-center p-4 text-center">
      <div className="space-y-4">
        <p className="text-muted-foreground">Você não tem permissão de administrador.</p>
        <div className="flex gap-2 justify-center">
          <Link to="/" viewTransition><Button variant="outline">Voltar ao catálogo</Button></Link>
          <Button variant="ghost" onClick={() => signOut()}>Sair</Button>
        </div>
      </div>
    </div>
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["products"] });
  const refreshTypes = () => queryClient.invalidateQueries({ queryKey: ["product-types"] });
  const refreshOrders = () => queryClient.invalidateQueries({ queryKey: ["orders"] });

  const startNew = () => { setEditing({ ...emptyForm }); setIsNew(true); };
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
  const cancel = () => { setEditing(null); setIsNew(false); };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    const result = await uploadProductImageFile(file);
    setUploading(false);

    if (!result.ok) {
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
    const description = isRichTextEmpty(editing.description)
      ? ""
      : sanitizeRichText(editing.description);

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
      toast.warning(
        "Código não salvo. Execute supabase/APLICAR_NO_SUPABASE_product_code.sql no Supabase e tente de novo.",
      );
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
    if (error) { toast.error(error.message); return; }
    toast.success(active ? "Produto desativado" : "Produto ativado");
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from(PRODUCTS_TABLE).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Produto removido.");
    refresh();
  };

  const addType = async () => {
    const name = newType.trim();
    if (!name) return;
    const { error } = await supabase.from(PRODUCT_TYPES_TABLE).insert({ name });
    if (error) { toast.error(error.message); return; }
    setNewType("");
    toast.success("Tipo adicionado!");
    refreshTypes();
  };

  const deleteType = async (id: string) => {
    const { error } = await supabase.from(PRODUCT_TYPES_TABLE).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Tipo removido.");
    refreshTypes();
  };

  const deleteOrder = async (id: string) => {
    const shouldDelete = window.confirm("Deseja remover este pedido?");
    if (!shouldDelete) return;
    const { error } = await supabase.from(ORDERS_TABLE).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
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

  const renderForm = (title: string, className?: string) => {
    if (!editing) return null;
    return (
      <div className={`rounded-xl border border-primary/20 bg-card p-5 space-y-4 ${className || ""}`}>
        <h2 className="font-semibold text-foreground">{title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input placeholder="Nome do produto" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <Input placeholder="Família (ex: Detox, Beleza)" value={editing.family} onChange={(e) => setEditing({ ...editing, family: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="product-code">Código do produto</Label>
            <Input
              id="product-code"
              placeholder="Ex: CHA-001"
              value={editing.productCode}
              onChange={(e) => setEditing({ ...editing, productCode: e.target.value.toUpperCase() })}
            />
            <p className="text-xs text-muted-foreground">
              Uso interno: pedidos e exportações. Não aparece no catálogo para clientes.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-price">Preço (R$)</Label>
            <Input
              id="product-price"
              type="text"
              inputMode="decimal"
              placeholder="Ex: 49,90"
              value={editing.priceInput}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  priceInput: normalizePriceInputDraft(e.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Use vírgula ou ponto para centavos. Campo vazio = R$ 0,00 no catálogo.
            </p>
          </div>
        </div>
        <RichTextEditor
          value={editing.description}
          onChange={(html) => setEditing({ ...editing, description: html })}
          placeholder="Descreva o produto..."
        />
        <div className="flex flex-wrap items-center gap-3">
          <Select value={editing.type} onValueChange={(v) => setEditing({ ...editing, type: v })}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {typeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Novo tipo"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="h-9 w-40"
            />
            <Button type="button" size="sm" variant="outline" onClick={addType}>Adicionar</Button>
          </div>
        </div>
        {adminTypes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {adminTypes.map((t) => (
              <Button
                key={t.id}
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => deleteType(t.id)}
              >
                {t.name} <X className="w-3 h-3" />
              </Button>
            ))}
          </div>
        )}

        <ProductImageCarouselEditor
          urls={editing.image_urls}
          uploading={uploading}
          fileInputRef={fileInputRef}
          onFileChange={handleImageFile}
          onRemoveAt={(index) =>
            setEditing({
              ...editing,
              image_urls: editing.image_urls.filter((_, i) => i !== index),
            })
          }
        />

        <div className="flex items-center gap-2">
          <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
          <Label className="text-sm">{editing.active ? "Ativo no catálogo" : "Inativo"}</Label>
        </div>

        <div className="flex gap-2">
          <Button onClick={save} size="sm" className="gap-1"><Save className="w-4 h-4" /> Salvar</Button>
          <Button onClick={cancel} variant="ghost" size="sm" className="gap-1"><X className="w-4 h-4" /> Cancelar</Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeaderShell>
        <div className="flex items-center gap-4">
            <Link to="/" viewTransition><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
            <div className="flex items-center gap-2">
              <ClinicPlusLogo />
            </div>
            <span className="text-sm text-muted-foreground">Painel Administrativo</span>
            <div className="ml-auto flex items-center gap-2">
              {activeTab === "produtos" && (
                <Button onClick={startNew} size="sm" className="gap-1"><Plus className="w-4 h-4" /> Novo Produto</Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => signOut()}><LogOut className="w-4 h-4" /></Button>
            </div>
        </div>
      </PageHeaderShell>

      <div className="container mx-auto flex w-full max-w-[1400px] flex-1 flex-col min-h-0 px-4 py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col min-h-0 w-full">
          <TabsList className="mb-4 grid h-11 w-full shrink-0 grid-cols-2 p-1">
            <TabsTrigger value="produtos" className="w-full rounded-md">
              Produtos
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="w-full rounded-md">
              Pedidos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="produtos" className="mt-0 flex flex-1 flex-col min-h-0 data-[state=inactive]:hidden">
            {editing && isNew && renderForm("Novo Produto", "mb-4 shrink-0")}
            <div className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                placeholder="Pesquisar produto (nome, família, tipo)"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full sm:flex-1"
              />
              <span className="text-xs text-muted-foreground sm:min-w-[7.5rem] sm:text-right">
                {isLoading ? "Carregando..." : `${filteredProducts.length} produto(s)`}
              </span>
            </div>

            {isLoading ? (
              <p className="text-muted-foreground text-center py-10">Carregando produtos...</p>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 pr-1 -mr-1">
                {filteredProducts.map((p) => {
                  const thumb = getProductImageUrls(p)[0];
                  return editing && !isNew && editing.id === p.id ? (
                    <div key={p.id} className="rounded-lg border border-primary/20 bg-card p-4">
                      {renderForm("Editar Produto")}
                    </div>
                  ) : (
                    <div key={p.id} className={`flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors ${!p.active ? "opacity-50" : ""}`}>
                      {thumb ? (
                        <img src={thumb} alt={p.name} className="w-12 h-12 object-cover rounded-lg" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{p.name}</p>
                        <p className="text-xs font-medium text-primary tabular-nums mt-0.5">{formatBRL(coercePrice(p.price))}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {p.product_code && (
                            <Badge variant="outline" className="text-xs font-mono">
                              {p.product_code}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">{p.type}</Badge>
                          <Badge variant="secondary" className="text-xs">{p.family}</Badge>
                          {!p.active && <Badge variant="destructive" className="text-xs">Inativo</Badge>}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(p.id, p.active)}>
                        {p.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(p)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(p.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pedidos" className="mt-0 flex flex-1 flex-col min-h-0 data-[state=inactive]:hidden">
            <div className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                placeholder="Pesquisar pedido (nome, empresa, telefone, CNPJ, status)"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="w-full sm:flex-1"
              />
              <span className="text-xs text-muted-foreground sm:min-w-[7.5rem] sm:text-right">
                {ordersLoading ? "Carregando..." : `${filteredOrders.length} pedido(s)`}
              </span>
            </div>
            {ordersLoading ? (
              <p className="text-muted-foreground text-center py-10">Carregando pedidos...</p>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
                Nenhum pedido recebido ainda.
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 pr-1 -mr-1 pb-2">
                {filteredOrders.map((order) => {
                  const lines = parseOrderTableLines(order.items, orderEnrichment);
                  const orderTotal = getOrderLinesGrandTotal(lines);
                  const orderQty = getOrderLinesQuantityTotal(lines);
                  const exportPayload = {
                    id: order.id,
                    created_at: order.created_at,
                    customer_name: order.customer_name,
                    customer_company: order.customer_company,
                    customer_phone: order.customer_phone,
                    customer_cnpj: order.customer_cnpj,
                    status: order.status,
                    items: order.items,
                    proxis_import_id: order.proxis_import_id,
                    enrichmentMaps: orderEnrichment,
                  };
                  return (
                    <OrderAdminCard
                      key={order.id}
                      order={{
                        id: order.id,
                        created_at: order.created_at,
                        customer_name: order.customer_name,
                        customer_company: order.customer_company,
                        customer_phone: order.customer_phone,
                        customer_cnpj: order.customer_cnpj,
                        status: order.status,
                        total_items: order.total_items,
                        proxis_import_id: order.proxis_import_id,
                        items: order.items,
                      }}
                      lines={lines}
                      orderTotal={orderTotal}
                      orderQty={orderQty}
                      formatDate={formatDate}
                      isProxisExporting={proxisExportingId === order.id}
                      onExportProxis={() => exportProxisOrder(exportPayload)}
                      onExportXlsx={() => downloadOrderXlsx(exportPayload)}
                      onExportPdf={() => downloadOrderPdf(exportPayload)}
                      onDelete={() => deleteOrder(order.id)}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
