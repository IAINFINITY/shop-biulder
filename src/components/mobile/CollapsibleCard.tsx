import { useState, useCallback, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleCardProps {
  header: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
}

export function CollapsibleCard({
  header,
  children,
  defaultOpen = false,
  className,
  headerClassName,
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border/60 bg-card", className)}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left",
          "touch-manipulation select-none",
          headerClassName,
        )}
        aria-expanded={isOpen}
      >
        <div className="min-w-0 flex-1">{header}</div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
