import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ConfirmActionDialogProps = {
  /**
   * O elemento que abre o diálogo. Opcional no modo controlado.
   *
   * Nem toda confirmação nasce de um botão: mudar o estado de um pedido nasce de
   * um seletor, e ali a escolha já aconteceu quando o diálogo precisa aparecer.
   * Sem o modo controlado, a única saída seria um segundo componente de
   * confirmação — e duas confirmações no mesmo painel divergem.
   */
  trigger?: ReactElement;
  /** Modo controlado: quem chama decide quando abre. */
  aberto?: boolean;
  onAbertoChange?: (aberto: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  processingLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmActionDialog({
  trigger,
  aberto,
  onAbertoChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  processingLabel,
  destructive = false,
  onConfirm,
}: ConfirmActionDialogProps) {
  const [abertoInterno, setAbertoInterno] = useState(false);
  const [pending, setPending] = useState(false);

  // Controlado quando `aberto` vem de fora; senão, o estado é daqui.
  const controlado = aberto !== undefined;
  const open = controlado ? aberto : abertoInterno;
  const setOpen = (valor: boolean) => {
    if (controlado) onAbertoChange?.(valor);
    else setAbertoInterno(valor);
  };

  useEffect(() => {
    if (!open) {
      setPending(false);
    }
  }, [open]);

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      setPending(true);
      await onConfirm();
      setOpen(false);
    } catch {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}

      <AlertDialogContent className="max-w-[28rem] rounded-[1.5rem] border-border/70">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="text-base font-semibold tracking-tight text-foreground">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[0.8125rem] leading-6 text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel className="mt-0 rounded-2xl px-4 text-sm">{cancelLabel}</AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={pending}
            className={cn(
              "mt-0 rounded-2xl px-4 text-sm",
              destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {pending ? (processingLabel ?? "Processando...") : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
