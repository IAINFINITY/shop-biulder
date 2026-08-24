import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { lerSenhaPadrao, resetarSenhaParaOPadrao } from "@/lib/resetDeSenha";

/**
 * Confirmação do reset de senha.
 *
 * ## Por que uma confirmação, e com este conteúdo
 *
 * O botão troca a credencial de outra pessoa e derruba as sessões dela. Um
 * clique acidental na lista tira alguém do ar no meio de um pedido, e quem
 * clicou não teria como saber que foi isso.
 *
 * Por isso o texto diz as **três** coisas que acontecem, e não só "tem
 * certeza?": a senha vira a provisória, as sessões caem, e a troca passa a ser
 * obrigatória. Cada uma muda o que o suporte precisa falar com a pessoa depois.
 *
 * ## Por que a senha aparece antes de confirmar
 *
 * Porque quem vai clicar precisa saber o que vai ter de repassar. Descobrir o
 * valor só depois obriga a confirmar às cegas.
 */
export type AlvoDoReset = {
  userId: string;
  nome: string;
  email: string;
};

export function DialogoDeResetDeSenha({
  alvo,
  onOpenChange,
  onConcluido,
}: {
  alvo: AlvoDoReset | null;
  onOpenChange: (aberto: boolean) => void;
  onConcluido?: () => void;
}) {
  const [resetando, setResetando] = useState(false);

  const { data: senhaPadrao } = useQuery({
    queryKey: ["senha-padrao"],
    queryFn: lerSenhaPadrao,
    staleTime: 30 * 60_000,
    retry: false,
  });

  const confirmar = async () => {
    if (!alvo) return;
    setResetando(true);
    try {
      const { senha } = await resetarSenhaParaOPadrao(alvo.userId);
      toast.success(`Senha de ${alvo.nome || alvo.email} redefinida para ${senha}.`, {
        duration: 8000,
      });
      onConcluido?.();
      onOpenChange(false);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível resetar a senha.");
    } finally {
      setResetando(false);
    }
  };

  const copiar = async () => {
    if (!senhaPadrao) return;
    try {
      await navigator.clipboard.writeText(senhaPadrao);
      toast.success("Senha copiada.");
    } catch {
      // Navegador sem permissão de área de transferência. A senha está na tela;
      // avisar do erro seria pior que deixar a pessoa selecionar com o mouse.
    }
  };

  return (
    <AlertDialog open={Boolean(alvo)} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-[1.5rem] sm:max-w-[30rem]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-5 w-5 text-primary" />
            Resetar a senha de acesso?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                A conta de{" "}
                <strong className="text-foreground">{alvo?.nome || alvo?.email}</strong>
                {alvo?.nome ? <span> ({alvo.email})</span> : null} voltará para a senha provisória.
              </p>

              <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 px-4 py-3">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em]">
                  Nova senha
                </span>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="rounded-lg bg-background px-2.5 py-1 font-mono text-sm text-foreground">
                    {senhaPadrao || "…"}
                  </code>
                  {senhaPadrao ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 rounded-full px-2.5 text-xs"
                      onClick={() => void copiar()}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* As três consequências, nomeadas. Sem elas a confirmação vira
                  "tem certeza?", que não informa nada a quem vai clicar. */}
              <ul className="space-y-1.5 pl-4">
                <li className="list-disc">
                  A senha atual <strong className="text-foreground">deixa de funcionar</strong> na hora.
                </li>
                <li className="list-disc">
                  Se a pessoa estiver logada agora, ela{" "}
                  <strong className="text-foreground">cai do sistema</strong> e precisa entrar de novo.
                </li>
                <li className="list-disc">
                  No primeiro acesso ela é{" "}
                  <strong className="text-foreground">obrigada a criar uma senha nova</strong> — a
                  provisória serve só para entrar uma vez.
                </li>
              </ul>

              <p>
                Combine com a pessoa antes de resetar, e passe a senha por um canal em que você
                confie. Fica registrado quem fez o reset e quando.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel className="h-11 rounded-2xl text-sm">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="h-11 rounded-2xl text-sm"
            disabled={resetando}
            onClick={(e) => {
              // Sem isto o Radix fecha o diálogo ao clicar, e o "Resetando…"
              // nunca aparece — o admin não sabe se a chamada saiu.
              e.preventDefault();
              void confirmar();
            }}
          >
            {resetando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetando…
              </>
            ) : (
              "Resetar senha"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
