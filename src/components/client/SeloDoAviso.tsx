import * as Icones from "lucide-react";

import { aparenciaDoAviso, CLASSES_DO_TOM } from "@/lib/avisosDoCliente";
import { cn } from "@/lib/utils";

/**
 * O ícone e o rótulo de um aviso da conta.
 *
 * ## Por que existe
 *
 * A lista era uma coluna de cartões iguais: mesma moldura de imagem genérica e
 * a palavra "Campanha" fixa em todos. "Seu pedido foi cancelado" e "Promoção de
 * setembro" chegavam com a mesma cara, e o olho não separava o que exige ação
 * do que é convite.
 *
 * ## ⚠️ O ícone é resolvido por nome, em tempo de execução
 *
 * `avisosDoCliente.ts` guarda o **nome** do ícone, não o componente — assim ele
 * continua sendo lógica pura, testável sem montar React. O preço é que um nome
 * errado não quebra o build: some o ícone e ninguém percebe. É por isso que há
 * um teste afirmando que cada nome existe de fato no `lucide-react` — e ele já
 * pegou um (`MessageSquareCheck`, que não existe nesta versão).
 */
export function IconeDoAviso({ tipo, className }: { tipo: string | null | undefined; className?: string }) {
  const { icone, tom } = aparenciaDoAviso(tipo);
  const Componente = (Icones as unknown as Record<string, Icones.LucideIcon | undefined>)[icone];

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[1.25rem] border",
        CLASSES_DO_TOM[tom].circulo,
        className,
      )}
    >
      {Componente ? <Componente className="h-6 w-6" /> : null}
    </span>
  );
}

/** A palavra que diz o que aconteceu — "Enviado", "Aguardando pagamento". */
export function RotuloDoAviso({ tipo }: { tipo: string | null | undefined }) {
  const { tom, rotulo } = aparenciaDoAviso(tipo);

  return (
    <span className={cn("text-[0.6875rem] font-semibold uppercase tracking-[0.18em]", CLASSES_DO_TOM[tom].texto)}>
      {rotulo}
    </span>
  );
}
