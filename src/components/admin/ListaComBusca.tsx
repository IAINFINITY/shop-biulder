import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";

import { AdminPaginacao } from "@/components/admin/AdminPaginacao";
import { ITENS_POR_PAGINA_EM_CARTAO, montarListaPaginada } from "@/lib/listaPaginada";
import { cn } from "@/lib/utils";

/**
 * Uma lista com busca e paginação, para cartão ou seção do painel.
 *
 * ## Por que existe
 *
 * A tela de Preços tinha **quatro** listas sem teto — tipos de conta, tabelas de
 * preço, tabelas por tipo e negociadas — e as quatro cresceriam sem limite. Com
 * cinquenta tipos, cada cartão vira uma coluna que empurra o resto da tela para
 * fora, que é o mesmo defeito que Funcionários tinha com 97 cartões empilhados.
 *
 * Fiar busca, corte de página e rodapé quatro vezes daria quatro chances de
 * divergirem — foi assim que as três seções de Pessoas acabaram com três formas
 * diferentes de listar a mesma coisa. Aqui é uma peça só.
 *
 * ⚠️ **Busca e rodapé só aparecem quando servem.** O critério está em
 * `listaPaginada.ts`, junto do porquê de ele olhar o total da lista e não o
 * resultado da busca.
 */
export function ListaComBusca<T>({
  itens,
  textoDoItem,
  renderizar,
  chaveDoItem,
  vazio,
  buscaPlaceholder = "Buscar...",
  porPagina = ITENS_POR_PAGINA_EM_CARTAO,
  acaoPrincipal,
  className,
}: {
  itens: readonly T[];
  /** Tudo o que este item deve casar na busca. */
  textoDoItem: (item: T) => string;
  renderizar: (item: T) => ReactNode;
  chaveDoItem: (item: T) => string;
  vazio: ReactNode;
  buscaPlaceholder?: string;
  porPagina?: number;
  /**
   * "Novo endereço", "Novo tipo". Um só, e à direita da busca.
   *
   * ⚠️ Aparece **sempre**, e a busca não. O campo de busca só existe a partir do
   * limite de `precisaDeControles`; se a ação morasse dentro dele, uma conta com
   * três endereços ficaria sem o botão de criar o quarto.
   */
  acaoPrincipal?: ReactNode;
  className?: string;
}) {
  const [busca, setBusca] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(0);

  // A página volta ao início quando a busca muda: continuar na 3 de um
  // resultado que agora tem uma página mostra o vazio de `paginar`, e parece
  // que a busca não achou nada.
  useEffect(() => {
    setPaginaAtual(0);
  }, [busca]);

  const lista = useMemo(
    () => montarListaPaginada(itens, { busca, pagina: paginaAtual, porPagina, textoDoItem }),
    [itens, busca, paginaAtual, porPagina, textoDoItem],
  );

  return (
    <div className={cn("min-w-0", className)}>
      {lista.precisaDeControles || acaoPrincipal ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {lista.precisaDeControles ? (
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-border/70 px-3">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Escape") setBusca("");
            }}
            placeholder={buscaPlaceholder}
            aria-label={buscaPlaceholder}
            className="h-9 min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          {busca ? (
            <>
              <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">{lista.encontrados}</span>
              <button
                type="button"
                onClick={() => setBusca("")}
                aria-label="Limpar busca"
                className="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
            </div>
          ) : null}
          {acaoPrincipal ? <div className="ml-auto shrink-0">{acaoPrincipal}</div> : null}
        </div>
      ) : null}

      {lista.itens.length === 0 ? (
        <div className="rounded-[1.25rem] border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
          {busca.trim() ? "Nada encontrado para essa busca." : vazio}
        </div>
      ) : (
        <ul className="divide-y divide-border/70">
          {lista.itens.map((item) => (
            <li key={chaveDoItem(item)}>{renderizar(item)}</li>
          ))}
        </ul>
      )}

      {lista.precisaDeControles ? (
        <div className="mt-2">
          <AdminPaginacao pagina={lista.pagina} onMudarPagina={setPaginaAtual} />
        </div>
      ) : null}
    </div>
  );
}
