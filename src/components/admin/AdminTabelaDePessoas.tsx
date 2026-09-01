import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A forma padrão de listar gente no painel: Clientes, Funcionários, Administradores.
 *
 * ## O que estava errado
 *
 * As três seções listam a mesma coisa — uma pessoa — de três jeitos diferentes.
 * Medido em 31/08/2026:
 *
 * | | Clientes | Funcionários | Administradores |
 * |---|---|---|---|
 * | registros | 46 | **97** | 11 |
 * | forma | grade de 3 colunas | lista de 1 coluna | tabela + cartões |
 * | fundo | `bg-card` | `bg-background` | `bg-background` |
 * | raio | `1.15rem` | `1.25rem` | `1.25rem` |
 * | paginação | nenhuma | nenhuma | nenhuma |
 *
 * ⚠️ **A seção com menos registros era a única que escalava.** Administradores,
 * com 11 linhas, já usava tabela; Funcionários, com 97, empilhava 97 cartões
 * numa coluna só. Exatamente ao contrário do que o volume pedia.
 *
 * ## Por que tabela, e não a grade de cartões
 *
 * A regra que as referências de design de dados repetem: **se você descreveria
 * os dados como "linhas", quer uma tabela; se descreveria como "itens", quer
 * cartões.** Pessoa em painel administrativo é linha — varre-se de cima a baixo
 * procurando uma, compara-se uma coluna entre várias, age-se em lote. Cartão
 * serve a conteúdo rico e variado (foto, preço, avaliação) e em conjunto
 * pequeno; nenhuma das duas condições vale aqui.
 *
 * Na prática: a grade mostrava 3 por linha e a lista 1. A tabela mostra ~20 sem
 * rolar, que é a diferença entre procurar e achar.
 *
 * ## O celular continua em cartões
 *
 * Tabela de 6 colunas em 360px vira rolagem horizontal, que é a pior forma de
 * ler qualquer coisa. É o desenho que Administradores já tinha e que funcionava
 * — aqui ele só deixou de ser exclusividade de uma seção.
 */

export type ColunaDePessoa<T> = {
  /** Identifica a coluna. Não aparece na tela. */
  chave: string;
  rotulo: string;
  /** Largura no desktop, ex.: `"22%"`. Sem isto a coluna divide o resto igualmente. */
  largura?: string;
  alinhamento?: "esquerda" | "direita";
  /**
   * Em que largura a coluna some.
   *
   * Coluna secundária cedendo espaço antes de a tabela apertar é o que evita a
   * rolagem horizontal em tela média — e a informação continua no cartão do
   * celular, então nada se perde de fato.
   */
  ocultarAte?: "lg" | "xl";
  celula: (item: T) => ReactNode;
};

export function AdminTabelaDePessoas<T>({
  itens,
  colunas,
  chaveDoItem,
  cartaoNoCelular,
  acoes,
  vazio,
  onAbrirItem,
  larguraDasAcoes = "12%",
}: {
  itens: readonly T[];
  colunas: ColunaDePessoa<T>[];
  chaveDoItem: (item: T) => string;
  /** O mesmo registro desenhado para tela estreita. */
  cartaoNoCelular: (item: T) => ReactNode;
  /** Botões da linha. Ficam numa coluna própria, encostada à direita. */
  acoes?: (item: T) => ReactNode;
  vazio: ReactNode;
  /** Clicar na linha abre o registro. A coluna de ações não dispara isto. */
  onAbrirItem?: (item: T) => void;
  /**
   * Quanto a coluna de ações ocupa.
   *
   * ⚠️ **Ela precisa entrar na conta dos 100%.** A tabela é `table-fixed`: se a
   * soma das larguras passar de 100, o navegador espreme as últimas colunas e
   * os botões vazam por cima da coluna vizinha. Foi o que aconteceu — Clientes
   * somava 106% e a coluna de ações estava em `1%`, então os três botões
   * caíam em cima da data ao lado.
   */
  larguraDasAcoes?: string;
}) {
  if (itens.length === 0) {
    return (
      <div className="rounded-[1.25rem] border border-dashed border-border/70 p-8 text-center text-muted-foreground">
        {vazio}
      </div>
    );
  }

  return (
    <>
      {/* Celular: um cartão por registro. */}
      <div className="space-y-3 lg:hidden">
        {itens.map((item) => (
          <div
            key={chaveDoItem(item)}
            className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-background p-4 shadow-sm"
          >
            {cartaoNoCelular(item)}
          </div>
        ))}
      </div>

      {/* Desktop: tabela. */}
      <div className="hidden overflow-hidden rounded-[1.25rem] border border-border/70 lg:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-muted/40 text-left text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
              {colunas.map((coluna) => (
                <th
                  key={coluna.chave}
                  style={coluna.largura ? { width: coluna.largura } : undefined}
                  className={cn(
                    "px-3 py-2.5 font-semibold",
                    coluna.alinhamento === "direita" && "text-right",
                    coluna.ocultarAte === "lg" && "hidden lg:table-cell",
                    coluna.ocultarAte === "xl" && "hidden xl:table-cell",
                  )}
                >
                  {coluna.rotulo}
                </th>
              ))}
              {acoes ? (
                <th style={{ width: larguraDasAcoes }} className="px-3 py-2.5 text-right font-semibold">
                  {/* Sem rótulo: "Ações" ocupa uma coluna inteira para dizer o
                      que os ícones abaixo já dizem. */}
                  <span className="sr-only">Ações</span>
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {itens.map((item) => (
              <tr
                key={chaveDoItem(item)}
                onClick={onAbrirItem ? () => onAbrirItem(item) : undefined}
                className={cn(
                  "border-t border-border/60 transition-colors",
                  // ⚠️ Linha de tabela **não levanta**. O `CARTAO_CLICAVEL` sobe
                  // 1px, o que num cartão isolado é discreto e numa tabela de 24
                  // linhas faz o grid inteiro parecer tremer. Aqui o aviso de
                  // "isto é clicável" fica só no fundo e no cursor.
                  onAbrirItem ? "cursor-pointer hover:bg-primary/[0.04]" : "hover:bg-muted/40",
                )}
              >
                {colunas.map((coluna) => (
                  <td
                    key={coluna.chave}
                    className={cn(
                      "px-3 py-2.5 align-middle",
                      coluna.alinhamento === "direita" && "text-right",
                      coluna.ocultarAte === "lg" && "hidden lg:table-cell",
                      coluna.ocultarAte === "xl" && "hidden xl:table-cell",
                    )}
                  >
                    {coluna.celula(item)}
                  </td>
                ))}

                {acoes ? (
                  <td
                    // ⚠️ O clique nos botões não pode abrir a linha junto: quem
                    // clica em "excluir" não está pedindo para abrir o cadastro.
                    onClick={(evento) => evento.stopPropagation()}
                    className="whitespace-nowrap px-3 py-2.5 text-right"
                  >
                    <div className="flex items-center justify-end gap-1">{acoes(item)}</div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * O nome com o subtítulo embaixo — a primeira coluna de toda lista de gente.
 *
 * Existe para as três seções não escreverem três variações do mesmo par: era
 * assim que `text-sm font-medium` virava `text-[0.8125rem] font-semibold` numa
 * tela e ninguém percebia.
 */
export function CelulaDePessoa({
  nome,
  detalhe,
  marca,
}: {
  nome: ReactNode;
  detalhe?: ReactNode;
  /** Selo à direita do nome: tipo de conta, função, "aguardando". */
  marca?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-medium text-foreground">{nome}</span>
        {marca}
      </div>
      {detalhe ? <p className="truncate text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}
