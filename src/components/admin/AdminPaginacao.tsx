import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rotuloDaPagina, type Pagina } from "@/lib/paginacao";

/**
 * O rodapé de uma lista paginada do painel.
 *
 * Um componente só para Produtos e Pedidos usarem o mesmo rodapé — as duas
 * telas já divergiam em tudo, e paginação era mais uma chance de divergirem.
 */
export function AdminPaginacao({
  pagina,
  onMudarPagina,
}: {
  pagina: Pagina<unknown>;
  /** Recebe o índice base 0 da página pedida. */
  onMudarPagina: (indice: number) => void;
}) {
  if (pagina.totalDePaginas <= 1) {
    return (
      <p className="px-1 pt-1 text-xs text-muted-foreground">{rotuloDaPagina(pagina)}</p>
    );
  }

  const indiceAtual = pagina.paginaAtual - 1;

  /**
   * Trocar de página **não mexe na rolagem**.
   *
   * A versão anterior levava a tela ao topo da lista, na ideia de que quem
   * avança quer ver o começo do que vem. Na prática lê-se como a tela pulando: a
   * pessoa está olhando uma linha de imagens, clica na seta ao lado e a página
   * salta. Manter a posição faz o conteúdo trocar debaixo do olho, que é onde o
   * olho já estava.
   *
   * Para isso funcionar de verdade, as páginas precisam ter a mesma altura — daí
   * o tamanho de página ser múltiplo do número de colunas e os cartões terem
   * altura fixa. Sem isso a rolagem "escorrega" mesmo sem ninguém mandar.
   */
  const irPara = (indice: number) => onMudarPagina(indice);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
      <p className="text-xs text-muted-foreground">
        {rotuloDaPagina(pagina)} · página {pagina.paginaAtual} de {pagina.totalDePaginas}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          disabled={indiceAtual === 0}
          aria-label="Página anterior"
          onClick={() => irPara(indiceAtual - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          disabled={indiceAtual >= pagina.totalDePaginas - 1}
          aria-label="Próxima página"
          onClick={() => irPara(indiceAtual + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
