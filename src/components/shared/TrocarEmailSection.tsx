import { useState } from "react";
import { Eye, EyeOff, Loader2, Mail, MailWarning } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/**
 * Trocar o e-mail de acesso.
 *
 * ## Uma implementação, duas bancadas
 *
 * Nasceu dentro de `AdminSettingsSection`. Quando a conta do cliente pediu a
 * mesma coisa, copiar teria dado duas versões do mesmo fluxo de segurança — e é
 * exatamente onde duas cópias mais doem: a próxima correção entra numa e não na
 * outra, e uma das duas fica sem a proteção.
 *
 * ## ⚠️ Pede a senha atual
 *
 * O e-mail **é** o caminho de recuperação da conta: quem o troca passa a
 * receber os links de "esqueci minha senha". A um clique de distância, uma
 * sessão esquecida numa máquina emprestada vira uma conta perdida — a pessoa
 * troca o endereço, pede a recuperação, e o dono legítimo não volta mais.
 *
 * ## O endereço não muda agora
 *
 * `updateUser({ email })` não troca nada: manda um link de confirmação para o
 * **novo** endereço, e a troca só acontece no clique. Por isso a tela fala em
 * "confirmação enviada", e não em "e-mail alterado" — dizer que mudou quando
 * não mudou é a pior versão desta funcionalidade.
 */
export function TrocarEmailSection({ className }: { className?: string }) {
  const { user } = useAuth();

  /**
   * Uma troca já pedida e ainda não confirmada.
   *
   * O Supabase guarda o endereço pretendido em `new_email` até o link ser
   * aberto. Não vem tipado no `User`, daí a leitura defensiva.
   */
  const pendente = ((user as { new_email?: string | null } | null)?.new_email ?? "").trim() || null;

  const [novoEmail, setNovoEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();

    const alvo = novoEmail.trim().toLowerCase();
    const atual = (user?.email ?? "").trim().toLowerCase();

    if (!alvo) return toast.error("Informe o novo e-mail");
    // Validação de formato de e-mail é sempre aproximada; esta barra o engano
    // óbvio (espaço, falta de @ ou de domínio) e deixa o resto para o servidor,
    // que é quem de fato tenta entregar.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(alvo)) return toast.error("E-mail inválido");
    if (alvo === atual) return toast.error("Este já é o seu e-mail atual");
    if (!senha) return toast.error("Informe a senha atual para confirmar");

    setSalvando(true);
    try {
      const { error: erroDeLogin } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: senha,
      });
      if (erroDeLogin) {
        toast.error("Senha atual incorreta");
        setSalvando(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ email: alvo });
      if (error) throw error;

      toast.success("Confirmação enviada", {
        description: `Abra o link enviado para ${alvo}. O e-mail só muda depois disso.`,
      });
      setSenha("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar e-mail");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form
      onSubmit={enviar}
      className={cn(
        "space-y-4 rounded-[1.25rem] border border-border/70 bg-background/95 p-5 shadow-sm sm:p-6",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <p className="text-sm font-semibold text-foreground">Alterar e-mail de acesso</p>
      </div>

      {/* Uma troca pendente precisa aparecer: sem isto a pessoa pede de novo,
          acha que a primeira falhou, e passa a ter dois links válidos na caixa
          sem saber qual vale. */}
      {pendente ? (
        <div className="flex items-start gap-2 rounded-[1.25rem] border border-warm/30 bg-warm/5 p-3 text-xs leading-5 text-foreground">
          <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-warm" />
          <span>
            Há uma troca aguardando confirmação em <strong>{pendente}</strong>. O e-mail atual continua valendo até o
            link ser aberto.
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Novo e-mail
          </Label>
          <Input
            type="email"
            autoComplete="email"
            value={novoEmail}
            onChange={(evento) => setNovoEmail(evento.target.value)}
            placeholder="nome@empresa.com.br"
            className="h-11 rounded-2xl border-border/70 bg-background text-[0.8125rem]"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Sua senha atual
          </Label>
          <div className="relative">
            <Input
              type={mostrarSenha ? "text" : "password"}
              autoComplete="current-password"
              value={senha}
              onChange={(evento) => setSenha(evento.target.value)}
              placeholder="Para confirmar que é você"
              className="h-11 rounded-2xl border-border/70 bg-background pr-11 text-[0.8125rem]"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Enviamos um link de confirmação para o novo endereço — <strong>o e-mail só muda depois que você abrir esse
        link</strong>. Até lá, continue entrando com o atual. Como o e-mail é por onde se recupera a conta, pedimos a
        sua senha antes de começar.
      </p>

      <div className="flex justify-end">
        <Button type="submit" disabled={salvando} className="h-10 rounded-2xl px-4 text-sm">
          {salvando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Mail className="mr-1.5 h-4 w-4" />}
          Enviar confirmação
        </Button>
      </div>
    </form>
  );
}
