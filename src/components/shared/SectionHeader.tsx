import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * O cabeçalho de uma seção — no painel administrativo e na área do cliente.
 *
 * ## Por que é um componente só
 *
 * `AdminSectionHeader` e `ClientSectionHeader` eram **idênticos byte a byte**:
 * mesmas classes, mesmo `clamp`, mesmo `tracking`. Duas cópias do mesmo
 * desenho não se mantêm iguais — a próxima mudança entra numa e não na outra, e
 * as duas bancadas passam a ter cabeçalhos ligeiramente diferentes sem ninguém
 * decidir isso.
 *
 * Os dois nomes continuam existindo como casca fina, para as ~20 chamadas não
 * mudarem e para o import continuar dizendo de que bancada é a tela.
 */
export type SectionHeaderProps = {
  /** A linha pequena em maiúsculas: onde a pessoa está. */
  eyebrow: string;
  title: string;
  description: string;
  /** Botões e selos. Ficam à direita, e quebram para baixo em tela estreita. */
  actions?: ReactNode;
  className?: string;
};

export function SectionHeader({ eyebrow, title, description, actions, className }: SectionHeaderProps) {
  return (
    <section
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-3 sm:gap-4 sm:pb-4",
        className,
      )}
    >
      <div className="space-y-1.5 sm:space-y-2">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
        {/* `clamp` em vez de degraus: o título é a única coisa que muda de
            tamanho aqui, e degraus faziam ele saltar no meio do redimensionamento. */}
        <h2 className="text-base font-semibold leading-[1.12] tracking-tight text-foreground sm:text-[clamp(1.1rem,1.6vw,1.65rem)]">
          {title}
        </h2>
        <p className="max-w-3xl text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">{description}</p>
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}
