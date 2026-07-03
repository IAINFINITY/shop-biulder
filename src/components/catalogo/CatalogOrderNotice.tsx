import type { ReactNode } from "react";
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

export function CatalogOrderNotice({ variant = "banner", className }: CatalogOrderNoticeProps) {
  const isBanner = variant === "banner";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "relative overflow-hidden rounded-xl border border-primary/30",
        "bg-gradient-to-r from-primary/[0.09] via-background to-primary/[0.04]",
        "motion-safe:animate-notice-enter motion-reduce:animate-none",
        isBanner ? "px-4 py-4 sm:px-5 sm:py-5" : "px-3 py-3",
        className,
      )}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/70" aria-hidden />

      <div className="relative flex gap-3 sm:gap-4">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary",
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
                  Monte seu pedido aqui no <Highlight>catálogo</Highlight> para entendermos com clareza o que você
                  procura.
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
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <a href={REPRESENTATIVE_PHONE_WHATSAPP_URL} target="_blank" rel="noreferrer">
                      WhatsApp
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
