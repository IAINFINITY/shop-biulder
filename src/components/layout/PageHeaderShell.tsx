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
      document.documentElement.style.setProperty(headerHeightVariable, `${Math.ceil(height)}px`);
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
