import { useMemo } from "react";
import { Package } from "lucide-react";
import { summarizeDescription } from "@/lib/richTextPure";
import { cn } from "@/lib/utils";

/**
 * Card "Resumo": as primeiras frases da descricao, ao lado do preco.
 *
 * Existe porque a descricao completa fica bem abaixo na pagina, e quem chega no
 * produto quer saber do que se trata antes de decidir rolar. As frases saem da
 * propria descricao — nao ha campo separado a preencher, entao um produto bem
 * descrito ganha o resumo de graca.
 *
 * Mora aqui, e nao dentro da pagina, porque a previa do admin precisa mostrar
 * exatamente este bloco. Enquanto ele so existia na pagina, a previa deixava um
 * buraco ao lado do preco e quem editava nao via o que o resumo ia dizer.
 *
 * O recorte das frases fica em `richTextPure`, para este arquivo exportar so o
 * componente — arquivo com componente e funcao junto quebra o Fast Refresh.
 */

export function ProductSummaryCard({
  description,
  /** Ausente = previa: nao ha para onde levar o link. */
  fullDescriptionHref,
  className,
}: {
  description: string;
  fullDescriptionHref?: string;
  className?: string;
}) {
  const bullets = useMemo(() => summarizeDescription(description), [description]);
  const items = bullets.length > 0 ? bullets : ["Descrição indisponível."];

  return (
    <div className={cn("overflow-hidden rounded-xl bg-background ring-1 ring-black/5", className)}>
      <div className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-center gap-2 pb-3">
          <Package className="h-4 w-4 text-primary" />
          <p className="text-xs font-medium text-muted-foreground">Resumo</p>
        </div>

        <ul className="flex flex-1 flex-col gap-2 text-sm leading-6 text-muted-foreground">
          {items.map((item, index) => (
            <li key={`${index}-${item}`} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="line-clamp-2">{item}</span>
            </li>
          ))}
        </ul>

        {fullDescriptionHref && bullets.length > 0 ? (
          <a
            href={fullDescriptionHref}
            className="mt-3 inline-flex text-xs font-medium text-primary underline underline-offset-4"
          >
            Ler descrição completa
          </a>
        ) : null}
      </div>
    </div>
  );
}
