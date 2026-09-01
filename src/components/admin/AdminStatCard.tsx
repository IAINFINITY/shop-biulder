import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { useNumeroAnimado } from "@/hooks/useNumeroAnimado";
import { cn } from "@/lib/utils";

/**
 * Um número do painel.
 *
 * ## O que mudou, e por quê
 *
 * **O número sobe.** Antes chegava pronto e a tela parecia estática mesmo tendo
 * acabado de carregar. O movimento aqui não é enfeite: é o que diz "isto é um
 * dado que acabou de ser lido", e é o que faz o olho passar pelos dez cartões
 * em vez de bater no primeiro.
 *
 * **O cartão leva a algum lugar.** "12 pedidos pendentes" e nenhum jeito de
 * chegar neles é um beco: a pessoa lia o número e ia procurar no menu. Com
 * `onClick`, o cartão vira a porta — e quando não há para onde ir, continua
 * sendo um cartão comum, sem cursor de link nem seta prometendo o que não existe.
 *
 * **Cor por token.** `emerald`/`amber`/`slate` crus destoavam do painel, que é
 * neutro com o vermelho da marca. Agora `success`, `warm` e `muted` vêm do
 * mesmo lugar que o resto.
 */

type AdminStatCardProps = {
  icon: LucideIcon;
  label: string;
  /** O número em si. A formatação é do chamador — dinheiro, contagem, o que for. */
  value: number;
  formatar?: (valor: number) => string;
  tone: "primary" | "success" | "warn" | "muted";
  note: string;
  /** Para onde este número leva. Sem isto, o cartão não vira botão. */
  onClick?: () => void;
  /** O que a pessoa vai encontrar ao clicar, para quem usa leitor de tela. */
  acaoLabel?: string;
};

export function AdminStatCard({
  icon: Icon,
  label,
  value,
  formatar = (n) => String(n),
  tone,
  note,
  onClick,
  acaoLabel,
}: AdminStatCardProps) {
  const animado = useNumeroAnimado(value);

  const toneClasses = {
    primary: "bg-primary/10 text-primary border-primary/15",
    success: "bg-success/10 text-success border-success/15",
    warn: "bg-warm/10 text-warm border-warm/20",
    muted: "bg-muted text-muted-foreground border-border",
  }[tone];

  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border", toneClasses)}>
          <Icon className="h-4 w-4" />
        </div>
        {/* Em duas colunas no celular sobram ~90px para o rotulo, ao lado do
            icone. Caixa alta com `tracking-[0.18em]` ocupa bem mais que o texto
            aparenta, e sem `min-w-0` o flex nao deixa o span encolher — o rotulo
            saia do cartao. */}
        <span className="min-w-0 break-words text-right text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-3">
        <div className="flex items-baseline gap-1.5">
          {/* `tabular-nums` para os dígitos não dançarem de largura enquanto
              sobem: sem isso o cartão inteiro treme durante a contagem. */}
          <span className="text-lg font-semibold tabular-nums tracking-tight text-foreground">
            {formatar(animado)}
          </span>
          {onClick ? (
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p>
      </div>
    </>
  );

  const base =
    "rounded-[1.1rem] border border-border/70 bg-background p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.03)]";

  if (!onClick) {
    return <div className={base}>{conteudo}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={acaoLabel ? `${label}: ${acaoLabel}` : undefined}
      className={cn(
        base,
        "group w-full transition-colors hover:border-primary/30 hover:bg-primary/[0.02]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      )}
    >
      {conteudo}
    </button>
  );
}
