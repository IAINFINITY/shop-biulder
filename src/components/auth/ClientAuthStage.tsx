import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ClinicPlusLogo } from "@/components/shared/ClinicPlusLogo";
import { PageHeaderShell } from "@/components/layout/PageHeaderShell";
import { ArrowLeft, ClipboardCheck, Clock3, ShoppingCart, Tag } from "lucide-react";

type ClientAuthHighlight = {
  title: string;
  text: string;
};

type ClientAuthStageProps = {
  children: ReactNode;
  className?: string;
};

const highlights: ClientAuthHighlight[] = [
  {
    title: "Compra guiada",
    text: "Login libera a experiência completa com preços e pedidos.",
  },
  {
    title: "Cadastro B2B",
    text: "CNPJ e empresa organizam o atendimento do cliente.",
  },
  {
    title: "Preços por perfil",
    text: "A conta abre a tabela certa para seu perfil.",
  },
  {
    title: "Pedido rápido",
    text: "Fluxo direto com dados do cliente já preenchidos.",
  },
];

const highlightIcons = [ClipboardCheck, ShoppingCart, Clock3, Tag];

export function ClientAuthStage({ children, className }: ClientAuthStageProps) {
  return (
    <div className={cn("relative h-[100dvh] overflow-hidden bg-background text-foreground", className)}>
      <PageHeaderShell compact className="bg-card/95" innerClassName="justify-between gap-4">
        <div className="inline-flex min-w-0 items-center">
          <ClinicPlusLogo />
        </div>
        <ClientAuthBackLink />
      </PageHeaderShell>

      <div className="grid h-[calc(100dvh-var(--page-header-shell-height))] w-full grid-cols-1 overflow-hidden pt-6 lg:grid-cols-[58%_42%] lg:pt-8">
        <div className="pointer-events-none absolute inset-y-0 left-[58%] hidden w-px bg-border/70 lg:block" />
        <aside className="relative hidden overflow-hidden bg-background lg:flex">
          <div className="relative z-10 flex h-full w-full flex-col px-12 pb-10 pt-14 xl:px-[72px] xl:pb-[48px] xl:pt-16">
            <div className="w-full max-w-[900px]">
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-primary">
                Área do cliente B2B
              </p>
              <h1 className="max-w-[14ch] text-[clamp(3rem,5vw,4.5rem)] font-bold leading-[1.04] tracking-[-0.04em] text-foreground">
                Acesse sua conta
                <br />
                no Clinic+
              </h1>
              <p className="mt-4 max-w-[66ch] text-[17px] leading-7 text-muted-foreground">
                Entre para ver preços por perfil, pedidos e a experiência completa da sua empresa. Ou crie sua conta para começar.
              </p>
            </div>

            <div className="mt-10 grid w-full max-w-[920px] grid-cols-2 gap-4">
              {highlights.map((item, index) => {
                const Icon = highlightIcons[index % highlightIcons.length];
                return (
                  <div
                    key={item.title}
                    className="rounded-[1.1rem] border border-border/70 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)]"
                  >
                    <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-[15px] font-medium leading-5 text-foreground">{item.title}</p>
                    <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="flex h-full min-h-0 items-start justify-center overflow-y-auto bg-background px-4 pb-8 pt-6 sm:px-6 sm:pt-10 lg:px-10 lg:pt-12 xl:px-[72px] pb-safe">
          <div className="flex w-full max-w-[560px] flex-col justify-start min-[900px]:py-2 lg:min-h-full">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}

export function ClientAuthBackLink() {
  return (
    <Link
      to="/"
      viewTransition
      className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Voltar ao catálogo
    </Link>
  );
}
