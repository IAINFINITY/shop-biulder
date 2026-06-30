import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ClinicPlusLogo } from "@/components/shared/ClinicPlusLogo";
import { LayoutGrid, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";

export type AuthPreviewHighlight = {
  title: string;
  text: string;
};

type AuthPreviewShellProps = {
  badge: string;
  title: ReactNode;
  description: ReactNode;
  highlights: AuthPreviewHighlight[];
  footerHref: string;
  footerLabel: string;
  children: ReactNode;
  className: string;
};

export function AuthPreviewShell({
  badge,
  title,
  description,
  highlights,
  footerHref,
  footerLabel,
  children,
  className,
}: AuthPreviewShellProps) {
  return (
    <div className="min-h-screen bg-[#f6f6f8] text-foreground">
      <div
        className={cn(
          "grid min-h-screen w-full lg:grid-cols-[56%_44%]",
          className,
        )}
      >
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-white via-white to-muted/20 px-14 py-12 lg:flex lg:flex-col">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-24 top-[-6rem] h-[30rem] w-[30rem] rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute left-[-5rem] bottom-[-4rem] h-[16rem] w-[16rem] rounded-full bg-foreground/5 blur-3xl" />
          </div>

          <div className="relative z-10 flex h-full flex-col">
            <div className="mb-12 flex items-center gap-3">
              <ClinicPlusLogo />
              <span className="rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {badge}
              </span>
            </div>

            <div className="max-w-[520px]">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                {badge}
              </p>
              <h1 className="max-w-[12ch] text-[clamp(2.8rem,5vw,4.15rem)] font-semibold leading-[1.06] tracking-[-0.04em] text-foreground">
                {title}
              </h1>
              <p className="mt-4 max-w-[44ch] text-[17px] leading-7 text-muted-foreground">
                {description}
              </p>
            </div>

            <div className="mt-10 grid max-w-[520px] grid-cols-2 gap-3">
              {highlights.map((item, index) => {
                const Icon = [LayoutGrid, ShoppingBag, ShieldCheck, Sparkles][index % 4];
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

            <div className="mt-auto pt-10">
              <div className="flex items-center justify-between border-t border-border/60 pt-4 text-[13px] text-muted-foreground">
                <Link to={footerHref} viewTransition className="inline-flex items-center gap-2 transition-colors hover:text-foreground">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5" />
                    <path d="M12 19l-7-7 7-7" />
                  </svg>
                  {footerLabel}
                </Link>
                <span>Clinic+ © 2026</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex items-stretch justify-center bg-[#f6f6f8] px-4 py-6 sm:px-6 lg:justify-start lg:px-12 lg:py-12">
          <div className="flex w-full max-w-[440px] flex-col justify-center">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
