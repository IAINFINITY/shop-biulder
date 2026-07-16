import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type CheckoutStep = {
  label: string;
  id: string;
};

type CheckoutProgressProps = {
  steps: CheckoutStep[];
  currentStep: number;
  className?: string;
};

export function CheckoutProgress({ steps, currentStep, className }: CheckoutProgressProps) {
  return (
    <nav aria-label="Progresso do pedido" className={cn("px-4 sm:px-6 lg:px-8", className)}>
      <ol className="flex items-center gap-1">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <li key={step.id} className={cn("flex items-center", isLast ? "" : "flex-1")}>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300",
                    isCompleted && "bg-primary text-primary-foreground shadow-sm",
                    isCurrent && "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20",
                    !isCompleted && !isCurrent && "bg-muted text-muted-foreground",
                  )}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </div>
                <span
                  className={cn(
                    "hidden text-[12px] font-medium transition-colors duration-300 sm:inline",
                    isCurrent ? "text-foreground" : isCompleted ? "text-muted-foreground" : "text-muted-foreground/60",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast ? (
                <div
                  className={cn(
                    "mx-2 h-px flex-1 transition-all duration-500 sm:mx-3",
                    index < currentStep ? "bg-primary/60" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
