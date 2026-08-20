import { Eye, EyeOff, X } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { cn } from "@/lib/utils";

/**
 * Chip de categoria ou subcategoria na area de Produtos.
 *
 * Antes o chip inteiro era o gatilho de "remover": clicar em "Chas 50" abria o
 * dialogo de exclusao. O contador ao lado era informacao morta — dizia quantos
 * produtos existiam ali e nao havia caminho nenhum para ver quais.
 *
 * Agora sao **duas acoes**, e por isso dois botoes irmaos e nao um dentro do
 * outro: botao aninhado e HTML invalido e deixa o clique ambiguo. O rotulo
 * filtra a lista; o `x` remove.
 *
 * Filtrar e a acao frequente e ocupa a area maior; remover e rara e destrutiva,
 * fica num alvo menor e ainda passa pela confirmacao.
 *
 * O olho, quando presente, e uma terceira acao: esconder a categoria da **loja**
 * sem apagar nada. E o que o time de design pediu — tirar a categoria da
 * vitrine sem tirar os produtos dela. Sem isso a unica saida era apagar, que
 * so mexe no seletor de cadastro e nao muda o site.
 */
export function ChipDeCategoria({
  nome,
  quantidade,
  ativo,
  onFiltrar,
  rotuloRemover,
  tituloRemover,
  descricaoRemover,
  onRemover,
  visivelNaLoja,
  onAlternarVisibilidade,
}: {
  nome: string;
  quantidade: number;
  ativo: boolean;
  onFiltrar: () => void;
  /** Vai para o `aria-label` do `x`, que sem isso seria um botao sem nome. */
  rotuloRemover: string;
  tituloRemover: string;
  descricaoRemover: ReactNode;
  onRemover: () => void;
  /** `undefined` esconde o botao — subcategoria nao tem esta acao. */
  visivelNaLoja?: boolean;
  onAlternarVisibilidade?: () => void;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border pl-3 pr-1 transition-colors",
        ativo ? "border-primary bg-primary/10" : "border-border/70 bg-secondary",
        // Oculta na loja fica esmaecida: a lista continua completa, mas da para
        // varrer os olhos e ver quais nao estao no ar.
        visivelNaLoja === false && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onFiltrar}
        aria-pressed={ativo}
        title={ativo ? `Mostrar todos de novo` : `Ver só os ${quantidade} de ${nome}`}
        className="flex h-10 items-center gap-2 text-[0.8125rem] font-medium sm:h-9"
      >
        <span className={cn("max-w-[14rem] truncate", ativo && "text-primary")}>{nome}</span>
        <Badge
          variant="outline"
          className={cn(
            "rounded-full px-2 py-0.5 text-[0.625rem]",
            ativo ? "border-primary/40 text-primary" : "border-border/70",
          )}
        >
          {quantidade}
        </Badge>
      </button>

      {onAlternarVisibilidade ? (
        <button
          type="button"
          onClick={onAlternarVisibilidade}
          aria-pressed={visivelNaLoja === false}
          aria-label={visivelNaLoja === false ? `Mostrar ${nome} na loja` : `Esconder ${nome} da loja`}
          title={
            visivelNaLoja === false
              ? "Escondida da loja — clique para mostrar. Os produtos continuam no catálogo."
              : "Esconder da loja. Os produtos continuam no catálogo, encontráveis pela busca."
          }
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          {visivelNaLoja === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      ) : null}

      <ConfirmActionDialog
        trigger={
          <button
            type="button"
            aria-label={rotuloRemover}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        }
        title={tituloRemover}
        description={descricaoRemover}
        confirmLabel="Remover"
        destructive
        onConfirm={onRemover}
      />
    </div>
  );
}
