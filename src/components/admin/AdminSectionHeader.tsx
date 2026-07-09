import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AdminSectionHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions: ReactNode;
  className?: string;
};

export function AdminSectionHeader({ eyebrow, title, description, actions, className }: AdminSectionHeaderProps) {
  return (
    <section className={cn("flex flex-wrap items-start justify-between gap-3 sm:gap-4 border-b border-border/70 pb-3 sm:pb-4", className)}>
      <div className="space-y-1.5 sm:space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-[12px]">{eyebrow}</p>
        <h2 className="text-[1.05rem] sm:text-[clamp(1.1rem,1.6vw,1.65rem)] font-bold leading-[1.12] tracking-[-0.03em] text-foreground">
          {title}
        </h2>
        <p className="max-w-3xl text-[12px] leading-5 sm:leading-6 text-muted-foreground sm:text-[14px]">{description}</p>
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}
