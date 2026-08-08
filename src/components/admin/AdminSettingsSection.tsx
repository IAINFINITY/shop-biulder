import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminSectionHeader } from "./AdminSectionHeader";
import { useAuth } from "@/hooks/useAuth";
import { getRoleLabel } from "@/lib/adminUsers";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { validarSenha } from "@/lib/validarSenha";
import { forcaDaSenha } from "@/lib/forcaDaSenha";
import { MIN_SEM_MFA } from "@/lib/senha";
import { AutenticadoresSection } from "@/components/client/AutenticadoresSection";


type InfoTileProps = {
  label: string;
  value: string;
  hint?: string;
  icon: typeof UserRound;
};

function InfoTile({ label, value, hint, icon: Icon }: InfoTileProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <p className="min-w-0 truncate text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
      </div>
      {/* `break-words`: o valor aqui e o e-mail da conta. Ver a nota igual no
          `InfoTile` do Account — sao duas copias do mesmo cartao. */}
      <p className="mt-3 break-words text-sm font-medium text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function AdminSettingsSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.user_metadata?.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const strength = forcaDaSenha(newPassword);

  useEffect(() => {
    setName(user?.user_metadata?.name ?? "");
  }, [user?.id, user?.user_metadata?.name]);

  const { data: currentRole } = useQuery({
    queryKey: ["current_admin_role", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("clinic+b2b_user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["superadmin", "admin", "consultor", "representante", "admin_atendimento"])
        .maybeSingle();
      return data?.role ?? null;
    },
    enabled: !!user,
  });

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }
    if (!name.trim()) { toast.error("Nome não pode ficar vazio"); return; }
    setSavingProfile(true);
    try {
      const nextName = name.trim();
      const { error } = await supabase.auth.updateUser({
        data: { name: nextName },
      });
      if (error) throw error;
      const { error: displayNameError } = await supabase.rpc("set_admin_display_name", {
        p_user_id: user.id,
        p_display_name: nextName,
      });
      if (displayNameError) throw displayNameError;

      setName(nextName);
      void queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      toast.success("Perfil atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar perfil");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) { toast.error("Informe a senha atual"); return; }
    // Politica unica em `src/lib/senha.ts` (§10 do padrao de autenticacao).
    const validacaoDeSenha = await validarSenha(newPassword);
    if (!validacaoDeSenha.ok) {
      toast.error(validacaoDeSenha.problema!);
      return;
    }
    // As quatro regras de composição que havia aqui — maiúscula, minúscula,
    // dígito e caractere especial — são proibidas pela §10 e já tinham saído da
    // política. Elas sobreviveram **rodando antes** de `validarSenha`, então
    // recusavam a senha e a política nova nem chegava a ser consultada.
    if (newPassword !== confirmPassword) { toast.error("Senhas não conferem"); return; }

    setSavingPassword(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPassword,
      });
      if (signInErr) {
        toast.error("Senha atual incorreta");
        setSavingPassword(false);
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateErr) throw updateErr;

      toast.success("Senha alterada com sucesso");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar senha");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminSectionHeader
        eyebrow="Configurações"
        title="Senha e perfil"
        description="Gerencie seu perfil, sua função e sua senha de acesso ao painel"
        actions={null}
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoTile
          label="Usuário"
          value={name.trim() || user?.email || "—"}
          hint="Conta vinculada ao painel administrativo."
          icon={UserRound}
        />
        <InfoTile
          label="E-mail"
          value={user?.email || "—"}
          hint="Login usado nesta sessão."
          icon={Mail}
        />
        <InfoTile
          label="Função"
          value={currentRole ? getRoleLabel(currentRole) : "Admin"}
          hint="Permissão ativa nesta conta."
          icon={ShieldCheck}
        />
        <InfoTile
          label="Acesso"
          value={currentRole ? "Painel administrativo" : "Sessão ativa"}
          hint="Área interna do Clinic+."
          icon={ShieldCheck}
        />
      </div>

      <form
        onSubmit={handleSaveProfile}
        className="rounded-[1.5rem] border border-border/70 bg-background/95 p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)] sm:p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <UserRound className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold text-foreground">Dados da conta</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="h-11 rounded-2xl border-border/70 bg-background text-[0.8125rem]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">E-mail</Label>
            <Input
              value={user?.email ?? ""}
              disabled
              className="h-11 rounded-2xl border-border/70 bg-muted/30 text-[0.8125rem] opacity-60"
            />
          </div>
        </div>

        {currentRole ? (
          <div className="space-y-2">
            <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Função</Label>
            <div className="flex h-11 items-center rounded-2xl border border-border/70 bg-muted/20 px-4 text-[0.8125rem]">
              <span className="inline-flex items-center rounded-full border bg-destructive/10 px-3 py-0.5 text-xs font-semibold text-destructive">
                {getRoleLabel(currentRole)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Apenas o superadmin pode alterar funções de outros usuários.</p>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={savingProfile} className="h-10 rounded-2xl px-4 text-sm">
            {savingProfile ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </form>

      <form
        onSubmit={handleSavePassword}
        className="rounded-[1.5rem] border border-border/70 bg-background/95 p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)] sm:p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold text-foreground">Alterar senha</p>
        </div>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Senha atual</Label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Sua senha atual"
                maxLength={64}
                className="h-11 w-full rounded-2xl border-border/70 bg-background pr-10 text-[0.8125rem]"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Nova senha</Label>
            <div className="relative">
              <Input
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={`Mínimo ${MIN_SEM_MFA} caracteres`}
                maxLength={64}
                className="h-11 w-full rounded-2xl border-border/70 bg-background pr-10 text-[0.8125rem]"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        strength.score <= 1 ? "w-1/6 bg-red-400" :
                        strength.score <= 2 ? "w-1/3 bg-orange-400" :
                        strength.score <= 3 ? "w-1/2 bg-yellow-400" :
                        strength.score <= 4 ? "w-2/3 bg-yellow-400" :
                        strength.score <= 5 ? "w-5/6 bg-emerald-400" :
                        "w-full bg-emerald-400",
                      )}
                    />
                  </div>
                  <span className="text-[0.6875rem] font-medium text-muted-foreground">{strength.label}</span>
                  <span className="ml-auto text-[0.6875rem] tabular-nums text-muted-foreground/60">{newPassword.length}/64</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {strength.checks.map((c) => (
                    <span key={c.label} className={cn("text-[0.6875rem]", c.ok ? "text-emerald-600" : "text-muted-foreground/60")}>
                      {c.ok ? "✓" : "○"} {c.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Confirmar nova senha</Label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                maxLength={64}
                className="h-11 w-full rounded-2xl border-border/70 bg-background pr-10 text-[0.8125rem]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={savingPassword} className="h-10 rounded-2xl px-4 text-sm">
            {savingPassword ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}
            Alterar senha
          </Button>
        </div>
      </form>

      {/* O administrador precisa cadastrar o fator **aqui**.

          Enquanto o MFA era obrigatorio, o cadastro aparecia sozinho no portao
          do painel. Ao torna-lo opcional, o portao deixou de bloquear — e o
          unico outro lugar com o cadastro e a pagina da conta, que redireciona
          o admin para ca ("Voce esta logado como admin"). Sem esta secao, quem
          administra nao consegue ativar a protecao nem querendo, que e o
          oposto do que "opcional" deveria significar. */}
      <AutenticadoresSection className="rounded-[1.5rem] border border-border/70 shadow-[0_12px_32px_rgba(16,24,40,0.08)] ring-0" />
    </div>
  );
}
