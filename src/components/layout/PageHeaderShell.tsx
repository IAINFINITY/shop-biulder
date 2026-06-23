import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const headerShellClassName = "sticky top-0 z-50 border-b border-border/70 bg-card/95 shadow-sm backdrop-blur";
const headerInnerClassName = "mx-auto flex min-h-[88px] w-full max-w-[1400px] items-center px-4 sm:px-6 lg:px-8";
const headerHeightVariable = "--page-header-shell-height";

export type PageHeaderShellProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

export function PageHeaderShell({ children, className, innerClassName }: PageHeaderShellProps) {
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
      <div className={cn(headerInnerClassName, innerClassName)}>{children}</div>
    </header>
  );
}
