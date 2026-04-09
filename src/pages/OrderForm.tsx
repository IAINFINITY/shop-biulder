import { useEffect, useMemo, useState } from "react";
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

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const formatCnpj = (value: string) => {
  const digits = onlyDigits(value).slice(0, 14);
  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 5);
  const part3 = digits.slice(5, 8);
  const part4 = digits.slice(8, 12);
  const part5 = digits.slice(12, 14);
  let formatted = part1;
  if (part2) formatted += `.${part2}`;
  if (part3) formatted += `.${part3}`;
  if (part4) formatted += `/${part4}`;
  if (part5) formatted += `-${part5}`;
  return formatted;
};

const formatPhone = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  const ddd = digits.slice(0, 2);
  const isMobile = digits.length > 10;
  const part1 = digits.slice(2, isMobile ? 7 : 6);
  const part2 = digits.slice(isMobile ? 7 : 6);
  let formatted = `(${ddd})`;
  if (part1) formatted += ` ${part1}`;
  if (part2) formatted += `-${part2}`;
  return formatted;
};

const isValidCnpj = (value: string) => {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const calcCheckDigit = (base: string, weights: number[]) => {
    const sum = base
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const digit1 = calcCheckDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digit2 = calcCheckDigit(`${digits.slice(0, 12)}${digit1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${digit1}${digit2}`);
};

export default function OrderForm() {
  const [cart, setCart] = useState<CartItem[]>(getCart);
  const [submitting, setSubmitting] = useState(false);
  const [cnpjTouched, setCnpjTouched] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    company: "",
    cnpj: "",
  });
  const [cnpjStatus, setCnpjStatus] = useState<"idle" | "checking" | "valid" | "invalid" | "error">("idle");

  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cnpjDigits = onlyDigits(form.cnpj);
  const isCnpjIncomplete = cnpjDigits.length > 0 && cnpjDigits.length < 14;
  const isCnpjComplete = cnpjDigits.length === 14;
  const shouldShowCnpjError = cnpjTouched || isCnpjComplete;
  const isCnpjInvalid = isCnpjComplete && cnpjStatus === "invalid";
  const isCnpjError = isCnpjComplete && cnpjStatus === "error";
  const isCnpjChecking = isCnpjComplete && cnpjStatus === "checking";

  useEffect(() => {
    if (!isCnpjComplete) {
      setCnpjStatus("idle");
      return;
    }
    if (!isValidCnpj(cnpjDigits)) {
      setCnpjStatus("invalid");
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setCnpjStatus("checking");
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          setCnpjStatus("valid");
          return;
        }
        if (response.status === 404) {
          setCnpjStatus("invalid");
          return;
        }
        setCnpjStatus("error");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setCnpjStatus("error");
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [cnpjDigits, isCnpjComplete]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.info("Carrinho vazio");
      return;
    }
    const cnpjDigits = onlyDigits(form.cnpj);
    if (cnpjDigits.length !== 14) {
      toast.error("CNPJ incompleto. Preencha 14 digitos.");
      return;
    }
    if (!isValidCnpj(cnpjDigits)) {
      toast.error("CNPJ invalido. Verifique o numero informado.");
      return;
    }
    if (cnpjStatus === "checking") {
      toast.info("Validando CNPJ...");
      return;
    }
    if (cnpjStatus === "invalid") {
      toast.error("CNPJ invalido. Verifique o numero informado.");
      return;
    }
    if (cnpjStatus === "error") {
      toast.error("Nao foi possivel validar o CNPJ agora. Tente novamente.");
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
      console.error("Erro ao inserir pedido no Supabase", { error, payload });
      const lowerMessage = error.message?.toLowerCase() ?? "";
      const isRlsError = lowerMessage.includes("row-level security");
      toast.error(
        isRlsError
          ? "Permissao negada ao salvar o pedido. Verifique as politicas (RLS) da tabela orders."
          : error.message || "Erro ao enviar pedido"
      );
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
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        phone: formatPhone(e.target.value),
                      }))
                    }
                    placeholder="(00) 00000-0000"
                    inputMode="numeric"
                    maxLength={15}
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
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        cnpj: formatCnpj(e.target.value),
                      }))
                    }
                    onBlur={() => setCnpjTouched(true)}
                    placeholder="00.000.000/0000-00"
                    inputMode="numeric"
                    maxLength={18}
                    aria-invalid={shouldShowCnpjError && (isCnpjIncomplete || isCnpjInvalid || isCnpjError)}
                    className={
                      shouldShowCnpjError && (isCnpjIncomplete || isCnpjInvalid || isCnpjError)
                        ? "border-destructive focus-visible:ring-destructive"
                        : undefined
                    }
                    required
                  />
                  {shouldShowCnpjError && isCnpjIncomplete && (
                    <p className="text-xs text-destructive">CNPJ incompleto. Preencha 14 digitos.</p>
                  )}
                  {shouldShowCnpjError && isCnpjInvalid && (
                    <p className="text-xs text-destructive">CNPJ invalido. Verifique o numero informado.</p>
                  )}
                  {shouldShowCnpjError && isCnpjError && (
                    <p className="text-xs text-destructive">
                      Nao foi possivel validar o CNPJ agora. Tente novamente.
                    </p>
                  )}
                  {shouldShowCnpjError && isCnpjChecking && (
                    <p className="text-xs text-muted-foreground">Validando CNPJ...</p>
                  )}
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
