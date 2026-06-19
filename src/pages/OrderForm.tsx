import { useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddressFields } from "@/components/pedido/AddressFields";
import { CustomerDataFields } from "@/components/pedido/CustomerDataFields";
import { useCnpjValidation } from "@/hooks/useCnpjValidation";
import { assertAddressReady, addressToOrderColumns, addressToProxisPayload, emptyAddressForm } from "@/lib/address";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { CartItem, getCart, saveCart } from "@/lib/products";
import { formatBRL } from "@/lib/formatMoney";
import { CartTotalBar } from "@/components/carrinho/CartTotalBar";
import { ORDERS_TABLE, toOrderItems, type SubmittedCartLine } from "@/lib/orders";
import { toast } from "sonner";
import { CatalogOrderNotice } from "@/components/catalogo/CatalogOrderNotice";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerPricing } from "@/hooks/useCustomerPricing";
import { calculateCartSubtotal, resolveProductPrice } from "@/lib/pricing";

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

    // Enviar pedido ao Proxis ERP (não bloqueia o checkout se falhar)
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
        {cart.length > 0 && <CatalogOrderNotice className="mb-6" />}
        {cart.length === 0 ? (
          <div className="space-y-3 rounded-xl border border-border bg-card p-6 text-center">
            <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-foreground">Seu carrinho está vazio</p>
            <p className="text-sm text-muted-foreground">Volte ao catálogo para selecionar produtos.</p>
            <Link to="/">
              <Button variant="outline">Voltar ao catálogo</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-3">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Seus dados</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <CustomerDataFields
                  form={form}
                  onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                  onCnpjBlur={() => setCnpjTouched(true)}
                  cnpjValidation={cnpjValidation}
                />

                <AddressFields
                  form={addressForm}
                  onChange={(patch) => setAddressForm((prev) => ({ ...prev, ...patch }))}
                />

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
                  const unit = resolveProductPrice(item.product, customerPriceMap);
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
