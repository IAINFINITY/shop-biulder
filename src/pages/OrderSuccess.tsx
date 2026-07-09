import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, ImageIcon, PackageCheck, Phone, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeaderShell } from "@/components/layout/PageHeaderShell";
import { ClinicPlusLogo } from "@/components/shared/ClinicPlusLogo";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL } from "@/lib/formatMoney";
import { formatCep, type AddressFormData } from "@/lib/address";
import { profileAddressToForm } from "@/lib/customerProfile";
import { REPRESENTATIVE_PHONE_DISPLAY, REPRESENTATIVE_PHONE_WHATSAPP_URL } from "@/lib/supportContact";
import type { SubmittedCartLine } from "@/lib/orders";
import { getProductImageUrls, readCachedProductsFromStorage } from "@/lib/products";

const ORDER_SUCCESS_SNAPSHOT_KEY = "clinicplus_last_order_success";

type OrderSuccessState = {
  customerName: string;
  customerPhone?: string;
  customerCnpj?: string;
  customerAddress?: AddressFormData | null;
  company: string;
  totalItems: number;
  submittedCart: SubmittedCartLine[];
  orderSubtotal: number;
  orderNote?: string | null;
};

function formatStepCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "A confirmar";
  return value > 0 ? `${value} item(ns)` : "Carrinho enviado";
}

function formatAddress(address: AddressFormData | null | undefined) {
  if (!address) return null;

  const streetLine = [address.street?.trim(), address.number?.trim()].filter(Boolean).join(", ");
  const locality = [address.neighborhood?.trim(), address.city?.trim(), address.state?.trim()]
    .filter(Boolean)
    .join(" · ");
  const complement = address.complement?.trim();

  const lines = [streetLine, locality, formatCep(address.cep) || null, complement || null].filter(
    (value): value is string => Boolean(value),
  );

  if (lines.length === 0) return null;
  return lines;
}

function getItemImage(line: SubmittedCartLine) {
  const directImage = typeof line.imageUrl === "string" ? line.imageUrl.trim() : "";
  if (directImage) return directImage;

  const cachedProducts = [...readCachedProductsFromStorage(false), ...readCachedProductsFromStorage(true)];
  const match = cachedProducts.find((product) => {
    const sameName = product.name.trim().toLowerCase() === line.name.trim().toLowerCase();
    const sameType = product.type.trim().toLowerCase() === line.type.trim().toLowerCase();
    const sameFamily = product.family.trim().toLowerCase() === line.family.trim().toLowerCase();
    return sameName && sameType && sameFamily;
  });

  return match ? getProductImageUrls(match)[0] ?? match.image_url ?? null : null;
}

export default function OrderSuccess() {
  const location = useLocation();
  const { customerProfile } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);

  const savedSnapshot = (() => {
    try {
      const raw = sessionStorage.getItem(ORDER_SUCCESS_SNAPSHOT_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as Partial<OrderSuccessState> | null;
    } catch {
      return null;
    }
  })();

  const state = { ...(savedSnapshot ?? {}), ...(location.state ?? {}) } as OrderSuccessState;
  const submittedCart = Array.isArray(state.submittedCart) ? state.submittedCart : [];
  const hasSubmittedCart = submittedCart.length > 0;
  const orderNote = typeof state.orderNote === "string" ? state.orderNote.trim() : "";
  const fallbackAddress = customerProfile ? profileAddressToForm(customerProfile) : null;
  const resolvedCustomerName = state.customerName?.trim() || customerProfile?.name?.trim() || "Pedido confirmado";
  const resolvedCustomerPhone = state.customerPhone?.trim() || customerProfile?.phone?.trim() || "Não informado";
  const resolvedCustomerCompany =
    state.company?.trim() || customerProfile?.company?.trim() || "Cadastro recebido";
  const resolvedCustomerCnpj = state.customerCnpj?.trim() || customerProfile?.cnpj?.trim() || "CNPJ não informado";
  const resolvedCustomerAddress = state.customerAddress ?? fallbackAddress;
  const addressLines = formatAddress(resolvedCustomerAddress);

  const totalItems = useMemo(
    () => (typeof state.totalItems === "number" && Number.isFinite(state.totalItems) ? state.totalItems : 0),
    [state.totalItems],
  );
  const orderSubtotal = useMemo(
    () => (typeof state.orderSubtotal === "number" && Number.isFinite(state.orderSubtotal) ? state.orderSubtotal : null),
    [state.orderSubtotal],
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_8%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_30%),radial-gradient(circle_at_82%_18%,color-mix(in_oklch,var(--primary)_5%,transparent),transparent_28%),radial-gradient(circle_at_55%_42%,color-mix(in_oklch,var(--primary)_3%,transparent),transparent_25%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--background))_50%,hsl(var(--muted)/0.10)_100%)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-160px] h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-[-120px] top-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
      </div>

      <PageHeaderShell compact className="border-b-border/60">
        <div className="flex w-full items-center justify-between gap-4">
          <ClinicPlusLogo className="h-10 sm:h-11" />
          <Link to="/" viewTransition>
            <Button variant="outline" className="h-10 rounded-full px-4">
              Voltar ao catálogo
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </PageHeaderShell>

      <main className="relative mx-auto max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-safe">
        <section className="rounded-[1.35rem] sm:rounded-[1.75rem] border border-border/60 bg-card/95 p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:gap-5">
            <div className="max-w-4xl space-y-2 sm:space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                Obrigado, seu pedido foi enviado.
              </h2>
              <p className="max-w-2xl text-[13px] sm:text-sm leading-6 sm:leading-7 text-muted-foreground sm:text-base">
                Nosso time já recebeu sua solicitação e vai seguir com a validação do pedido. Se algo estiver
                faltando, retornamos pelo contato cadastrado.
              </p>
              <div className="space-y-1 text-[13px] sm:text-sm leading-6 sm:leading-7 text-muted-foreground">
                <p>Se precisar falar com o consultor, use o WhatsApp:</p>
                <a
                  className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
                  href={REPRESENTATIVE_PHONE_WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {REPRESENTATIVE_PHONE_DISPLAY}
                </a>
                <p>
                  Você também pode falar com o consultor pelo chat do próprio site, na área de cliente.
                </p>
              </div>
            </div>

            <div className="grid gap-2.5 sm:gap-3 sm:grid-cols-2 xl:max-w-[520px]">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-3 sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Status</p>
                <div className="mt-2 sm:mt-3 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <PackageCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Em análise</p>
                    <p className="text-xs text-muted-foreground">Processando com atendimento</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/80 p-3 sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Itens</p>
                <p className="mt-2 sm:mt-3 text-xl sm:text-2xl font-semibold tracking-tight text-foreground">{totalItems || 0}</p>
                <p className="text-xs text-muted-foreground">Item(ns) no pedido</p>
              </div>
            </div>

            {orderNote ? (
              <div className="rounded-2xl border border-border/70 bg-background/80 p-3 sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  Observação do pedido
                </p>
                <p className="mt-2 sm:mt-3 whitespace-pre-wrap break-words text-[13px] sm:text-sm leading-6 sm:leading-7 text-foreground">{orderNote}</p>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {hasSubmittedCart ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="gap-2 rounded-full border-primary/30 px-6"
                  onClick={() => setCartOpen(true)}
                >
                  <ShoppingBag className="h-4 w-4" />
                  Ver itens enviados
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <section className="rounded-[1.35rem] sm:rounded-[1.75rem] border border-border/60 bg-card/95 p-4 sm:p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">Resumo</p>
                <h3 className="text-lg font-semibold text-foreground">Dados do pedido</h3>
              </div>
            </div>

            <div className="mt-4 sm:mt-5 grid gap-2.5 sm:gap-3">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-3 sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Cliente</p>
                <p className="mt-1.5 sm:mt-2 text-sm font-semibold text-foreground">
                  {resolvedCustomerName}
                </p>
                <p className="mt-1.5 sm:mt-2 text-xs text-muted-foreground">{resolvedCustomerPhone}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-3 sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Empresa</p>
                <p className="mt-1.5 sm:mt-2 text-sm font-semibold text-foreground">
                  {resolvedCustomerCompany}
                </p>
                <p className="mt-1.5 sm:mt-2 text-xs text-muted-foreground">{resolvedCustomerCnpj}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-3 sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  Endereço de entrega
                </p>
                {addressLines ? (
                  <div className="mt-1.5 sm:mt-2 space-y-1">
                    {addressLines.map((line) => (
                      <p key={line} className="text-sm font-medium text-foreground">
                        {line}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1.5 sm:mt-2 text-sm font-medium text-foreground">Endereço não informado</p>
                )}
              </div>
              <div className="grid gap-2.5 sm:gap-3 grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-background/80 p-3 sm:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                    Itens enviados
                  </p>
                  <p className="mt-1.5 sm:mt-2 text-sm font-semibold text-foreground">{formatStepCount(totalItems)}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/80 p-3 sm:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                    Total estimado
                  </p>
                  <p className="mt-1.5 sm:mt-2 text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                    {typeof orderSubtotal === "number" ? formatBRL(orderSubtotal) : "A confirmar"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[1.35rem] sm:rounded-[1.75rem] border border-border/60 bg-card/95 p-4 sm:p-6 shadow-sm">
            <div className="space-y-2.5 sm:space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">Próximos passos</p>
              <h3 className="text-base sm:text-lg font-semibold text-foreground">Como o atendimento segue</h3>
              <div className="space-y-2.5 sm:space-y-3 pt-1 sm:pt-2">
                <div className="flex gap-3 rounded-2xl border border-border/70 bg-background/80 p-3 sm:p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    1
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Conferimos o pedido</p>
                    <p className="text-sm text-muted-foreground">Validamos cadastro, itens e endereço.</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-2xl border border-border/70 bg-background/80 p-3 sm:p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    2
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Entramos em contato</p>
                    <p className="text-sm text-muted-foreground">Se necessário, confirmamos detalhes pelo WhatsApp.</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-2xl border border-border/70 bg-background/80 p-3 sm:p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    3
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Seguimos com o fluxo interno</p>
                    <p className="text-sm text-muted-foreground">O pedido fica pronto para o próximo passo operacional.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="!flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Itens enviados
            </SheetTitle>
          </SheetHeader>

          {!hasSubmittedCart ? (
            <p className="text-sm text-muted-foreground">Nenhum detalhe do carrinho disponível para esta página.</p>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto py-4 pr-1">
                {submittedCart.map((line, index) => (
                  <div key={`${line.name}-${index}`} className="space-y-3 rounded-2xl border border-border bg-card p-3.5 text-left">
                    <div className="flex items-start gap-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background">
                        {getItemImage(line) ? (
                          <img
                            src={getItemImage(line) ?? ""}
                            alt={line.name}
                            className="h-full w-full object-contain p-1.5"
                          />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-muted-foreground/35" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{line.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {line.type} · {line.family}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              Unitário
                            </p>
                            <p className="text-sm font-semibold tabular-nums text-foreground">
                              {formatBRL(line.unit_price)}
                            </p>
                          </div>
                          <div className="space-y-0.5 text-right">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              Subtotal
                            </p>
                            <p className="text-sm font-semibold tabular-nums text-foreground">
                              {formatBRL(line.line_total)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {String(line.notes ?? "").trim() ? (
                      <div className="rounded-xl bg-muted/50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Observações
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground">
                          {String(line.notes ?? "").trim()}
                        </p>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Quantidade
                      </p>
                      <div className="flex min-w-20 items-center justify-center rounded-full border border-border px-4 py-1.5 text-sm font-medium tabular-nums text-foreground">
                        {line.quantity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {typeof orderSubtotal === "number" ? (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-sm font-medium text-muted-foreground">Total estimado</span>
                  <span className="text-lg font-semibold text-foreground tabular-nums">
                    {formatBRL(orderSubtotal)}
                  </span>
                </div>
              ) : null}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
