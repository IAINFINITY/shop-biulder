import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Cabecalho das secoes do catalogo.
 *
 * A primeira versao empilhava eyebrow em caixa alta, titulo e uma contagem
 * solta — tres elementos dizendo a mesma coisa ("TODOS OS PRODUTOS", "Catálogo
 * completo", "143 item(ns)"). Cada linha aqui precisa carregar informacao que as
 * outras nao dao: o titulo diz o que e, a linha de apoio diz por que aquela
 * selecao existe e quantos itens tem.
 */
export type CatalogSectionTone = "primary" | "success" | "neutral";

const TONE_BAR: Record<CatalogSectionTone, string> = {
  primary: "bg-primary",
  // `success` do tema. O tom estava cravado num verde do Tailwind, entao a
  // barra da secao nao acompanhava o projeto como os outros dois acompanham.
  success: "bg-success",
  neutral: "bg-foreground/25",
};

export function CatalogSectionHeader({
  title,
  subtitle,
  tone = "neutral",
  actions,
  className,
}: {
  title: string;
  /** Linha de apoio: deve explicar o recorte, nao repetir o titulo. */
  subtitle?: ReactNode;
  tone?: CatalogSectionTone;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className={cn("h-7 w-[3px] shrink-0 rounded-full", TONE_BAR[tone])} />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold leading-tight tracking-tight text-foreground sm:text-xl">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 truncate text-[0.8125rem] leading-5 text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <div className="mt-3 h-px w-full bg-border/70" />
    </div>
  );
}
