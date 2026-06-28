import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ClientSectionHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
};

export function ClientSectionHeader({ eyebrow, title, description, actions, className }: ClientSectionHeaderProps) {
  return (
    <section className={cn("flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4", className)}>
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-[12px]">
          {eyebrow}
        </p>
        <h2 className="text-[clamp(1.1rem,1.6vw,1.65rem)] font-bold leading-[1.12] tracking-[-0.03em] text-foreground">
          {title}
        </h2>
        <p className="max-w-3xl text-[13px] leading-6 text-muted-foreground sm:text-[14px]">{description}</p>
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}
