import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=closed]:hidden data-[state=open]:block",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // `w-[calc(100%-3rem)]` e nao `w-full`: num elemento `fixed`, `w-full`
        // vale 100% da tela, entao a caixa encostava nas duas bordas do celular
        // e todo `max-w-*` maior que o telefone virava letra morta. Os 3rem
        // deixam 24px de cada lado.
        //
        // Sem variante `sm:` aqui de proposito. O `max-w-lg` ja limita a largura
        // na tela grande, e uma `sm:w-full` sobreviveria ao `tailwind-merge` —
        // modificador diferente nao conflita — e passaria a vencer os
        // `w-[min(98vw,…)]` que varios modais declaram. Sem prefixo, o merge
        // descarta esta classe quando o modal define a propria largura.
        //
        // `max-h`/`overflow-y-auto` sao rede de seguranca para os modais curtos,
        // que nao declaram altura: sem isso, conteudo maior que a tela vazava sem
        // rolagem. Quem define a propria altura sobrescreve os dois.
        "fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-3rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg data-[state=closed]:hidden data-[state=open]:grid sm:rounded-lg",
        "max-h-[calc(100dvh-3rem)] overflow-y-auto",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-6 top-6 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

/**
 * Rodape de acoes. No celular ele **gruda** no fim do modal.
 *
 * Auditado no admin: 11 dos 13 modais tinham as acoes rolando junto com o
 * conteudo. Em tela cheia, com formulario longo, isso significa percorrer o
 * formulario inteiro so para alcancar "Salvar" — e a pesquisa de formulario em
 * espaco pequeno mede 82,4% de abandono nesse tipo de arranjo.
 *
 * `sticky` e nao `fixed`: o container que rola e o proprio `DialogContent`, e
 * `sticky` fica preso a ele em vez da janela.
 *
 * **Sem margem negativa de proposito.** A tentacao e usar `-mx-6 -mb-6` para a
 * faixa encostar nas bordas, mas isso so funciona em modal com `p-6`: quatro
 * modais do projeto usam `p-0` e montam o proprio respiro por dentro, e neles a
 * margem negativa arrancaria o rodape para fora da caixa.
 *
 * Acima de `sm` nada muda — no desktop a caixa e curta e as acoes ja aparecem.
 */
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      // `[&>*]:shrink-0`: em coluna a altura e o eixo principal, entao os botoes
      // encolhiam de 44px para 41px — abaixo do minimo de toque.
      "max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:gap-2 max-sm:border-t max-sm:border-border/70 max-sm:bg-background max-sm:pt-3 max-sm:[&>*]:shrink-0",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
