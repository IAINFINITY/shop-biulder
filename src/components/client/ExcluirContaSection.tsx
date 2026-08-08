import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Check, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/apiFetch";
import {
  DADOS_EXCLUIDOS,
  DADOS_RETIDOS,
  PALAVRA_DE_CONFIRMACAO,
  motivoParaNaoExcluir,
} from "@/lib/exclusaoDeConta";
import { TEXT } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { MODAL_TELA_CHEIA } from "@/lib/modais";

/**
 * Excluir a própria conta — direito do titular pela LGPD (art. 18, VI).
 *
 * A §27 do padrão de autenticação exige que a interface **explique** o que é
 * excluído, retido ou anonimizado, e proíbe apresentar remoção parcial como
 * apagamento. Por isso as duas listas aparecem lado a lado, com o mesmo peso
 * visual: esconder a coluna do que fica seria a forma mais fácil de mentir sem
 * dizer nada falso.
 *
 * As listas vêm de `src/lib/exclusaoDeConta.ts`, o mesmo arquivo que descreve o
 * que a rota faz — a tela não pode divergir da ação.
 */
/** O cartão herda o estilo de quem hospeda — ver a nota em `AutenticadoresSection`. */
export function ExcluirContaSection({ className }: { className?: string } = {}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [senha, setSenha] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const impedimento = motivoParaNaoExcluir(confirmacao, senha);

  const fechar = () => {
    if (excluindo) return;
    setAberto(false);
    setConfirmacao("");
    setSenha("");
  };

  const excluir = async () => {
    if (impedimento) {
      toast.error(impedimento);
      return;
    }
    setExcluindo(true);
    try {
      const resposta = await apiFetch("/api/excluir-conta", {
        method: "POST",
        body: JSON.stringify({ senha }),
      });
      const dados = (await resposta.json().catch(() => ({}))) as { error?: string };

      if (!resposta.ok) {
        toast.error(dados.error ?? "Não foi possível excluir a conta.");
        return;
      }

      // A conta já não existe; o `signOut` aqui é para limpar o que ficou no
      // navegador. Falha dele não desfaz nada e não deve virar mensagem de erro.
      await signOut().catch(() => undefined);
      toast.success("Sua conta foi excluída.");
      navigate("/", { replace: true });
    } catch (erro) {
      console.error("[conta] falha ao excluir:", erro);
      toast.error("Não foi possível falar com o servidor. Tente de novo.");
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <section className={cn("overflow-hidden rounded-xl bg-background/95 shadow-sm ring-1 ring-black/5", className)}>
      <div className="p-5 sm:p-6">
        {/* Mesmo lugar, tamanho e espacamento dos outros cabecalhos de cartao.
            A cor e que muda: `destructive` em vez de `primary`, porque a forma
            carrega a consistencia e a cor carrega o aviso. Pintar de verde o
            unico cartao sem volta seria consistente e errado. */}
        <h2 className={cn(TEXT.body, "flex items-center gap-2 font-semibold text-foreground")}>
          <Trash2 className="h-5 w-5 shrink-0 text-destructive" />
          Excluir minha conta
        </h2>
        <p className={cn(TEXT.caption, "mt-1 max-w-prose leading-6 text-muted-foreground")}>
          Você pode encerrar sua conta a qualquer momento. A ação é permanente: não há como
          desfazer nem recuperar depois.
        </p>
        <Button
          type="button"
          variant="outline"
          className={cn(
            TEXT.compact,
            "mt-4 h-10 gap-2 rounded-full border-destructive/40 px-4 text-destructive hover:bg-destructive/5 hover:text-destructive",
          )}
          onClick={() => setAberto(true)}
        >
          <Trash2 className="h-4 w-4" />
          Excluir minha conta
        </Button>
      </div>

      <Dialog open={aberto} onOpenChange={(v) => (v ? setAberto(true) : fechar())}>
        <DialogContent className={cn(MODAL_TELA_CHEIA, "max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[1.35rem] border-border/70 sm:max-w-lg sm:rounded-[1.5rem]")}>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="min-w-0">
                <DialogTitle className="text-left">Excluir a conta é permanente</DialogTitle>
                <DialogDescription className="text-left">
                  Não existe desfazer, lixeira nem período de recuperação. Leia o que sai e o que
                  fica antes de confirmar.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className={cn(TEXT.caption, "flex items-center gap-1.5 font-semibold text-destructive")}>
                <X className="h-3.5 w-3.5" />O que será apagado
              </p>
              <ul className="mt-2 space-y-2">
                {DADOS_EXCLUIDOS.map((item) => (
                  <li key={item.titulo} className={cn(TEXT.caption, "leading-5")}>
                    <span className="font-medium text-foreground">{item.titulo}.</span>{" "}
                    <span className="text-muted-foreground">{item.detalhe}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* A coluna do que fica tem o mesmo peso da de cima de propósito. É o
                que a §27 chama de explicar "excluído, retido ou anonimizado" — e
                é a parte que costuma ser escondida. */}
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
              <p className={cn(TEXT.caption, "flex items-center gap-1.5 font-semibold text-foreground")}>
                <Check className="h-3.5 w-3.5" />O que continua existindo
              </p>
              <ul className="mt-2 space-y-2">
                {DADOS_RETIDOS.map((item) => (
                  <li key={item.titulo} className={cn(TEXT.caption, "leading-5")}>
                    <span className="font-medium text-foreground">{item.titulo}.</span>{" "}
                    <span className="text-muted-foreground">{item.detalhe}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conta-confirmacao" className={cn(TEXT.compact, "font-medium")}>
                Digite <span className="font-mono font-semibold">{PALAVRA_DE_CONFIRMACAO}</span> para
                confirmar
              </Label>
              <Input
                id="conta-confirmacao"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                placeholder={PALAVRA_DE_CONFIRMACAO}
                autoComplete="off"
                disabled={excluindo}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conta-senha" className={cn(TEXT.compact, "font-medium")}>
                Sua senha atual
              </Label>
              <Input
                id="conta-senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                disabled={excluindo}
              />
              {/* A §27 exige reautenticação recente: sessão esquecida aberta num
                  computador compartilhado não pode virar conta apagada. */}
              <p className={cn(TEXT.caption, "text-muted-foreground")}>
                Pedimos a senha para garantir que é você, e não alguém que encontrou esta tela
                aberta.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={fechar} disabled={excluindo}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              disabled={Boolean(impedimento) || excluindo}
              onClick={() => void excluir()}
            >
              {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {excluindo ? "Excluindo…" : "Excluir permanentemente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
