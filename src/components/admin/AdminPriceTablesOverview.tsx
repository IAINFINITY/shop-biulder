import { ChevronRight, Eye, Pencil, Star, TriangleAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ListaComBusca } from "@/components/admin/ListaComBusca";
import { alertasDasTabelas, type ResumoDeTabela } from "@/lib/tabelasDePreco";

/**
 * A porta de entrada da seção de Preços.
 *
 * ## Duas regras de escrita, que a primeira versão quebrou
 *
 * **Cor.** Só os tokens do projeto — `primary`, `muted`, `border`, `warm`,
 * `destructive`. A versão anterior usava azul, roxo e verde crus do Tailwind e
 * destoava do resto do painel, que é neutro com o vermelho da marca.
 *
 * **Palavra.** Quem usa esta tela entende de produto e de venda, não de
 * software. Nada de nome de sistema nem de sigla: as duas seções dizem o que
 * cada camada faz — a do tipo é o preço de todo mundo daquele tipo, a negociada
 * vale para um grupo e passa por cima.
 *
 * Até 31/08/2026 a divisão era outra: "tabelas do site" contra "tabelas do
 * Proxis", separando pelo sistema de origem em vez de pelo papel de cada uma. Com
 * o ERP fora, a origem deixou de existir e o papel é o que sempre importou.
 */

type Props = {
  tabelasPorTipo: ResumoDeTabela[];
  tabelasNegociadas: ResumoDeTabela[];
  /** Quantas tabelas a tela deixou de listar por não servirem a ninguém. */
  ocultasNegociadas: number;
  carregando: boolean;
  onAbrir: (tabela: ResumoDeTabela) => void;
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{children}</p>
  );
}

function Metrica({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div className="text-right">
      <p className="text-[0.9375rem] font-semibold leading-none tabular-nums text-foreground">{valor}</p>
      <p className="mt-1 text-[0.6875rem] text-muted-foreground">{rotulo}</p>
    </div>
  );
}

function Linha({ tabela, onAbrir }: { tabela: ResumoDeTabela; onAbrir: (t: ResumoDeTabela) => void }) {
  const erro = tabela.alerta?.gravidade === "erro";

  return (
    <button
      type="button"
      onClick={() => onAbrir(tabela)}
      className={cn(
        "group flex w-full items-center gap-4 rounded-[1.25rem] border bg-card px-4 py-3.5 text-left",
        "transition-colors hover:border-primary/30 hover:bg-primary/[0.03]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        erro ? "border-destructive/30" : "border-border/70",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          tabela.editavel ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        {tabela.editavel ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-semibold text-foreground">{tabela.nome}</span>
          {tabela.padraoDeNovasContas ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.6875rem] font-medium text-primary">
              <Star className="h-3 w-3 fill-current" />
              padrão de quem se cadastra
            </span>
          ) : null}
        </div>

        <p
          className={cn(
            "mt-1 flex items-start gap-1.5 text-xs leading-5",
            erro ? "text-destructive" : tabela.alerta ? "text-warm" : "text-muted-foreground",
          )}
        >
          {tabela.alerta ? <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
          {tabela.alerta
            ? tabela.alerta.texto
            : tabela.pessoas === 0
              ? "Nenhuma conta compra por esta tabela"
              : `${tabela.pessoas} ${tabela.pessoas === 1 ? "conta compra" : "contas compram"} por esta tabela`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-5 sm:gap-7">
        <Metrica valor={tabela.produtosAtivos} rotulo="produtos" />
        <Metrica valor={tabela.pessoas} rotulo="contas" />
        <ChevronRight className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </button>
  );
}

export function AdminPriceTablesOverview({ tabelasPorTipo, tabelasNegociadas, ocultasNegociadas, carregando, onAbrir }: Props) {
  const alertas = alertasDasTabelas([...tabelasPorTipo, ...tabelasNegociadas]);

  if (carregando) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.5rem] w-full rounded-[1.25rem]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {alertas.length > 0 ? (
        <div className="rounded-[1.25rem] border border-warm/30 bg-warm/[0.06] px-4 py-3">
          <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-foreground">
            <TriangleAlert className="h-4 w-4 text-warm" />
            {alertas.length === 1 ? "1 tabela precisa de atenção" : `${alertas.length} tabelas precisam de atenção`}
          </p>
          <ul className="mt-2 space-y-1">
            {alertas.map((t) => (
              <li key={t.chave} className="text-xs leading-5 text-muted-foreground">
                <span className="font-medium text-foreground">{t.nome}</span> — {t.alerta.texto}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="space-y-1">
          <Eyebrow>Por tipo de conta</Eyebrow>
          <p className="text-xs leading-5 text-muted-foreground sm:text-sm">
            Vale para todas as contas daquele tipo. É o preço que sai quando a conta não tem tabela própria.
          </p>
        </div>
        {/* ⚠️ Paginada, como as outras listas do painel.
            Com quatro tipos ninguém nota; com cinquenta, esta seção vira uma
            coluna infinita que empurra "Negociadas" para fora da tela. */}
        <ListaComBusca
          itens={tabelasPorTipo}
          chaveDoItem={(tabela) => tabela.chave}
          textoDoItem={(tabela) => tabela.nome}
          buscaPlaceholder="Buscar tipo de conta..."
          vazio="Nenhum tipo de conta cadastrado."
          renderizar={(tabela) => (
            <div className="py-1.5">
              <Linha tabela={tabela} onAbrir={onAbrir} />
            </div>
          )}
        />
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <Eyebrow>Negociadas</Eyebrow>
          <p className="text-xs leading-5 text-muted-foreground sm:text-sm">
            Valem para um grupo específico de contas e <strong className="font-medium text-foreground">passam por cima</strong>{" "}
            da tabela do tipo. O produto que a negociada não precifica cai na tabela do tipo, e só depois no preço do catálogo.
          </p>
        </div>
        <ListaComBusca
          itens={tabelasNegociadas}
          chaveDoItem={(tabela) => tabela.chave}
          // O número junto: é por ele que o ERP e o TXT falam de uma tabela.
          textoDoItem={(tabela) => `${tabela.nome} ${tabela.chave}`}
          buscaPlaceholder="Buscar tabela ou número..."
          vazio={
            ocultasNegociadas > 0
              ? "Nenhuma conta compra por uma tabela negociada no momento."
              : "Nenhuma tabela negociada cadastrada."
          }
          renderizar={(tabela) => (
            <div className="py-1.5">
              <Linha tabela={tabela} onAbrir={onAbrir} />
            </div>
          )}
        />

        {/* Omitir sem dizer nada seria trocar um ruído por uma dúvida: sobraram
            tabelas herdadas do ERP antigo que ninguém usa, e quem sabe que elas
            existem ficaria procurando. */}
        {ocultasNegociadas > 0 ? (
          <p className="px-1 text-xs leading-5 text-muted-foreground">
            {ocultasNegociadas === 1
              ? "Outra tabela não aparece aqui"
              : `Outras ${ocultasNegociadas} tabelas não aparecem aqui`}{" "}
            porque nenhuma conta compra por elas. Assim que alguém for colocado numa delas, ela passa a aparecer.
          </p>
        ) : null}
      </section>
    </div>
  );
}
