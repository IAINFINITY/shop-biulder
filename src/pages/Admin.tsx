import { useState, useRef, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Save, X, Upload, LogOut, Eye, EyeOff, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { getProductTypes, PRODUCTS_TABLE, PRODUCT_TYPES_TABLE } from "@/lib/products";
import { ORDERS_TABLE } from "@/lib/orders";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import clinicMaisLogo from "@/assets/clinicmais-logo.png";

interface ProductForm {
  id?: string;
  name: string;
  description: string;
  type: string;
  family: string;
  image_url: string | null;
  active: boolean;
}

const emptyForm: ProductForm = { name: "", description: "", type: "Chá", family: "", image_url: null, active: true };

function LoginForm({ onLogin }: { onLogin: (email: string, password: string) => Promise<any> }) {
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <img src={clinicMaisLogo} alt="Clinic+ Suplemento e Nutrição" className="h-10 w-auto mx-auto" />
          <p className="text-muted-foreground text-sm">Acesso Administrativo</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <Link to="/" className="block text-center text-sm text-muted-foreground hover:text-foreground">
          ← Voltar ao catálogo
        </Link>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user, isAdmin, loading, signIn, signOut } = useAuth();
  const { data: products = [], isLoading } = useProducts();
  const { data: orders = [], isLoading: ordersLoading } = useOrders(!loading && !!user && isAdmin);
  const { data: adminTypes = [] } = useAdminProductTypes();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ProductForm | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newType, setNewType] = useState("");
  const [activeTab, setActiveTab] = useState("produtos");
  const [orderSearch, setOrderSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;

    let didSignOut = false;
    const forceRelogin = () => {
      if (didSignOut) return;
      didSignOut = true;
      void signOut();
    };

    const handlePageExit = () => {
      forceRelogin();
    };

    window.addEventListener("beforeunload", handlePageExit);
    window.addEventListener("pagehide", handlePageExit);

    return () => {
      window.removeEventListener("beforeunload", handlePageExit);
      window.removeEventListener("pagehide", handlePageExit);
    };
  }, [user, signOut]);

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
          <Link to="/"><Button variant="outline">Voltar ao catálogo</Button></Link>
          <Button variant="ghost" onClick={() => signOut()}>Sair</Button>
        </div>
      </div>
    </div>
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["products"] });
  const refreshTypes = () => queryClient.invalidateQueries({ queryKey: ["product-types"] });
  const refreshOrders = () => queryClient.invalidateQueries({ queryKey: ["orders"] });

  const startNew = () => { setEditing({ ...emptyForm }); setIsNew(true); };
  const startEdit = (p: any) => { setEditing({ id: p.id, name: p.name, description: p.description, type: p.type, family: p.family, image_url: p.image_url, active: p.active }); setIsNew(false); };
  const cancel = () => { setEditing(null); setIsNew(false); };

  const uploadImage = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { toast.error("Erro ao enviar imagem"); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
    setEditing((prev) => prev ? { ...prev, image_url: publicUrl } : prev);
    setUploading(false);
    toast.success("Imagem enviada!");
  };

  const save = async () => {
    if (!editing || !editing.name || !editing.family) {
      toast.error("Preencha nome e família do produto.");
      return;
    }
    const payload = { name: editing.name, description: editing.description, type: editing.type, family: editing.family, image_url: editing.image_url, active: editing.active };
    if (isNew) {
      const { error } = await supabase.from(PRODUCTS_TABLE).insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Produto adicionado!");
    } else {
      const { error } = await supabase.from(PRODUCTS_TABLE).update(payload).eq("id", editing.id!);
      if (error) { toast.error(error.message); return; }
      toast.success("Produto atualizado!");
    }
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
        <Textarea placeholder="Descrição" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
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

        <div className="space-y-2">
          <Label className="text-sm font-medium">Imagem do Produto</Label>
          <div className="flex items-center gap-3">
            {editing.image_url ? (
              <img src={editing.image_url} alt="Preview" className="w-20 h-20 object-cover rounded-lg border border-border" />
            ) : (
              <div className="w-20 h-20 rounded-lg border border-dashed border-border flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
              </div>
            )}
            <div className="space-y-1">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
              <Button variant="outline" size="sm" className="gap-1" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="w-3.5 h-3.5" /> {uploading ? "Enviando..." : "Upload"}
              </Button>
              {editing.image_url && (
                <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={() => setEditing({ ...editing, image_url: null })}>
                  <X className="w-3 h-3" /> Remover
                </Button>
              )}
            </div>
          </div>
        </div>

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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div className="flex items-center gap-2">
            <img src={clinicMaisLogo} alt="Clinic+ Suplemento e Nutrição" className="h-8 w-auto" />
          </div>
          <span className="text-sm text-muted-foreground">Painel Administrativo</span>
          <div className="ml-auto flex items-center gap-2">
            {activeTab === "produtos" && (
              <Button onClick={startNew} size="sm" className="gap-1"><Plus className="w-4 h-4" /> Novo Produto</Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => signOut()}><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          </TabsList>

          <TabsContent value="produtos">
            {editing && isNew && renderForm("Novo Produto", "mb-6")}

            {isLoading ? (
              <p className="text-muted-foreground text-center py-10">Carregando produtos...</p>
            ) : (
              <div className="space-y-2">
                {products.map((p) => (
                  editing && !isNew && editing.id === p.id ? (
                    <div key={p.id} className="rounded-lg border border-primary/20 bg-card p-4">
                      {renderForm("Editar Produto")}
                    </div>
                  ) : (
                    <div key={p.id} className={`flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors ${!p.active ? "opacity-50" : ""}`}>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-12 h-12 object-cover rounded-lg" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{p.name}</p>
                        <div className="flex gap-2 mt-1">
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
                  )
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pedidos">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <Input
                placeholder="Pesquisar pedido (nome, empresa, telefone, CNPJ, status)"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="sm:max-w-md"
              />
              <span className="text-xs text-muted-foreground">
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
              <div className="space-y-3">
                {filteredOrders.map((order) => {
                  const items = Array.isArray(order.items) ? order.items : [];
                  return (
                    <div key={order.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{order.customer_name}</p>
                          <p className="text-sm text-muted-foreground">{order.customer_company}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{order.status}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDate(order.created_at)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteOrder(order.id)}
                            title="Excluir pedido"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Telefone: <span className="text-foreground">{order.customer_phone}</span>{" "}
                        · CNPJ: <span className="text-foreground">{order.customer_cnpj}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {items.map((item: any, index: number) => (
                          <div key={`${order.id}-${index}`} className="rounded-md border border-border p-2">
                            <p className="text-sm font-medium text-foreground">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.type} · {item.family}</p>
                            <p className="text-xs text-muted-foreground">
                              Quantidade: <span className="text-foreground">{item.quantity}</span>
                            </p>
                            {item.notes && (
                              <p className="text-xs text-muted-foreground">Obs: {item.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total de itens: <span className="text-foreground">{order.total_items}</span>
                      </div>
                    </div>
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
