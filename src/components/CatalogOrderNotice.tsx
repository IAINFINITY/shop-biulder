import { Handshake } from "lucide-react";
import { cn } from "@/lib/utils";

type CatalogOrderNoticeProps = {
  variant?: "banner" | "compact";
  className?: string;
};

export function CatalogOrderNotice({ variant = "banner", className }: CatalogOrderNoticeProps) {
  const isBanner = variant === "banner";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "relative overflow-hidden rounded-xl border border-primary/30",
        "bg-gradient-to-r from-primary/[0.09] via-background to-primary/[0.04]",
        "animate-notice-enter animate-notice-glow",
        isBanner ? "px-4 py-4 sm:px-5 sm:py-5" : "px-3 py-3",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40 bg-[length:200%_100%] bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-notice-shimmer"
        aria-hidden
      />
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/80 animate-pulse" aria-hidden />

      <div className="relative flex gap-3 sm:gap-4">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary",
            "animate-notice-icon",
            isBanner ? "h-11 w-11 sm:h-12 sm:w-12" : "h-9 w-9",
          )}
        >
          <Handshake className={isBanner ? "h-5 w-5 sm:h-6 sm:w-6" : "h-4 w-4"} aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-semibold text-foreground leading-snug",
              isBanner ? "text-sm sm:text-base" : "text-xs sm:text-sm",
            )}
          >
            {isBanner ? "Como funciona o seu pedido" : "Pedido pelo catálogo"}
          </p>
          <div
            className={cn(
              "mt-1 space-y-2 text-muted-foreground leading-relaxed",
              isBanner ? "text-sm sm:text-[0.9375rem]" : "text-xs leading-snug",
            )}
          >
            {isBanner ? (
              <>
                <p>
                  Monte seu pedido aqui no catálogo para entendermos com clareza o que você procura. Pagamento e
                  condições comerciais são combinados diretamente com nosso time de atendimento.
                </p>
                <p>
                  Após enviar, aguarde nosso atendente entrar em contato. Seu pedido é encaminhado automaticamente
                  ao time com todos os produtos e informações do carrinho.
                </p>
              </>
            ) : (
              <p>
                Pagamento com o atendimento. Após enviar, aguarde o contato — o pedido vai ao time com todas as
                informações.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
