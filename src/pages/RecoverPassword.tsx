import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientAuthStage } from "@/components/auth/ClientAuthStage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { validarSenha } from "@/lib/validarSenha";
import { MIN_SEM_MFA } from "@/lib/senha";

type PasswordFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
};

function PasswordField({ id, label, placeholder, value, onChange, autoComplete }: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <span className="pointer-events-none absolute left-10 top-1/2 h-7 w-px -translate-y-1/2 bg-border/80" />
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={cn(
            "h-12 rounded-2xl border-border/70 bg-background pl-14 pr-12 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30",
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPassword((current) => !current)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/**
 * Politica unica em `src/lib/senha.ts`.
 *
 * As regras de composicao que viviam aqui — maiuscula, minuscula, digito,
 * especial — sao proibidas pela §10 do padrao de autenticacao.
 */
async function validatePassword(password: string, email?: string | null) {
  return (await validarSenha(password, { email })).problema;
}

export default function RecoverPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading, isResolvingAccess, requestPasswordReset, signOut, isPasswordRecovery, deveTrocarSenha } = useAuth();
  const [email, setEmail] = useState(searchParams.get("email")?.trim() ?? "");
  const [requestingReset, setRequestingReset] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [recoveryProbeTimedOut, setRecoveryProbeTimedOut] = useState(false);
  const recoveryHint = useMemo(() => {
    return (
      searchParams.get("type") === "recovery" ||
      searchParams.get("mode") === "recovery" ||
      searchParams.has("code") ||
      searchParams.has("token_hash") ||
      searchParams.has("access_token")
    );
  }, [searchParams]);

  useEffect(() => {
    const emailParam = searchParams.get("email")?.trim();
    if (emailParam && !email) {
      setEmail(emailParam);
    }
  }, [email, searchParams]);

  useEffect(() => {
    if (!recoveryHint) {
      setRecoveryProbeTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setRecoveryProbeTimedOut(true);
    }, 1600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [recoveryHint]);

  if (loading || isResolvingAccess) {
    return (
      <ClientAuthStage>
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </ClientAuthStage>
    );
  }

  // Senha provisoria cai no mesmo formulario da recuperacao: e a mesma acao —
  // definir uma senha propria — e reaproveitar a tela evita uma segunda copia da
  // validacao, que foi o que deixou a politica antiga sobreviver em seis lugares.
  if (user && (isPasswordRecovery || deveTrocarSenha)) {
    return (
      <ClientAuthStage>
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2.25rem] border border-border/70 bg-background text-foreground shadow-[0_16px_40px_rgba(16,24,40,0.08)]">
          <div className="border-b border-border/70 px-6 py-7 sm:px-8">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-primary/25 bg-primary/5 shadow-[0_8px_22px_rgba(16,24,40,0.05)]">
              <img src="/faviconV2.png" alt="Clinic+ logo" className="h-14 w-auto" />
            </div>

            <div className="mt-5 text-center">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary">
                {deveTrocarSenha ? "Primeiro acesso" : "Redefinição de senha"}
              </p>
              <h2 className="mt-3 text-[clamp(1.9rem,2.8vw,2.7rem)] font-semibold leading-[1] tracking-tight text-foreground">
                Crie sua nova senha
              </h2>
              {/* O texto muda porque a situacao e outra: quem chega por senha
                  provisoria nao clicou em link nenhum, e dizer que clicou faria a
                  tela parecer defeito. */}
              <p className="mx-auto mt-3 max-w-[34ch] text-sm leading-6 text-muted-foreground">
                {deveTrocarSenha
                  ? "Você entrou com a senha provisória. Escolha uma senha sua para continuar — ela é a única que valerá a partir de agora."
                  : "O link de recuperação já foi validado. Agora basta definir a nova senha para continuar."}
              </p>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-6 sm:px-8">
            <form
              onSubmit={async (event) => {
                event.preventDefault();

                const errorMessage = await validatePassword(newPassword, user?.email);
                if (errorMessage) {
                  toast.error(errorMessage);
                  return;
                }

                if (newPassword !== confirmPassword) {
                  toast.error("As senhas não coincidem.");
                  return;
                }

                setSavingPassword(true);
                try {
                  const { error } = await supabase.auth.updateUser({ password: newPassword });
                  if (error) throw error;

                  // Some a obrigacao antes de encerrar a sessao: se ficasse para
                  // depois do logout, a pessoa entraria com a senha nova e cairia
                  // de novo nesta tela, sem entender por que.
                  if (deveTrocarSenha) {
                    const { error: flagErr } = await supabase
                      .from("clinic+b2b_customer_profiles")
                      .update({ deve_trocar_senha: false })
                      .eq("user_id", user.id);
                    if (flagErr) {
                      // A senha ja mudou; travar aqui seria pior. O log serve
                      // para alguem notar se isso virar rotina.
                      console.error("[senha] flag de troca obrigatoria nao foi limpa:", flagErr);
                    }
                  }

                  const { error: signOutError } = await signOut();
                  if (signOutError) {
                    throw new Error("A senha foi atualizada, mas não foi possível encerrar a sessão temporária. Tente novamente.");
                  }
                  toast.success("Senha atualizada com sucesso. Entre novamente com a nova senha.");
                  navigate(`/login${email ? `?email=${encodeURIComponent(email)}` : ""}`, {
                    replace: true,
                    viewTransition: true,
                  });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Erro ao alterar senha.");
                } finally {
                  setSavingPassword(false);
                }
              }}
              className="mt-5 flex min-h-full flex-col space-y-4 rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]"
            >
              <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  {deveTrocarSenha ? "Senha provisória" : "Recuperação liberada"}
                </div>
                <p className="mt-1 text-sm">
                  {deveTrocarSenha
                    ? "A senha provisória serve só para este primeiro acesso. Defina a sua para continuar."
                    : "Defina uma nova senha para finalizar o acesso e voltar ao login com segurança."}
                </p>
              </div>

              <PasswordField
                id="new-password"
                label="Nova senha"
                placeholder={`Mínimo ${MIN_SEM_MFA} caracteres`}
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
              />

              <PasswordField
                id="confirm-password"
                label="Confirmar nova senha"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />

              <Button type="submit" className="h-12 w-full rounded-2xl text-sm font-semibold" disabled={savingPassword}>
                {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar nova senha
              </Button>

              {/* A saída que faltava.
                  Esta tela bloqueia o site inteiro até a troca — e sem um jeito
                  de sair, quem entrou por engano (ou num usuário de teste que
                  não quer levar adiante) ficava preso: sem menu, sem voltar, sem
                  logout. O bloqueio continua valendo; o que não pode é a pessoa
                  não ter como desistir e sair da conta.

                  `type="button"` é obrigatório aqui dentro do `form`: sem isso o
                  clique dispararia o submit em vez do logout. */}
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-2xl text-sm font-medium text-muted-foreground"
                disabled={savingPassword}
                onClick={async () => {
                  await signOut().catch(() => undefined);
                  navigate("/login", { replace: true, viewTransition: true });
                }}
              >
                Sair sem trocar a senha
              </Button>
            </form>
          </div>
        </div>
      </ClientAuthStage>
    );
  }

  if (user && recoveryHint && !recoveryProbeTimedOut) {
    return (
      <ClientAuthStage>
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </ClientAuthStage>
    );
  }

  if (user) {
    return (
      <ClientAuthStage>
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2.25rem] border border-border/70 bg-background text-foreground shadow-[0_16px_40px_rgba(16,24,40,0.08)]">
          <div className="border-b border-border/70 px-6 py-7 sm:px-8">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-primary/25 bg-primary/5 shadow-[0_8px_22px_rgba(16,24,40,0.05)]">
              <img src="/faviconV2.png" alt="Clinic+ logo" className="h-14 w-auto" />
            </div>

            <div className="mt-5 text-center">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary">Recuperar acesso</p>
              <h2 className="mt-3 text-[clamp(1.9rem,2.8vw,2.7rem)] font-semibold leading-[1] tracking-tight text-foreground">
                Use o link do e-mail para continuar
              </h2>
              <p className="mx-auto mt-3 max-w-[34ch] text-sm leading-6 text-muted-foreground">
                Esta tela só libera a troca de senha quando você entra pelo link de recuperação enviado ao seu e-mail.
              </p>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-6 sm:px-8">
            <div className="mt-5 rounded-[1.5rem] border border-primary/15 bg-primary/5 p-5 text-sm leading-6 text-foreground">
              O acesso atual não foi marcado como recuperação de senha. Se você já pediu um link, volte para o e-mail e
              abra o endereço recebido.
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="h-12 rounded-2xl px-5 text-sm font-semibold">
                <Link to="/login" viewTransition>
                  Voltar ao login
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-2xl px-5 text-sm font-semibold"
                onClick={async () => {
                  await signOut();
                  navigate("/login", { replace: true, viewTransition: true });
                }}
              >
                Sair da conta
              </Button>
            </div>
          </div>
        </div>
      </ClientAuthStage>
    );
  }

  return (
    <ClientAuthStage>
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2.25rem] border border-border/70 bg-background text-foreground shadow-[0_16px_40px_rgba(16,24,40,0.08)]">
        <div className="border-b border-border/70 px-6 py-7 sm:px-8">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-primary/25 bg-primary/5 shadow-[0_8px_22px_rgba(16,24,40,0.05)]">
            <img src="/faviconV2.png" alt="Clinic+ logo" className="h-14 w-auto" />
          </div>

          <div className="mt-5 text-center">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary">Recuperar acesso</p>
            <h2 className="mt-3 text-[clamp(1.9rem,2.8vw,2.7rem)] font-semibold leading-[1] tracking-tight text-foreground">
              Receber link de redefinição
            </h2>
            <p className="mx-auto mt-3 max-w-[34ch] text-sm leading-6 text-muted-foreground">
              Informe seu e-mail corporativo para receber o link de recuperação no endereço cadastrado.
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-6 sm:px-8">
          <form
            onSubmit={async (event) => {
              event.preventDefault();

              const value = email.trim();
              if (!value) {
                toast.error("Informe o e-mail cadastrado.");
                return;
              }

              setRequestingReset(true);
              try {
                const error = await requestPasswordReset(value);
                if (error) throw error;

                setRequestSent(true);
                toast.success("Se existir uma conta com esse e-mail, enviamos o link de recuperação.");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Erro ao enviar o link de recuperação.");
              } finally {
                setRequestingReset(false);
              }
            }}
            className="mt-5 flex min-h-full flex-col space-y-4 rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]"
          >
            <div className="rounded-[1.25rem] border border-primary/15 bg-primary/5 px-4 py-3 text-sm leading-6 text-foreground">
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Envio seguro
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                O link só funciona no e-mail cadastrado e leva você para a tela de criação da nova senha.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recover-email" className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                E-mail corporativo
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <span className="pointer-events-none absolute left-10 top-1/2 h-7 w-px -translate-y-1/2 bg-border/80" />
                <Input
                  id="recover-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@empresa.com"
                  autoComplete="email"
                  className="h-12 rounded-2xl border-border/70 bg-background pl-14 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30"
                />
              </div>
            </div>

            <Button type="submit" className="h-12 w-full rounded-2xl text-sm font-semibold" disabled={requestingReset}>
              {requestingReset ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar link de recuperação
            </Button>

            {requestSent ? (
              <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
                Se o e-mail estiver cadastrado, você já pode conferir a caixa de entrada e o spam.
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm">
              <Button asChild variant="link" className="inline-flex items-center gap-2 px-0 text-primary transition-colors hover:text-primary/80">
                <Link to="/login" viewTransition>
                  <ArrowLeft className="h-4 w-4" />
                  Voltar ao login
                </Link>
              </Button>
              <span className="text-xs text-muted-foreground">Depois do link, você volta aqui para criar a nova senha.</span>
            </div>
          </form>
        </div>
      </div>
    </ClientAuthStage>
  );
}
