import { useLayoutEffect, useRef, type ReactNode } from "react";
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

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header || typeof window === "undefined") return;

    const updateHeight = () => {
      document.documentElement.style.setProperty(headerHeightVariable, `${Math.ceil(header.offsetHeight)}px`);
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(header);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <header ref={headerRef} className={cn(headerShellClassName, className)}>
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1600px] items-center px-4 sm:px-6 lg:px-8",
          compact ? "min-h-[52px] sm:min-h-[88px]" : "min-h-[88px]",
          innerClassName,
        )}
      >
        {children}
      </div>
    </header>
  );
}
