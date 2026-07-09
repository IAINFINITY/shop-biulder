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
        "fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur-lg",
        "animate-in slide-in-from-bottom-4 duration-200",
        !showOnDesktop && "lg:hidden",
        className,
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0rem)" }}
      role="region"
      aria-label="Ação principal"
    >
      {children}
    </div>
  );
}
