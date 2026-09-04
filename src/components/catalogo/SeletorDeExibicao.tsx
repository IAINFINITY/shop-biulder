import { LayoutGrid, List } from "lucide-react";

import { cn } from "@/lib/utils";
import { MODOS_DE_EXIBICAO, type ModoDeExibicao } from "@/lib/modoDeExibicao";

const ROTULO: Record<ModoDeExibicao, { texto: string; Icone: typeof List }> = {
  lista: { texto: "Lista", Icone: List },
  grade: { texto: "Grade", Icone: LayoutGrid },
};

/**
 * Alterna entre lista e grade.
 *
 * ## Dois botões visíveis, e não um que alterna
 *
 * Um botão só — que mostra o ícone do "outro" modo — economiza espaço e custa
 * clareza: ninguém sabe se o ícone representa o estado atual ou o destino. Com
 * os dois à vista, o marcado é o estado e o outro é o destino, sem adivinhação.
 *
 * `radiogroup` e não dois botões soltos: para o leitor de tela isto é **uma**
 * escolha entre duas opções, e é assim que a seta do teclado deve andar.
 */
export function SeletorDeExibicao({
  modo,
  onModoChange,
  className,
}: {
  modo: ModoDeExibicao;
  onModoChange: (modo: ModoDeExibicao) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Forma de exibição dos produtos"
      className={cn("flex shrink-0 items-center gap-0.5 rounded-full bg-muted/60 p-0.5", className)}
    >
      {MODOS_DE_EXIBICAO.map((valor) => {
        const { texto, Icone } = ROTULO[valor];
        const ativo = modo === valor;

        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onModoChange(valor)}
            title={`Ver em ${texto.toLowerCase()}`}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
              ativo
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icone className="h-3.5 w-3.5" />
            {/* O rótulo some no celular, onde a barra disputa espaço com a
                contagem e a ordenação. O `title` e o `aria-label` continuam. */}
            <span className="hidden sm:inline">{texto}</span>
          </button>
        );
      })}
    </div>
  );
}
