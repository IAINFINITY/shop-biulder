import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const headerShellClassName = "sticky top-0 z-50 border-b border-border/70 bg-card/95 shadow-sm backdrop-blur";
const headerHeightVariable = "--page-header-shell-height";

export type PageHeaderShellProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  compact?: boolean;
};

export function PageHeaderShell({ children, className, innerClassName, compact }: PageHeaderShellProps) {
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header || typeof window === "undefined") return;

    const updateHeight = (height: number) => {
      // Altura zero e instancia escondida, nao cabecalho sem altura.
      //
      // O `StoreHeader` monta **dois** `PageHeaderShell` — um `lg:hidden` e um
      // `hidden lg:flex` — e os dois escrevem esta mesma variavel. O que esta com
      // `display:none` mede 0, e sem este guarda ele podia ser o ultimo a
      // reportar: a barra de secoes gruda no topo errado, dependendo de quem
      // respondeu por ultimo.
      if (height <= 0) return;

      // `floor` e nao `ceil`.
      //
      // A barra de secoes usa esta variavel como `top` do seu `sticky`. Com
      // `ceil`, o topo dela fica ate 1px **abaixo** do fim do cabecalho sempre
      // que a altura for fracionaria — e aparece uma fresta com o fundo da
      // pagina atras. Com `floor` a sobra vira sobreposicao de menos de 1px, que
      // ninguem ve porque as duas barras sao opacas.
      document.documentElement.style.setProperty(headerHeightVariable, `${Math.floor(height)}px`);
    };

    if (typeof ResizeObserver === "undefined") {
      const fallbackHeight = header.getBoundingClientRect().height;
      updateHeight(fallbackHeight);
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const blockSize =
        Array.isArray(entry.borderBoxSize) && entry.borderBoxSize.length > 0
          ? entry.borderBoxSize[0].blockSize
          : entry.borderBoxSize && "blockSize" in entry.borderBoxSize
            ? entry.borderBoxSize.blockSize
            : entry.contentRect.height;

      updateHeight(blockSize);
    });

    resizeObserver.observe(header);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <header ref={headerRef} className={cn(headerShellClassName, className)}>
      <div
        className={cn(
          "mx-auto flex w-full items-center px-4 sm:px-6 lg:px-8",
          compact ? "min-h-[52px] sm:min-h-[88px]" : "min-h-[88px]",
          innerClassName,
        )}
      >
        {children}
      </div>
    </header>
  );
}
