import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StickyBottomCTAProps {
  children: ReactNode;
  className?: string;
  showOnDesktop?: boolean;
}

export function StickyBottomCTA({ children, className, showOnDesktop = false }: StickyBottomCTAProps) {
  return (
    <div
      className={cn(
        // Acima da barra de navegacao, e nao em cima dela.
        //
        // Os dois ficavam em `bottom-0`. A navegacao tem `z-40` e este CTA tinha
        // `z-30`, entao a navegacao cobria o botao de comprar — a acao principal
        // da pagina de produto, escondida no celular. O `CartTotalBar` ja
        // resolvia assim; este componente ficou de fora.
        //
        // 3.5rem e a altura da navegacao (`h-14`), mais o respiro do aparelho.
        // No desktop a navegacao nao existe, entao o CTA volta para a borda.
        "fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0rem))] left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg lg:bottom-0",
        "animate-in slide-in-from-bottom-4 duration-200",
        !showOnDesktop && "lg:hidden",
        className,
      )}
      role="region"
      aria-label="Ação principal"
    >
      {children}
    </div>
  );
}
