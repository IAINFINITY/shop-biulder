import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ClinicPlusLogo } from "@/components/shared/ClinicPlusLogo";
import { LayoutGrid, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";

export type AuthHighlight = {
  title: string;
  text: string;
};

export type AuthShellProps = {
  badge: string;
  title: string;
  description: string;
  highlights: AuthHighlight[];
  children: ReactNode;
  footer: ReactNode;
  className: string;
  cardClassName: string;
};

export function AuthShell({
  badge,
  title,
  description,
  highlights,
  children,
  footer,
  className,
  cardClassName,
}: AuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_12%,hsl(var(--primary)/0.1),transparent_30%),radial-gradient(circle_at_82%_0%,hsl(var(--primary)/0.06),transparent_28%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--background))_60%,hsl(var(--muted)/0.28)_100%)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-140px] top-[-130px] h-[28rem] w-[28rem] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute right-[-120px] top-16 h-[24rem] w-[24rem] rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-[-180px] left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-muted/70 blur-3xl" />
      </div>

      <div
        className={cn(
          "relative mx-auto flex min-h-screen w-full max-w-[1600px] items-center px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
          className,
        )}
      >
        <div className="grid w-full items-stretch gap-8 lg:min-h-[82vh] lg:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)] lg:gap-10">
          <aside className="relative hidden overflow-hidden rounded-[2.75rem] border border-border/70 bg-card/92 p-8 shadow-sm backdrop-blur lg:flex lg:min-h-[820px] lg:flex-col lg:justify-between lg:p-10 xl:p-12">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -right-20 top-8 h-60 w-60 rounded-full bg-primary/8 blur-3xl" />
              <div className="absolute left-10 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-muted/50 blur-3xl" />
              <div className="absolute bottom-10 right-16 h-32 w-32 rounded-full border border-primary/15" />
              <div className="absolute bottom-24 left-12 h-16 w-16 rounded-full bg-primary/10" />
              <div className="absolute inset-x-10 top-10 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            </div>

            <div className="relative space-y-8">
              <div className="flex items-center gap-3">
                <ClinicPlusLogo />
                <Badge
                  variant="secondary"
                  className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]"
                >
                  {badge}
                </Badge>
              </div>

              <div className="max-w-2xl space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  acesso guiado
                </div>
                <div className="space-y-3">
                  <h1 className="max-w-[11ch] text-5xl font-semibold tracking-[-0.04em] text-foreground xl:text-6xl">
                    {title}
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground xl:text-lg">
                    {description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="secondary" className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-medium text-foreground">
                    Cadastro B2B
                  </Badge>
                  <Badge variant="secondary" className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-medium text-foreground">
                    Pedido rápido
                  </Badge>
                  <Badge variant="secondary" className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-medium text-foreground">
                    Acesso seguro
                  </Badge>
                </div>
              </div>

              <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
                {highlights.map((item, index) => {
                  const Icon = [LayoutGrid, ShoppingBag, ShieldCheck][index % 3];
                  return (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-border/80 bg-background/90 p-4 shadow-sm"
                    >
                      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/80 bg-background/95 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Compra rápida
                </p>
                <p className="mt-2 text-sm text-foreground">Acesso mais curto e claro para o usuário B2B.</p>
              </div>
              <div className="rounded-2xl border border-border/80 bg-background/95 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Conta segura
                </p>
                <p className="mt-2 text-sm text-foreground">Entrada com foco em confiança e organização.</p>
              </div>
              <div className="rounded-2xl border border-border/80 bg-background/95 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Fluxo único
                </p>
                <p className="mt-2 text-sm text-foreground">Cliente e ADM seguem a mesma base visual.</p>
              </div>
            </div>
          </aside>

          <section className="flex items-stretch justify-center lg:justify-end">
            <div
              className={cn(
                "flex w-full max-w-[680px] flex-col rounded-[2.75rem] border border-border/70 bg-card/96 p-6 shadow-2xl shadow-primary/10 backdrop-blur sm:p-8 lg:min-h-[820px] lg:p-10 xl:max-w-[720px]",
                cardClassName,
              )}
            >
              <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
                <ClinicPlusLogo />
                <Badge
                  variant="secondary"
                  className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]"
                >
                  {badge}
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  {badge}
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {title}
                </h2>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {description}
                </p>
              </div>

              <div className="mt-6 flex-1">{children}</div>

              {footer ? <div className="mt-6 border-t border-border/70 pt-4">{footer}</div> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
