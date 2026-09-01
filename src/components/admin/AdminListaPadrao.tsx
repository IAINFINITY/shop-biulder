import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * O cartão padrão de qualquer lista do painel.
 *
 * ## Por que existe
 *
 * Em 31/08/2026 o levantamento das doze seções mostrou que **nenhuma** concordava
 * com outra sobre onde ficam busca, filtros e o botão principal:
 *
 * | seção         | busca               | botão principal      |
 * |---------------|---------------------|----------------------|
 * | Produtos      | dentro do cartão    | dentro, junto        |
 * | Preços        | dentro do cartão    | —                    |
 * | Banners       | dentro do cartão    | dentro, junto        |
 * | Biblioteca    | dentro do cartão    | —                    |
 * | Pedidos       | **solta**, sem cartão | —                  |
 * | Clientes      | **solta**           | —                    |
 * | Usuários      | **solta**           | **no cabeçalho**     |
 * | Funcionários  | **solta**           | **no cabeçalho**     |
 * | Notificações  | **não tem**         | **no cabeçalho**     |
 *
 * Três formas de fazer a mesma coisa, e uma seção sem busca nenhuma. Quem usa o
 * painel todo dia aprende três lugares para procurar a mesma caixa.
 *
 * ## O padrão, e de onde ele vem
 *
 * As referências de tabela administrativa convergem numa **barra de ferramentas
 * acima dos dados**: busca e filtros à esquerda, ação principal à direita,
 * filtros aplicados logo abaixo com como limpar. É o desenho que Produtos já
 * tinha e que foi aprovado — então o padrão é generalizar o que funcionou, não
 * inventar um terceiro.
 *
 * ```
 * ┌ cartão ────────────────────────────────────────────┐
 * │ [busca...........] [filtro▾] [filtro▾]   [+ Novo]  │  ← ferramentas
 * │ ─────────────────────────────────────────────────  │
 * │ Mostrando "Whey" — 12 de 147        [Ver todos]    │  ← filtro aplicado
 * │ [Todos 147] [Ativos 138] [Sem foto 9]              │  ← abas
 * │ ...lista...                                        │
 * │ 1–24 de 147 · página 1 de 7          ‹  ›          │  ← paginação
 * └────────────────────────────────────────────────────┘
 * ```
 *
 * ## O cabeçalho da seção não recebe ação
 *
 * `SectionHeader` fica só com contadores. A ação principal desce para a
 * barra porque é lá que ela age: criar um item muda a lista logo abaixo, e o
 * olho já está na barra por causa da busca. Botão no cabeçalho e busca no cartão
 * obrigam a subir e descer para operar a mesma tela.
 *
 * ## Componente, e não convenção escrita
 *
 * A alternativa era documentar o padrão e confiar. Já havia convenção implícita
 * aqui — quatro seções seguiam — e mesmo assim cinco divergiram, porque cada
 * tela foi escrita num dia diferente. Um componente faz a próxima seção nascer
 * certa sem ninguém lembrar da regra.
 */
export function AdminListaPadrao({
  busca,
  onBuscaChange,
  buscaPlaceholder,
  /** Quantos itens a busca está mostrando. Vai dentro do campo, à direita. */
  contagem,
  filtros,
  acaoPrincipal,
  filtroAplicado,
  abas,
  children,
  rodape,
  className,
}: {
  busca?: string;
  onBuscaChange?: (valor: string) => void;
  buscaPlaceholder?: string;
  contagem?: number;
  /** Seletores e alternadores que refinam a lista. */
  filtros?: ReactNode;
  /** "Novo produto", "Novo banner". Um só, e à direita. */
  acaoPrincipal?: ReactNode;
  /** A faixa que nomeia o recorte ativo e oferece a saída. */
  filtroAplicado?: ReactNode;
  /** Abas de contagem, quando a seção tiver. */
  abas?: ReactNode;
  children: ReactNode;
  /** Paginação. */
  rodape?: ReactNode;
  className?: string;
}) {
  const temBusca = typeof busca === "string" && typeof onBuscaChange === "function";
  const temFerramentas = temBusca || Boolean(filtros) || Boolean(acaoPrincipal);

  return (
    <div
      className={cn(
        "rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]",
        className,
      )}
    >
      {temFerramentas ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {temBusca ? (
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                value={busca}
                onChange={(e) => onBuscaChange?.(e.target.value)}
                placeholder={buscaPlaceholder}
                className="h-11 rounded-2xl border-border/70 bg-background pl-9 pr-14 text-[0.8125rem]"
              />
              {typeof contagem === "number" ? (
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[0.6875rem] font-medium text-muted-foreground">
                  {contagem}
                </span>
              ) : null}
            </div>
          ) : (
            // Sem busca, um vão elástico mantém a ação principal à direita.
            <div className="hidden flex-1 lg:block" />
          )}

          {filtros ? <div className="flex flex-wrap items-center gap-2">{filtros}</div> : null}
          {acaoPrincipal ? <div className="flex flex-wrap items-center gap-2">{acaoPrincipal}</div> : null}
        </div>
      ) : null}

      {filtroAplicado ? <div className="mt-3">{filtroAplicado}</div> : null}
      {abas ? <div className="mt-4 flex flex-wrap items-center gap-2">{abas}</div> : null}

      <div className={cn(temFerramentas || abas ? "mt-5 border-t border-border/70 pt-5" : "")}>{children}</div>

      {rodape ? <div className="mt-4">{rodape}</div> : null}
    </div>
  );
}
