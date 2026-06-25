import type { ReactNode } from "react";

type AuthStatusScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function AuthStatusScreen({ eyebrow, title, description, actions }: AuthStatusScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_18%_12%,hsl(var(--primary)/0.08),transparent_30%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--background))_62%,hsl(var(--muted)/0.25)_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl rounded-[2rem] border border-border/70 bg-card/95 p-6 shadow-[0_16px_40px_rgba(16,24,40,0.08)] backdrop-blur sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/5 text-primary">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-foreground">{title}</h1>
          </div>
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-border/70 bg-muted/20 p-5 text-sm leading-6 text-muted-foreground">
          {description}
        </div>

        {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
