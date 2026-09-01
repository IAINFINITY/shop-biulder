import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Uma linha das listas do dashboard.
 *
 * ## Por que um componente, e não a classe repetida sete vezes
 *
 * O dashboard tem sete listas — pedidos, clientes, funcionários, produtos,
 * comunicação, banners, sincronizados — e cada uma desenhava o próprio cartão
 * com a mesma pilha de classes copiada. Eram sete lugares para o hover ficar
 * diferente, e todas estavam estáticas: dava para ler "Cliente X acabou de se
 * cadastrar" e não havia como chegar nele.
 *
 * Aqui a linha vira botão quando tem destino e continua `div` quando não tem —
 * sem cursor de link nem seta prometendo o que não existe. O movimento é o mesmo
 * do `AdminStatCard` de propósito: a seta que sobe e a borda que acende. Duas
 * animações diferentes na mesma tela leem-se como dois sistemas.
 */
export function AdminDashboardItem({
  children,
  onClick,
  acaoLabel,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  /** Para onde leva, para quem usa leitor de tela. */
  acaoLabel?: string;
  className?: string;
}) {
  const base = cn(
    "flex items-start justify-between gap-3 rounded-[1.1rem] border border-border/70 bg-card p-3 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
    className,
  );

  if (!onClick) return <div className={base}>{children}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={acaoLabel}
      className={cn(
        base,
        "group w-full transition-colors hover:border-primary/30 hover:bg-primary/[0.03]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      )}
    >
      {children}
      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}
