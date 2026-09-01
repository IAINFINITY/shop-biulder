import { Store, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

export type WorkspaceBottomNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Pendencias a resolver nessa secao. Vira o numerinho sobre o icone. */
  aviso?: number;
};

/**
 * Barra de navegacao inferior das duas bancadas: admin e area de cliente.
 *
 * **Nao e a barra da loja.** Ali sao tres destinos e acabou. Numa bancada sao
 * muitas secoes — 12 no admin, 7 na conta — e no admin ainda variam por
 * permissao: uma barra fixa nao consegue representar isso. Por isso ela leva
 * dois ou tres atalhos do dia a dia; o resto vive na gaveta.
 *
 * Ela nao concorre com a gaveta: leva atalhos para o que ja esta la dentro. O
 * caminho completo continua sendo o hamburguer, no topo-esquerda.
 *
 * A area de cliente usava a barra da loja porque mora dentro do `PublicLayout`.
 * Funcionava para sair dali, mas nao navegava as secoes da conta — para trocar
 * de secao era preciso subir ate o topo e abrir a gaveta.
 */
export function WorkspaceBottomNav({
  itens,
  section,
  onSectionChange,
  rotuloDaNavegacao,
}: {
  /** Ja filtrados por permissao por quem monta a shell. */
  itens: WorkspaceBottomNavItem[];
  section: string;
  onSectionChange: (id: string) => void;
  rotuloDaNavegacao: string;
}) {
  // "Catalogo" na ponta esquerda; os atalhos em seguida. Sem "Menu" aqui: o
  // hamburguer no topo-esquerda cuida disso, que e onde se procura menu e de
  // onde a gaveta sai. Assim esta barra fica so com destinos.
  const colunas = itens.length + 1;

  return (
    <nav
      // `z-20`: abaixo do overlay da gaveta (`z-30`) e da propria gaveta
      // (`z-40`). Se ficasse por cima, a barra flutuaria sobre o menu aberto —
      // foi exatamente esse empate que deixou o botao "Sair" inalcancavel na
      // area de cliente.
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card/95 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0rem)" }}
      aria-label={rotuloDaNavegacao}
    >
      <div
        className="grid h-14 items-stretch px-1.5"
        style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}
      >
        <Link
          to="/"
          viewTransition
          className="flex h-full w-full min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-0.5 px-1 text-muted-foreground transition-colors active:text-foreground"
        >
          <Store className="h-5 w-5" strokeWidth={2} />
          <span className="truncate text-[0.6875rem] font-medium leading-none">Catálogo</span>
        </Link>

        {itens.map((item) => {
          const ativo = section === item.id;
          const Icone = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "flex h-full w-full min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-0.5 px-1 transition-colors",
                ativo ? "text-primary" : "text-muted-foreground active:text-foreground",
              )}
            >
              <span className="relative">
                <Icone className="h-5 w-5" strokeWidth={ativo ? 2.5 : 2} />
                {/* No celular a barra e o unico lugar onde o aviso cabe: a
                    gaveta esta fechada e o rotulo tem espaco para uma palavra
                    so. Sem isto, quem atende pelo telefone continuaria sem
                    saber que tem gente esperando. */}
                {item.aviso ? (
                  <span
                    aria-label={`${item.aviso} pendente(s)`}
                    className="absolute -right-2 -top-1 min-w-[1rem] rounded-full bg-primary px-1 text-center text-[0.5625rem] font-bold leading-4 text-primary-foreground"
                  >
                    {item.aviso > 9 ? "9+" : item.aviso}
                  </span>
                ) : null}
              </span>
              <span className={cn("truncate text-[0.6875rem] font-medium leading-none", ativo && "font-semibold")}>
                {item.label}
              </span>
            </button>
          );
        })}

      </div>
    </nav>
  );
}
