import { useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, ShoppingBag, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddressFields } from "@/components/pedido/AddressFields";
import { CustomerDataFields } from "@/components/pedido/CustomerDataFields";
import { useCnpjValidation } from "@/hooks/useCnpjValidation";
import { assertAddressReady, addressToOrderColumns, addressToProxisPayload, emptyAddressForm } from "@/lib/address";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { CartItem, getCart, getProductImageUrls, saveCart } from "@/lib/products";
import { formatBRL } from "@/lib/formatMoney";
import { CartTotalBar } from "@/components/carrinho/CartTotalBar";
import { PageHeaderShell } from "@/components/layout/PageHeaderShell";
import { ORDERS_TABLE, toOrderItems, type SubmittedCartLine } from "@/lib/orders";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerPricing } from "@/hooks/useCustomerPricing";
import { calculateCartSubtotal, resolveProductPrice } from "@/lib/pricing";

function getCartImage(item: CartItem): string | null {
  return getProductImageUrls(item.product)[0] ?? item.product.image_url ?? null;
}

export default function OrderForm() {
  const navigate = useNavigate();
  const { customerProfile } = useAuth();
  const { data: customerPriceMap = new Map<string, number>() } = useCustomerPricing(
    customerProfile?.customer_type,
  );
  const [cart, setCart] = useState<CartItem[]>(getCart);
  const [submitting, setSubmitting] = useState(false);
  const [cnpjTouched, setCnpjTouched] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    company: "",
    cnpj: "",
  });
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const summaryRef = useRef<HTMLDivElement>(null);
  const cnpjValidation = useCnpjValidation(form.cnpj, cnpjTouched);
  const { assertCnpjReady } = cnpjValidation;

  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartSubtotal = useMemo(
    () => calculateCartSubtotal(cart, customerPriceMap),
    [cart, customerPriceMap],
  );
  const scrollToSummary = useCallback(() => {
    summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cart.length === 0) {
      toast.info("Carrinho vazio");
      return;
    }

    const cnpjMessage = assertCnpjReady();
    if (cnpjMessage) {
      if (cnpjMessage === "Validando CNPJ...") toast.info(cnpjMessage);
      else toast.error(cnpjMessage);
      return;
    }

    const addressMessage = assertAddressReady(addressForm);
    if (addressMessage) {
      toast.error(addressMessage);
      return;
    }

    setSubmitting(true);

    const priceResolver = (product: CartItem["product"]) => resolveProductPrice(product, customerPriceMap);
    const orderItems = toOrderItems(cart, priceResolver);
    const orderSubtotal = calculateCartSubtotal(cart, customerPriceMap);

    const payload = {
      customer_name: form.name.trim(),
      customer_phone: form.phone.trim(),
      customer_company: form.company.trim(),
      customer_cnpj: form.cnpj.trim(),
      ...addressToOrderColumns(addressForm),
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

    try {
      const proxisItems = orderItems.map((row) => ({
        product_code: row.product_code || "",
        quantity: row.quantity,
        unit_price: row.unit_price,
        name: row.name,
      }));

      const proxisRes = await fetch("/api/proxis-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: form.name.trim(),
          customer_cnpj: form.cnpj.trim(),
          customer_company: form.company.trim(),
          address: addressToProxisPayload(addressForm),
          items: proxisItems,
        }),
      });

      if (!proxisRes.ok) {
        const errBody = await proxisRes.json().catch(() => ({}));
        console.warn("Proxis ERP retornou erro", { status: proxisRes.status, errBody });
      } else {
        const proxisData = await proxisRes.json().catch(() => null);
        console.info("Pedido enviado ao Proxis ERP", proxisData);
      }
    } catch (err) {
      console.warn("Falha ao enviar pedido para Proxis ERP", err);
    }

    const submittedCart: SubmittedCartLine[] = cart.map((item) => {
      const unit = resolveProductPrice(item.product, customerPriceMap);
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
      viewTransition: true,
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
      <PageHeaderShell>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Link to="/" viewTransition>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border bg-background shadow-sm"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="space-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                  Checkout
                </p>
                <p className="text-sm font-medium text-foreground">Revise sua compra</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1 tabular-nums">
                {totalItems} item(ns)
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-full px-4"
                onClick={scrollToSummary}
              >
                Ver resumo
              </Button>
            </div>
        </div>
      </PageHeaderShell>

      <div className="container mx-auto max-w-[1400px] px-4 py-6 lg:py-8">
        {cart.length === 0 ? (
          <div className="mx-auto max-w-xl space-y-3 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-foreground">Seu carrinho está vazio</p>
            <p className="text-sm text-muted-foreground">Volte ao catálogo para selecionar produtos.</p>
            <Link to="/" viewTransition>
              <Button variant="outline">Voltar ao catálogo</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="grid gap-0">
                <div className="relative z-10 p-6 sm:p-8 lg:p-10">
                  <h1 className="mt-4 text-2xl font-semibold leading-tight text-foreground sm:text-3xl lg:text-4xl">
                    Finalizar pedido
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                    Revise seus dados, confirme o endereço e envie tudo de uma vez para o atendimento.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {totalItems} item(ns)
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3 py-1 tabular-nums">
                      {formatBRL(cartSubtotal)}
                    </Badge>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
              <div className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h2 className="text-lg font-semibold text-foreground">Dados do cliente</h2>
                        <p className="text-sm text-muted-foreground">
                          Contato, empresa e identificação para confirmar o pedido.
                        </p>
                      </div>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        Cadastro
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      <CustomerDataFields
                        form={form}
                        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                        onCnpjBlur={() => setCnpjTouched(true)}
                        cnpjValidation={cnpjValidation}
                      />
                    </div>
                  </section>

                  <AddressFields
                    form={addressForm}
                    onChange={(patch) => setAddressForm((prev) => ({ ...prev, ...patch }))}
                  />

                  <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Pronto para enviar</p>
                        <p className="text-sm text-muted-foreground">
                          O resumo ao lado mostra itens, quantidades e total estimado.
                        </p>
                      </div>

                      <Button type="submit" className="w-full gap-2 sm:w-auto" size="lg" disabled={submitting}>
                        <Send className="h-4 w-4" />
                        {submitting ? "Enviando..." : "Enviar pedido"}
                      </Button>
                    </div>
                  </section>
                </form>
              </div>

              <div
                ref={summaryRef}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100vh-7rem)] lg:flex-col lg:self-start"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-foreground">Resumo do carrinho</h2>
                    <p className="text-sm text-muted-foreground">
                      Confira itens, quantidades e totais antes de enviar.
                    </p>
                  </div>
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    {totalItems} item(ns)
                  </Badge>
                </div>

                <div className="min-h-0 space-y-3 lg:flex-1 lg:overflow-y-auto lg:pr-1">
                  {cart.map((item) => {
                    const unit = resolveProductPrice(item.product, customerPriceMap);
                    const line = unit * item.quantity;
                    const imageUrl = getCartImage(item);

                    return (
                      <div
                        key={item.product.id}
                        className="rounded-2xl border border-border/80 bg-background p-4 shadow-sm transition-colors hover:border-primary/20"
                      >
                        <div className="flex gap-4">
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/30">
                            {imageUrl ? (
                              <img src={imageUrl} alt={item.product.name} className="h-full w-full object-contain p-2" />
                            ) : (
                              <ImageIcon className="h-8 w-8 text-muted-foreground/35" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                                  {item.product.name}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {item.product.type} · {item.product.family}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className="shrink-0 rounded-full border-primary/15 bg-primary/5 px-2 py-0.5 text-[11px] text-foreground"
                              >
                                {item.quantity} un
                              </Badge>
                            </div>

                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-muted-foreground">Unitário</span>
                              <span className="font-medium text-foreground tabular-nums">{formatBRL(unit)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-muted-foreground">Subtotal</span>
                              <span className="font-semibold text-foreground tabular-nums">{formatBRL(line)}</span>
                            </div>

                            {item.notes?.trim() && (
                              <div className="rounded-xl bg-muted/50 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  Observações
                                </p>
                                <p className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground">
                                  {item.notes.trim()}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 rounded-2xl border border-border bg-muted/20 p-4 lg:mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-muted-foreground">Total estimado</span>
                    <span className="text-xl font-semibold text-foreground tabular-nums">{formatBRL(cartSubtotal)}</span>
                  </div>
                </div>
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
