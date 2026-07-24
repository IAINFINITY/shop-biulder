import type { ReactNode, SVGProps } from "react";
import { Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  REPRESENTATIVE_PHONE_DISPLAY,
  REPRESENTATIVE_PHONE_WHATSAPP_URL,
} from "@/lib/supportContact";
import { cn } from "@/lib/utils";

type CatalogOrderNoticeProps = {
  variant: "banner" | "compact";
  className: string;
};

function Highlight({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

function SentenceLine({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12.04 2C6.49 2 2 6.35 2 11.72c0 1.88.56 3.72 1.62 5.3L2 22l5.17-1.49a10.3 10.3 0 0 0 4.87 1.22h.01C17.6 21.73 22 17.39 22 12.02 22 6.63 17.55 2 12.04 2Zm0 18.12h-.01a8.36 8.36 0 0 1-4.27-1.18l-.31-.18-3.07.88.9-2.98-.2-.31a8.33 8.33 0 0 1-1.3-4.42c0-4.6 3.86-8.34 8.62-8.34 4.7 0 8.52 3.78 8.52 8.44 0 4.66-3.82 8.1-8.9 8.1Zm4.84-5.88c-.26-.13-1.53-.75-1.77-.84-.24-.09-.41-.13-.58.13-.17.26-.67.84-.82 1.02-.15.17-.3.19-.56.06-.26-.13-1.1-.4-2.08-1.28-.77-.68-1.29-1.52-1.44-1.78-.15-.26-.02-.4.11-.53.11-.11.26-.29.39-.43.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.58-1.39-.79-1.9-.21-.5-.42-.43-.58-.44h-.5c-.17 0-.45.06-.69.32-.24.26-.94.92-.94 2.24 0 1.32.96 2.6 1.09 2.78.13.17 1.9 2.9 4.61 4.07.64.28 1.14.44 1.53.56.64.2 1.22.17 1.68.1.51-.08 1.53-.62 1.75-1.22.22-.6.22-1.11.15-1.22-.07-.1-.24-.17-.5-.3Z" />
    </svg>
  );
}

export function CatalogOrderNotice({ variant = "banner", className }: CatalogOrderNoticeProps) {
  const isBanner = variant === "banner";
  const containerClassName = isBanner
    ? "relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
    : "relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-r from-primary/[0.09] via-background to-primary/[0.04]";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "motion-safe:animate-notice-enter motion-reduce:animate-none",
        containerClassName,
        isBanner ? "px-4 py-4 sm:px-6 sm:py-5" : "px-3 py-3",
        className,
      )}
    >
      {!isBanner ? <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/70" aria-hidden /> : null}

      <div className="relative flex gap-3 sm:gap-4">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
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
              "mt-1 space-y-3 text-muted-foreground leading-relaxed",
              isBanner ? "text-sm sm:text-[0.9375rem]" : "text-xs leading-snug",
            )}
          >
            {isBanner ? (
              <>
                <p>
                  Monte seu pedido no <Highlight>catálogo</Highlight> e siga para a finalização.
                </p>
                <p>
                  <Highlight>Pagamento</Highlight> e <Highlight>condições comerciais</Highlight> são combinados
                  diretamente com nosso <Highlight>time de atendimento</Highlight>.
                </p>
                <p>
                  Após enviar o pedido, aguarde nosso <Highlight>atendente</Highlight> entrar em contato. Seu{" "}
                  <Highlight>pedido</Highlight> é encaminhado automaticamente ao time com todos os produtos e informações
                  do <Highlight>carrinho</Highlight>.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <p className="text-xs font-medium text-foreground">
                    Fale com o consultor: {REPRESENTATIVE_PHONE_DISPLAY}
                  </p>
                  <Button asChild variant="outline" size="icon" className="rounded-full">
                    <a href={REPRESENTATIVE_PHONE_WHATSAPP_URL} target="_blank" rel="noreferrer">
                      <WhatsAppIcon className="h-4 w-4" />
                      <span className="sr-only">WhatsApp</span>
                    </a>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <SentenceLine>
                  <Highlight>Pagamento</Highlight> com o <Highlight>atendimento</Highlight>.
                </SentenceLine>
                <SentenceLine>
                  Após enviar o pedido, aguarde o <Highlight>contato</Highlight> - o pedido segue para o time com todas as
                  informações.
                </SentenceLine>
                <SentenceLine>
                  Consultor no WhatsApp: <Highlight>{REPRESENTATIVE_PHONE_DISPLAY}</Highlight>
                </SentenceLine>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
