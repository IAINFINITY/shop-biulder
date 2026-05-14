import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, CheckCircle2, ShoppingBag, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatBRL } from "@/lib/formatMoney";
import type { SubmittedCartLine } from "@/lib/orders";

type OrderSuccessState = {
  customerName?: string;
  company?: string;
  totalItems?: number;
  submittedCart?: SubmittedCartLine[];
  orderSubtotal?: number;
};

export default function OrderSuccess() {
  const location = useLocation();
  const state = (location.state ?? {}) as OrderSuccessState;
  const hasOrderDetails = Boolean(state.customerName || state.company || state.totalItems);
  const submittedCart = Array.isArray(state.submittedCart) ? state.submittedCart : [];
  const hasSubmittedCart = submittedCart.length > 0;
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,hsl(var(--accent)/0.12),hsl(var(--background))_38%,hsl(var(--background)))]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-120px] h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute right-[-60px] top-40 h-56 w-56 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute bottom-[-100px] left-[-40px] h-72 w-72 rounded-full bg-secondary/60 blur-3xl" />
      </div>

      <div className="relative container mx-auto flex min-h-screen max-w-4xl items-center px-4 py-10">
        <div className="w-full rounded-[2rem] border border-border/60 bg-card/95 p-6 shadow-2xl shadow-primary/10 backdrop-blur sm:p-10">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              Pedido recebido com sucesso
            </div>

            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Obrigado! Sua solicitacao foi enviada.
            </h1>

            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Nosso time recebeu seu pedido e vai seguir com o atendimento em breve.
            </p>

            {hasOrderDetails && (
              <div className="mt-8 grid w-full gap-3 rounded-3xl border border-border/70 bg-background/80 p-5 text-left sm:grid-cols-3">
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Cliente</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{state.customerName || "Pedido confirmado"}</p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Empresa</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{state.company || "Cadastro recebido"}</p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Itens enviados</p>
                  <div className="mt-2 flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">
                      {state.totalItems ? `${state.totalItems} item(ns)` : "Carrinho enviado"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex w-full max-w-lg flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
              {hasSubmittedCart && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="gap-2 rounded-full border-primary/30 px-6"
                  onClick={() => setCartOpen(true)}
                >
                  <ShoppingBag className="h-4 w-4" />
                  Visualizar carrinho
                </Button>
              )}
              <Link to="/">
                <Button size="lg" className="w-full gap-2 rounded-full px-6 sm:w-auto">
                  Voltar ao catalogo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <Badge variant="secondary" className="mt-6 rounded-full px-4 py-2 text-sm font-medium">
              Atendimento iniciado
            </Badge>
          </div>
        </div>
      </div>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Carrinho enviado
            </SheetTitle>
          </SheetHeader>

          {!hasSubmittedCart ? (
            <p className="text-sm text-muted-foreground">Nenhum detalhe do carrinho disponivel para esta pagina.</p>
          ) : (
            <>
              <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
                {submittedCart.map((line, index) => (
                  <div key={`${line.name}-${index}`} className="rounded-lg border border-border p-3 text-left">
                    <p className="text-sm font-medium text-foreground">{line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.type} · {line.family}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Quantidade: <span className="font-medium text-foreground">{line.quantity}</span>
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground tabular-nums">
                      {formatBRL(line.unit_price)} × {line.quantity} = {formatBRL(line.line_total)}
                    </p>
                    {line.notes?.trim() && (
                      <div className="mt-2 rounded-md bg-muted/50 p-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Observacoes
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground">{line.notes.trim()}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {typeof state.orderSubtotal === "number" && (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-sm font-medium text-muted-foreground">Total estimado</span>
                  <span className="text-lg font-semibold text-foreground tabular-nums">
                    {formatBRL(state.orderSubtotal)}
                  </span>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
