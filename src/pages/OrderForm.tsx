import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { CartItem, getCart, saveCart, getCartSubtotal, getProductUnitPrice } from "@/lib/products";
import { formatBRL } from "@/lib/formatMoney";
import { CartTotalBar } from "@/components/CartTotalBar";
import { ORDERS_TABLE, toOrderItems, type SubmittedCartLine } from "@/lib/orders";
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
  const navigate = useNavigate();
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
  const summaryRef = useRef<HTMLDivElement>(null);

  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartSubtotal = useMemo(() => getCartSubtotal(cart), [cart]);
  const scrollToSummary = useCallback(() => {
    summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
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

    const orderItems = toOrderItems(cart);
    const orderSubtotal = getCartSubtotal(cart);

    const payload = {
      customer_name: form.name.trim(),
      customer_phone: form.phone.trim(),
      customer_company: form.company.trim(),
      customer_cnpj: form.cnpj.trim(),
      items: orderItems as unknown as Json,
      total_items: totalItems,
      status: "NOVO CARRINHO",
    };

    const { error } = await supabase.from(ORDERS_TABLE).insert(payload);

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

    const submittedCart: SubmittedCartLine[] = cart.map((item) => {
      const unit = getProductUnitPrice(item.product);
      const qty = item.quantity;
      return {
        name: item.product.name,
        type: item.product.type,
        family: item.product.family,
        quantity: qty,
        unit_price: unit,
        line_total: Math.round(unit * qty * 100) / 100,
        notes: item.notes,
      };
    });

    saveCart([]);
    setCart([]);
    toast.success("Pedido enviado com sucesso!");

    try {
      const itemsForWebhook = orderItems.map((row) => ({
        product_id: row.product_id,
        name: row.name,
        type: row.type,
        family: row.family,
        quantity: row.quantity,
        unit_price: row.unit_price,
        line_total: row.line_total,
        notes: row.notes,
      }));
      const cartTotal = Math.round(orderSubtotal * 100) / 100;

      await fetch("https://webhooks-n8n.iainfinity.app/webhook/novo-carrinho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: payload,
          items: itemsForWebhook,
          total_items: payload.total_items,
          order_subtotal: cartTotal,
          cart_total: cartTotal,
          valor_total_carrinho: cartTotal,
          currency: "BRL",
          status: payload.status,
        }),
      });
    } catch (err) {
      console.warn("Falha ao enviar webhook do pedido", err);
    }

    navigate("/pedido/obrigado", {
      replace: true,
      state: {
        customerName: payload.customer_name,
        company: payload.customer_company,
        totalItems: payload.total_items,
        submittedCart,
        orderSubtotal,
      },
    });
  };

  return (
    <div className={`min-h-screen bg-background${cart.length > 0 ? " pb-28" : ""}`}>
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex h-14 items-center gap-3 px-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <span className="font-semibold text-foreground">Finalizar pedido</span>
        </div>
      </header>

      <div className="container mx-auto max-w-3xl px-4 py-6">
        {cart.length === 0 ? (
          <div className="space-y-3 rounded-xl border border-border bg-card p-6 text-center">
            <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-foreground">Seu carrinho esta vazio</p>
            <p className="text-sm text-muted-foreground">Volte ao catalogo para selecionar produtos.</p>
            <Link to="/">
              <Button variant="outline">Voltar ao catalogo</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-3">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Seus dados</h2>

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
                  <Send className="h-4 w-4" />
                  {submitting ? "Enviando..." : "Enviar pedido"}
                </Button>
              </form>
            </div>

            <div ref={summaryRef} className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Resumo do carrinho</h2>
                <Badge variant="secondary">{totalItems} item(s)</Badge>
              </div>

              <div className="space-y-3">
                {cart.map((item) => {
                  const unit = getProductUnitPrice(item.product);
                  const line = unit * item.quantity;
                  return (
                  <div key={item.product.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-foreground">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.product.type} · {item.product.family}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Quantidade: <span className="font-medium text-foreground">{item.quantity}</span>
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground tabular-nums">
                      {formatBRL(unit)} × {item.quantity} = {formatBRL(line)}
                    </p>
                    {item.notes?.trim() && (
                      <div className="mt-2 rounded-md bg-muted/50 p-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Observacoes
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground">
                          {item.notes.trim()}
                        </p>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm font-medium text-muted-foreground">Total estimado</span>
                <span className="text-lg font-semibold text-foreground tabular-nums">{formatBRL(cartSubtotal)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <CartTotalBar
        total={cartSubtotal}
        itemCount={totalItems}
        visible={cart.length > 0}
        onOpenCart={scrollToSummary}
      />
    </div>
  );
}
