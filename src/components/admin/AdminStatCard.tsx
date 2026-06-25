import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type AdminStatCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "primary" | "success" | "warn" | "muted";
  note: string;
};

export function AdminStatCard({ icon: Icon, label, value, tone, note }: AdminStatCardProps) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary border-primary/15",
    success: "bg-emerald-500/10 text-emerald-700 border-emerald-500/15",
    warn: "bg-amber-500/10 text-amber-700 border-amber-500/15",
    muted: "bg-slate-500/10 text-slate-700 border-slate-500/15",
  }[tone];

  return (
    <div className="rounded-[1.1rem] border border-border/70 bg-background p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("inline-flex h-9 w-9 items-center justify-center rounded-full border", toneClasses)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      </div>
      <div className="mt-3">
        <div className="text-[1.2rem] font-black tracking-[-0.04em] text-foreground">{value}</div>
        <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{note}</p>
      </div>
    </div>
  );
}
