import { useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Send, ShoppingBag, ImageIcon, User, MapPin, FileText, CreditCard, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AddressFields } from "@/components/pedido/AddressFields";
import { CustomerDataFields } from "@/components/pedido/CustomerDataFields";
import { useCnpjValidation } from "@/hooks/useCnpjValidation";
import { assertAddressReady, addressToOrderColumns, addressToProxisPayload, emptyAddressForm } from "@/lib/address";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { type CartItem, getProductImageUrls } from "@/lib/products";
import { formatBRL } from "@/lib/formatMoney";
import { PageHeaderShell } from "@/components/layout/PageHeaderShell";
import { AuthStatusScreen } from "@/components/auth/AuthStatusScreen";
import { ORDERS_TABLE, toOrderItems, type SubmittedCartLine } from "@/lib/orders";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useCustomerPricing } from "@/hooks/useCustomerPricing";
import { useCustomerAddresses } from "@/hooks/useCustomerAddresses";
import { calculateCartSubtotal, DEFAULT_CUSTOMER_TYPE, resolveProductPrice } from "@/lib/pricing";
import { buildLoginPath } from "@/lib/navigation";
import { formatCep } from "@/lib/address";
import { profileAddressToForm } from "@/lib/customerProfile";
import { customerAddressFormFromAddress, type CustomerAddressFormData } from "@/lib/customerAddresses";
import { ORDER_TEXT_LIMITS } from "@/lib/orderTextLimits";
import {
  REPRESENTATIVE_PHONE_DISPLAY,
  REPRESENTATIVE_PHONE_WHATSAPP_URL,
} from "@/lib/supportContact";

const ORDER_SUCCESS_SNAPSHOT_KEY = "clinicplus_last_order_success";
const ORDER_WEBHOOK_URL =
  import.meta.env.VITE_ORDER_WEBHOOK_URL?.trim() || "https://webhooks-n8n.iainfinity.app/webhook/novo-carrinho";

function getCartImage(item: CartItem): string | null {
  return getProductImageUrls(item.product)[0] ?? item.product.image_url ?? null;
}

function isAddressFormBlank(form: ReturnType<typeof emptyAddressForm>) {
  return Object.values(form).every((value) => typeof value === "string" && value.trim() === "");
}

function isSameAddressForm(
  left: ReturnType<typeof emptyAddressForm>,
  right: ReturnType<typeof emptyAddressForm>,
) {
  const normalize = (value: string) => value.trim();
  const normalizeDigits = (value: string) => normalize(value).replace(/\D/g, "");
  return (
    normalizeDigits(left.cep) === normalizeDigits(right.cep) &&
    normalize(left.street) === normalize(right.street) &&
    normalize(left.number) === normalize(right.number) &&
    normalize(left.complement) === normalize(right.complement) &&
    normalize(left.neighborhood) === normalize(right.neighborhood) &&
    normalize(left.city) === normalize(right.city) &&
    normalize(left.state).toUpperCase() === normalize(right.state).toUpperCase() &&
    normalizeDigits(left.ibge) === normalizeDigits(right.ibge)
  );
}

export default function OrderForm() {
  const navigate = useNavigate();
  const { user, customerProfile, loading, isResolvingAccess } = useAuth();
  const allowGuestCheckout = import.meta.env.DEV;
  const customerType = customerProfile?.customer_type ?? null;
  const customerTprId = customerProfile?.proxis_tpr_id ?? null;
  const { data: customerPriceMap = new Map<string, number>() } = useCustomerPricing(
    customerType,
    customerTprId,
  );
  const { data: savedAddresses = [], saveAddress, setDefaultAddress } = useCustomerAddresses(user?.id ?? null);
  const { cart, clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [cnpjTouched, setCnpjTouched] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [manualAddressEdit, setManualAddressEdit] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    company: "",
    cnpj: "",
    customer_type: DEFAULT_CUSTOMER_TYPE,
  });
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const summaryRef = useRef<HTMLDivElement>(null);
  const cnpjValidation = useCnpjValidation(form.cnpj, cnpjTouched);
  const { assertCnpjReady } = cnpjValidation;
  const submitLockRef = useRef(false);
  const selectedSavedAddress = useMemo(
    () => (selectedAddressId ? savedAddresses.find((address) => address.id === selectedAddressId) ?? null : null),
    [savedAddresses, selectedAddressId],
  );
  const preferredSavedAddress = useMemo(
    () => savedAddresses.find((address) => address.is_default) ?? savedAddresses[0] ?? null,
    [savedAddresses],
  );
  const checkoutAddress = !manualAddressEdit && selectedSavedAddress ? selectedSavedAddress : addressForm;
  const checkoutAddressMatchesSavedAddress = useMemo(
    () =>
      savedAddresses.some((address) =>
        isSameAddressForm(checkoutAddress, customerAddressFormFromAddress(address)),
      ),
    [checkoutAddress, savedAddresses],
  );
  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartSubtotal = useMemo(
    () => calculateCartSubtotal(cart, customerPriceMap),
    [cart, customerPriceMap],
  );

  const scrollToSummary = useCallback(() => {
    summaryRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    if (!customerProfile) return;

    setForm((prev) => ({
      name: prev.name.trim() ? prev.name : customerProfile.name ?? "",
      phone: prev.phone.trim() ? prev.phone : customerProfile.phone ?? "",
      company: prev.company.trim() ? prev.company : customerProfile.company ?? "",
      cnpj: prev.cnpj.trim() ? prev.cnpj : customerProfile.cnpj ?? "",
      customer_type:
        prev.customer_type === DEFAULT_CUSTOMER_TYPE
          ? customerProfile.customer_type ?? prev.customer_type
          : prev.customer_type,
    }));
  }, [customerProfile]);

  useEffect(() => {
    if (savedAddresses.length > 0) {
      const nextAddress = selectedSavedAddress ?? preferredSavedAddress;

      if (!nextAddress || manualAddressEdit) return;

      const nextForm = customerAddressFormFromAddress(nextAddress);

      setSelectedAddressId(nextAddress.id);
      setAddressForm((prev) => (isSameAddressForm(prev, nextForm) ? prev : nextForm));
      return;
    }

    if (manualAddressEdit || !customerProfile) return;

    const profileAddress = profileAddressToForm(customerProfile);
    if (!isAddressFormBlank(profileAddress)) {
      setSelectedAddressId(null);
      setAddressForm((prev) => (isSameAddressForm(prev, profileAddress) ? prev : profileAddress));
    }
  }, [customerProfile, manualAddressEdit, savedAddresses, selectedSavedAddress, preferredSavedAddress]);

  const persistCheckoutAddress = useCallback(
    async ({ notify }: { notify: boolean }) => {
      if (!user) return { ok: false as const, saved: false as const };

      const addressMessage = assertAddressReady(checkoutAddress);
      if (addressMessage) {
        if (notify) toast.error(addressMessage);
        return { ok: false as const, saved: false as const };
      }

      const addressPayload: CustomerAddressFormData = {
        ...checkoutAddress,
        label: savedAddresses.length > 0 ? "Endereço do pedido" : "Principal",
        is_default: savedAddresses.length === 0,
      };

      const { error, data } = await saveAddress(addressPayload);
      if (error) {
        if (notify) {
          console.error("Erro ao salvar endereço", error);
          toast.error("Não foi possível salvar o endereço");
        }
        return { ok: false as const, saved: false as const };
      }

      if (addressPayload.is_default && data?.id) {
        const defaultResult = await setDefaultAddress(data.id);
        if (defaultResult.error) {
          if (notify) {
            console.error("Erro ao definir endereço padrão", defaultResult.error);
            toast.error("Não foi possível definir o endereço padrão");
          }
          return { ok: false as const, saved: false as const };
        }
      }

      if (data?.id) {
        setSelectedAddressId(data.id);
      }
      setManualAddressEdit(false);
      if (data) {
        setAddressForm(customerAddressFormFromAddress(data));
      }

      if (notify) {
        toast.success("Endereço salvo na sua conta.");
      }

      return { ok: true as const, saved: true as const };
    },
    [checkoutAddress, savedAddresses.length, saveAddress, setDefaultAddress, user],
  );

  const handleSaveCheckoutAddress = useCallback(async () => {
    if (!user) return;
    setSavingAddress(true);
    await persistCheckoutAddress({ notify: true });
    setSavingAddress(false);
  }, [persistCheckoutAddress, user]);

  if (loading || isResolvingAccess) {
    return (
      <AuthStatusScreen
        eyebrow="Checkout"
        title="Abrindo o pedido"
        description="Estamos preparando sua sessão para continuar com a finalização do carrinho."
      />
    );
  }

  if (!user && !allowGuestCheckout) {
    return (
      <AuthStatusScreen
          eyebrow="Checkout"
          title="Acesso ao pedido necessário"
          description="Para finalizar seu pedido, entre com sua conta e volte ao carrinho. Assim mantemos seus dados e preços vinculados corretamente."
          actions={
            <div className="space-y-3">
              <div className="rounded-[1.25rem] border border-border/70 bg-background p-4 text-sm text-muted-foreground">
                Se preferir, fale com o consultor / representante no WhatsApp:{" "}
                <a className="font-medium text-primary hover:underline" href={REPRESENTATIVE_PHONE_WHATSAPP_URL} target="_blank" rel="noreferrer">
                  {REPRESENTATIVE_PHONE_DISPLAY}
                </a>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to={buildLoginPath("/pedido")} viewTransition>
                  <Button className="rounded-full px-5">Entrar</Button>
                </Link>
                <Link to="/" viewTransition>
                  <Button variant="outline" className="rounded-full px-5">
                    Voltar ao catálogo
                  </Button>
                </Link>
              </div>
            </div>
          }
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitLockRef.current) return;

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

    submitLockRef.current = true;
    setSubmitting(true);

    try {
      const addressMessage = assertAddressReady(checkoutAddress);
      if (addressMessage) {
        toast.error(addressMessage);
        return;
      }

      if (!checkoutAddressMatchesSavedAddress) {
        const savedAddressResult = await persistCheckoutAddress({ notify: false });
        if (!savedAddressResult.ok) {
          return;
        }
      }

      const priceResolver = (product: CartItem["product"]) => resolveProductPrice(product, customerPriceMap);
      const orderItems = toOrderItems(cart, priceResolver);
      const orderSubtotal = calculateCartSubtotal(cart, customerPriceMap);

      const payload = {
        customer_name: form.name.trim(),
        customer_phone: form.phone.trim(),
        customer_company: form.company.trim(),
        customer_cnpj: form.cnpj.trim(),
        customer_observation: orderNote.trim() || null,
        ...addressToOrderColumns(checkoutAddress),
        items: orderItems as unknown as Json,
        total_items: totalItems,
        status: "NOVO CARRINHO",
      };

      const { error } = await supabase.from(ORDERS_TABLE).insert(payload as never);

      if (error) {
        console.error("Erro ao inserir pedido no Supabase", { error, payload });
        toast.error("Erro ao enviar pedido. Tente novamente.");
        return;
      }

      const proxisItems = orderItems.map((row) => ({
        product_code: row.product_code || "",
        quantity: row.quantity,
        unit_price: row.unit_price,
        name: row.name,
      }));
      let proxisWarning: string | null = null;

      try {
        const proxisRes = await fetch("/api/proxis-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: form.name.trim(),
            customer_cnpj: form.cnpj.trim(),
            customer_company: form.company.trim(),
            customer_observation: orderNote.trim() || null,
            address: addressToProxisPayload(checkoutAddress),
            items: proxisItems,
            note: orderNote.trim() || "Pedido enviado a partir do carrinho do catálogo.",
          }),
        });

        if (!proxisRes.ok) {
          const errBody = await proxisRes.json().catch(() => ({}));
          proxisWarning =
            typeof errBody.error === "string" && errBody.error.trim()
              ? errBody.error
              : `status ${proxisRes.status}`;
        }
      } catch (err) {
        proxisWarning = err instanceof Error ? err.message : "erro desconhecido";
      }

      try {
        const bitrixRes = await fetch("/api/bitrix-deal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: form.name.trim(),
            customer_company: form.company.trim(),
            customer_cnpj: form.cnpj.trim(),
            customer_phone: form.phone.trim(),
            customer_observation: orderNote.trim() || null,
            address: {
              cep: checkoutAddress.cep,
              street: checkoutAddress.street,
              number: checkoutAddress.number,
              complement: checkoutAddress.complement,
              neighborhood: checkoutAddress.neighborhood,
              city: checkoutAddress.city,
              state: checkoutAddress.state,
            },
            items: proxisItems,
            total_amount: orderSubtotal,
            source: "clinicplus-b2b",
            note: orderNote.trim() || "Pedido enviado a partir do carrinho do catálogo.",
          }),
        });

        if (!bitrixRes.ok) {
          await bitrixRes.json().catch(() => ({}));
        }
      } catch (err) {
        void err;
      }

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

        await fetch(ORDER_WEBHOOK_URL, {
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

      if (proxisWarning) {
        toast.warning(`O pedido foi salvo, mas o Proxsys não recebeu o envio. Motivo: ${proxisWarning}`);
      }

      const submittedCart: SubmittedCartLine[] = cart.map((item) => {
        const unit = resolveProductPrice(item.product, customerPriceMap);
        const qty = item.quantity;
        return {
          imageUrl: getCartImage(item),
          name: item.product.name,
          type: item.product.type,
          family: item.product.family,
          quantity: qty,
          unit_price: unit,
          line_total: Math.round(unit * qty * 100) / 100,
          notes: item.notes,
        };
      });

      clearCart();
      toast.success("Pedido enviado com sucesso!");

      const successState = {
        customerName: payload.customer_name,
        customerPhone: payload.customer_phone,
        company: payload.customer_company,
        customerCnpj: payload.customer_cnpj,
        customerAddress: checkoutAddress,
        totalItems: payload.total_items,
        submittedCart,
        orderSubtotal,
        orderNote: orderNote.trim(),
      };

      try {
        sessionStorage.setItem(ORDER_SUCCESS_SNAPSHOT_KEY, JSON.stringify(successState));
      } catch {
        // ignore storage failures
      }

      navigate("/pedido/obrigado", {
        replace: true,
        viewTransition: true,
        state: successState,
      });
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  return (
    <div className="relative min-h-screen bg-[linear-gradient(180deg,hsl(var(--primary)/0.04),hsl(var(--background))_28%,hsl(var(--background)))]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-200px] h-96 w-96 -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="absolute right-[-100px] top-40 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      </div>
      <div className="relative pb-28">
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
        {!user && allowGuestCheckout ? (
          <div className="mb-6 flex items-start gap-3 rounded-[1.25rem] border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-foreground">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-primary">Modo de diagnóstico ativo</p>
              <p className="text-muted-foreground">
                Checkout liberado para depuração local. Isso não altera a regra normal de login.
              </p>
            </div>
          </div>
        ) : null}

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
            <section className="relative overflow-hidden rounded-[1.75rem] border border-border/60 bg-card/95 shadow-sm">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent" />
              <div className="relative z-10 p-6 sm:p-8 lg:p-10">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <ShoppingBag className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">
                      Checkout
                    </p>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                      Finalizar pedido
                    </h1>
                  </div>
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Revise seus dados, confirme o endereço e envie tudo para o atendimento.
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
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
              <div className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <h2 className="text-base font-semibold text-foreground">Dados do cliente</h2>
                          <p className="text-sm text-muted-foreground">
                            Contato, empresa e CNPJ para confirmar o pedido.
                          </p>
                        </div>
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

                  {savedAddresses.length > 0 ? (
                    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warm/10">
                            <MapPin className="h-4 w-4 text-warm" />
                          </div>
                          <div className="space-y-1">
                            <h2 className="text-base font-semibold text-foreground">Endereços salvos</h2>
                            <p className="text-sm text-muted-foreground">
                              Selecione um endereço para usar na compra ou edite os campos abaixo.
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="rounded-full px-3 py-1">
                          {savedAddresses.length}/5
                        </Badge>
                      </div>

                      <div className="grid gap-3">
                        {savedAddresses.map((address, index) => {
                          const isActive = selectedAddressId ? selectedAddressId === address.id : index === 0 || address.is_default;

                          return (
                          <button
                            key={address.id}
                            type="button"
                            onClick={() => {
                              setSelectedAddressId(address.id);
                              setManualAddressEdit(false);
                              setAddressForm({
                                cep: address.cep,
                                street: address.street,
                                number: address.number,
                                complement: address.complement,
                                neighborhood: address.neighborhood,
                                city: address.city,
                                state: address.state,
                                ibge: address.ibge,
                              });
                            }}
                            className={`rounded-2xl border p-4 text-left transition-colors ${
                              isActive
                                ? "border-primary bg-primary/5"
                                : "border-border bg-background hover:border-primary/20 hover:bg-muted/20"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-foreground">{address.label}</p>
                                  {address.is_default ? (
                                    <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                                      Padrão
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {address.street}, {address.number}
                                  {address.complement ? ` · ${address.complement}` : ""}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {address.neighborhood} · {address.city}/{address.state}
                                </p>
                                <p className="text-sm text-muted-foreground">{formatCep(address.cep)}</p>
                              </div>
                              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                Usar
                              </span>
                            </div>
                          </button>
                        );
                        })}
                      </div>
                    </section>
                  ) : (
                    <section className="rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-5 text-sm text-foreground">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warm/10">
                          <MapPin className="h-4 w-4 text-warm" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-primary">Nenhum endereço salvo</p>
                          <p className="text-muted-foreground">
                            Preencha os campos abaixo para usar este endereço no pedido.
                          </p>
                        </div>
                      </div>
                    </section>
                  )}

                  <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warm/10">
                        <MapPin className="h-4 w-4 text-warm" />
                      </div>
                      <div className="space-y-0.5">
                        <h2 className="text-base font-semibold text-foreground">Endereço de entrega</h2>
                        <p className="text-sm text-muted-foreground">Informe o local para receber o pedido.</p>
                      </div>
                    </div>
                    <AddressFields
                      form={addressForm}
                      onChange={(patch) => {
                        setManualAddressEdit(true);
                        setSelectedAddressId(null);
                        setAddressForm((prev) => ({ ...prev, ...patch }));
                      }}
                    />
                  </section>

                  <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5">
                          <CreditCard className="h-4 w-4 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <h2 className="text-base font-semibold text-foreground">Salvar endereço na conta</h2>
                          <p className="text-sm text-muted-foreground">
                            Salve para reutilizar depois ou continue — será salvo automaticamente no envio.
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-full border-primary/30 px-5 sm:w-auto"
                        onClick={handleSaveCheckoutAddress}
                        disabled={savingAddress || submitting || checkoutAddressMatchesSavedAddress}
                      >
                        {savingAddress ? "Salvando..." : checkoutAddressMatchesSavedAddress ? "Endereço salvo" : "Salvar endereço"}
                      </Button>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/50">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                          <h2 className="text-base font-semibold text-foreground">Observações do pedido</h2>
                          <p className="text-sm text-muted-foreground">
                            Orientação de entrega, complemento ou qualquer detalhe importante.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="secondary" className="rounded-full px-3 py-1">
                          Opcional
                        </Badge>
                        <p className="text-[11px] text-muted-foreground">
                          {orderNote.length}/{ORDER_TEXT_LIMITS.observation} caracteres
                        </p>
                      </div>
                    </div>

                    <Textarea
                      value={orderNote}
                      onChange={(e) => setOrderNote(e.target.value.slice(0, ORDER_TEXT_LIMITS.observation))}
                      placeholder="Ex.: Deixar na portaria, entregar no horário comercial, confirmar complemento antes de enviar."
                      maxLength={ORDER_TEXT_LIMITS.observation}
                      className="min-h-32 rounded-2xl border-border/70 bg-background text-sm leading-6"
                    />
                  </section>

                  <section className="rounded-2xl border border-primary/20 bg-card p-5 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-foreground">Pronto para enviar</p>
                          <p className="text-sm text-muted-foreground">
            {submitting
              ? "Enviando seu pedido..."
              : "Revise os itens ao lado e confirme o pedido."}
                          </p>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 sm:w-auto"
                        size="lg"
                        disabled={submitting}
                      >
                        <Send className="h-4 w-4" />
                        {submitting ? "Enviando..." : "Enviar pedido"}
                      </Button>
                    </div>
                    {!checkoutAddressMatchesSavedAddress ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Se o endereço ainda não estiver salvo, ele será salvo automaticamente antes do envio.
                      </p>
                    ) : null}
                  </section>
                </form>
              </div>

              <div
                ref={summaryRef}
                className="rounded-[1.75rem] border border-border/60 bg-card/95 p-5 shadow-sm sm:p-6 lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100vh-7rem)] lg:flex-col lg:self-start"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <ShoppingBag className="h-4 w-4 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold text-foreground">Resumo do carrinho</h2>
                      <p className="text-sm text-muted-foreground">
                        Confira itens e quantidades antes de enviar.
                      </p>
                    </div>
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
                               <img src={imageUrl} alt={item.product.name} width={1200} height={900} loading="lazy" decoding="async" className="h-full w-full object-contain p-2" />
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

                            {(() => {
                              const notes = item.notes?.trim() ?? "";
                              if (!notes) return null;
                              return (
                              <div className="rounded-xl bg-muted/50 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  Observações
                                </p>
                                <p className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground">
                                  {notes}
                                </p>
                              </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-5 lg:mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-muted-foreground">Total estimado</span>
                    <span className="text-2xl font-bold text-foreground tabular-nums">{formatBRL(cartSubtotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

        </div>
      </div>
    );
  }
