import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Send, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CartItem, getCart, saveCart } from "@/lib/products";
import { ORDERS_TABLE, toOrderItems } from "@/lib/orders";
import { toast } from "sonner";

export default function OrderForm() {
  const [cart, setCart] = useState<CartItem[]>(getCart);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    company: "",
    cnpj: "",
  });

  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.info("Carrinho vazio");
      return;
    }
    setSubmitting(true);
    const payload = {
      customer_name: form.name.trim(),
      customer_phone: form.phone.trim(),
      customer_company: form.company.trim(),
      customer_cnpj: form.cnpj.trim(),
      items: toOrderItems(cart),
      total_items: totalItems,
      status: "NOVO CARRINHO",
    };

    const { data, error } = await supabase
      .from(ORDERS_TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      toast.error(error.message || "Erro ao enviar pedido");
      setSubmitting(false);
      return;
    }

    const phone = "554998380268";
    const header = "Olá! Seguem os dados do pedido:";
    const customerLines = [
      `Nome: ${payload.customer_name}`,
      `Telefone: ${payload.customer_phone}`,
      `Empresa: ${payload.customer_company}`,
      `CNPJ: ${payload.customer_cnpj}`,
    ];
    const itemLines = payload.items.map((item) => {
      const base = `${item.quantity}x ${item.name} (${item.type} · ${item.family})`;
      return item.notes ? `${base} | Obs: ${item.notes}` : base;
    });
    const message = [header, "", ...customerLines, "", "Itens:", ...itemLines].join("\n");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    saveCart([]);
    setCart([]);
    toast.success("Pedido enviado para o consultor!");

    try {
      await fetch("https://webhooks-n8n.iainfinity.app/webhook/novo-carrinho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: data ?? payload,
          items: payload.items,
          total_items: payload.total_items,
          status: payload.status,
        }),
      });
    } catch (err) {
      console.warn("Falha ao enviar webhook do pedido", err);
    }
    window.location.href = url;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <span className="font-semibold text-foreground">Enviar ao Consultor</span>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {cart.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
            <ShoppingBag className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <p className="text-lg font-medium text-foreground">Seu carrinho está vazio</p>
            <p className="text-sm text-muted-foreground">Volte ao catálogo para selecionar produtos.</p>
            <Link to="/">
              <Button variant="outline">Voltar ao catálogo</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold text-foreground mb-4">Seus dados</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome completo"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Empresa</Label>
                  <Input
                    id="company"
                    value={form.company}
                    onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
                    placeholder="Nome da empresa"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={form.cnpj}
                    onChange={(e) => setForm((prev) => ({ ...prev, cnpj: e.target.value }))}
                    placeholder="00.000.000/0000-00"
                    required
                  />
                </div>
                <Button type="submit" className="w-full gap-2" size="lg" disabled={submitting}>
                  <Send className="w-4 h-4" />
                  {submitting ? "Enviando..." : "Enviar ao Consultor"}
                </Button>
              </form>
            </div>

            <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Resumo do carrinho</h2>
                <Badge variant="secondary">{totalItems} item(s)</Badge>
              </div>
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.product.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-foreground">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.product.type} · {item.product.family}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Quantidade: <span className="font-medium text-foreground">{item.quantity}</span>
                    </p>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1">Obs: {item.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
