import { useMemo } from "react";
import { Package, Sparkles } from "lucide-react";
import { summarizeDescription } from "@/lib/richTextPure";
import { textoParaResumo } from "@/lib/resumoDeProduto";
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
  /**
   * Resumo escrito no painel, um item por linha. Quando existe, vence o recorte.
   *
   * O recorte pega as primeiras frases da descricao — bom nas descricoes curtas,
   * ruim nas 40 que passam de 3 mil caracteres, onde o comeco e texto de
   * marketing. Ausente ou vazio mantem o comportamento de sempre, entao produto
   * sem resumo nao fica com buraco nenhum.
   */
  aiSummary,
  /** Ausente = previa: nao ha para onde levar o link. */
  fullDescriptionHref,
  className,
}: {
  description: string;
  aiSummary?: string | null;
  fullDescriptionHref?: string;
  className?: string;
}) {
  /**
   * Alem dos itens, **de onde eles vieram**.
   *
   * O selo so pode acender quando o texto e mesmo da IA. Produto sem resumo cai
   * no recorte da descricao, que e texto escrito por gente — marcar esse como
   * gerado seria mentira na direcao contraria, e a direcao contraria e a que
   * destroi a confianca no selo.
   */
  const { itens: bullets, deIa } = useMemo(() => {
    const doPainel = textoParaResumo(aiSummary);
    if (doPainel.length > 0) return { itens: doPainel, deIa: true };
    return { itens: summarizeDescription(description), deIa: false };
  }, [aiSummary, description]);
  const items = bullets.length > 0 ? bullets : ["Descrição indisponível."];

  return (
    <div className={cn("overflow-hidden rounded-xl bg-background ring-1 ring-black/5", className)}>
      <div className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pb-3">
          <Package className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs font-medium text-muted-foreground">Resumo</p>
          {/* O selo diz o **fato** — o texto foi escrito por IA —, e nao o
              processo. "Revisado pela equipe" seria mais simpatico e viraria
              mentira no dia em que alguem publicar sem ler; o fato continua
              verdadeiro em qualquer cenario. */}
          {deIa ? (
            <span
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium leading-4 text-muted-foreground"
              title="Este resumo foi gerado por inteligência artificial a partir da descrição do produto."
            >
              <Sparkles aria-hidden className="h-3 w-3" />
              Texto gerado por IA
            </span>
          ) : null}
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
