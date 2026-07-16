import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ClinicPlusLogo } from "@/components/shared/ClinicPlusLogo";
import { PageHeaderShell } from "@/components/layout/PageHeaderShell";
import { ArrowLeft, ClipboardCheck, ShieldCheck, ShoppingBag, Users } from "lucide-react";

type AdminAuthHighlight = {
  title: string;
  text: string;
};

type AdminAuthStageProps = {
  children: ReactNode;
  className?: string;
};

const highlights: AdminAuthHighlight[] = [
  {
    title: "Gestão de produtos",
    text: "Edite catálogo, imagens, preços e status em um só lugar.",
  },
  {
    title: "Pedidos recebidos",
    text: "Acompanhe a operação sem misturar com a experiência pública.",
  },
  {
    title: "Acesso restrito",
    text: "Espaço do time interno com foco em agilidade e segurança.",
  },
  {
    title: "Clientes cadastrados",
    text: "Visualize dados, histórico e perfil de cada cliente.",
  },
];

const highlightIcons = [ClipboardCheck, ShoppingBag, ShieldCheck, Users];

export function AdminAuthStage({ children, className }: AdminAuthStageProps) {
  return (
    <div className={cn("relative h-[100dvh] overflow-hidden bg-background text-foreground", className)}>
      <PageHeaderShell className="bg-card/95" innerClassName="justify-between gap-4">
        <div className="inline-flex min-w-0 items-center">
          <ClinicPlusLogo />
        </div>
        <AdminAuthBackLink />
      </PageHeaderShell>

      <div className="grid h-[calc(100dvh-var(--page-header-shell-height))] w-full grid-cols-1 overflow-hidden pt-6 lg:grid-cols-[58%_42%] lg:pt-8">
        <div className="pointer-events-none absolute inset-y-0 left-[58%] hidden w-px bg-border/70 lg:block" />

        <aside className="relative hidden overflow-y-auto bg-background lg:flex">
          <div className="relative z-10 flex h-full w-full flex-col justify-center px-12 py-10 xl:px-[72px] xl:py-12">
            <div className="w-full max-w-[900px]">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
                Área administrativa
              </p>
              <h1 className="max-w-[14ch] text-[clamp(2.4rem,4vw,3.8rem)] font-bold leading-[1.04] tracking-[-0.04em] text-foreground">
                Acesse o painel
                <br />
                Clinic+
              </h1>
              <p className="mt-3 max-w-[66ch] text-[15px] leading-6 text-muted-foreground">
                Entre para gerenciar produtos, pedidos e operações internas do Clinic+ com segurança e agilidade.
              </p>
            </div>

            <div className="mt-8 grid w-full max-w-[920px] grid-cols-2 gap-4">
              {highlights.map((item, index) => {
                const Icon = highlightIcons[index % highlightIcons.length];
                return (
                  <div
                    key={item.title}
                    className="group relative overflow-hidden rounded-[1.1rem] border border-border/70 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-primary/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-all duration-300 motion-safe:group-hover:scale-110 motion-safe:group-hover:animate-pulse">
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

        <section className="flex h-full min-h-0 items-start justify-center overflow-y-auto bg-background px-6 pb-8 pt-10 lg:px-10 lg:pt-12 xl:px-[72px]">
          <div className="flex w-full max-w-[560px] flex-col justify-start min-[900px]:py-2 lg:min-h-full">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}

export function AdminAuthBackLink() {
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
