import { ArrowUpRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Quem compra por esta tabela.
 *
 * ## Por que virou um link, e não uma lista
 *
 * A primeira versão desenhava a lista aqui dentro, recolhida. Funcionava para
 * duas contas e não para 97: sem busca, sem paginação, sem o perfil de cada
 * pessoa — e tudo isso já existe, pronto, na seção de Clientes.
 *
 * Manter as duas era garantir que divergissem: uma ganharia filtro que a outra
 * não teria, e a mesma pergunta passaria a ter duas respostas com desenhos
 * diferentes. Aqui fica a informação (quantas) e a porta; o diretório é lá.
 */
export function AdminPriceTableAccounts({
  chaveDaTabela,
  total,
  onVerContas,
}: {
  /** `site:funcionario`, `proxis:8728` — o mesmo formato de `tabelasDePreco`. */
  chaveDaTabela: string;
  total: number;
  onVerContas: (chaveDaTabela: string) => void;
}) {
  if (total === 0) {
    return (
      <div className="rounded-[1.25rem] border border-border/70 bg-muted/40 px-4 py-3">
        <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
          <Users className="h-4 w-4" />
          Nenhuma conta compra por esta tabela hoje.
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onVerContas(chaveDaTabela)}
      className={cn(
        "group flex w-full items-center justify-between gap-3 rounded-[1.25rem] border border-border/70 bg-card px-4 py-3 text-left",
        "transition-colors hover:border-primary/30 hover:bg-primary/[0.03]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      )}
    >
      <span className="flex items-center gap-2 text-[0.8125rem] font-medium text-foreground">
        <Users className="h-4 w-4 text-muted-foreground" />
        {total === 1 ? "1 conta compra por esta tabela" : `${total} contas compram por esta tabela`}
      </span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        ver em Clientes
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
      </span>
    </button>
  );
}
