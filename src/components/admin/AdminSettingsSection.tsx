import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Lock, Save, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminSectionHeader } from "./AdminSectionHeader";
import { useAuth } from "@/hooks/useAuth";
import { getRoleLabel } from "@/lib/adminUsers";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function passwordStrength(password: string): { label: string; score: number; checks: { label: string; ok: boolean }[] } {
  const checks = [
    { label: "Mínimo 8 caracteres", ok: password.length >= 8 },
    { label: "Máximo 64 caracteres", ok: password.length <= 64 },
    { label: "Letra maiúscula", ok: /[A-Z]/.test(password) },
    { label: "Letra minúscula", ok: /[a-z]/.test(password) },
    { label: "Número", ok: /\d/.test(password) },
    { label: "Caractere especial", ok: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];
  const okCount = checks.filter((c) => c.ok).length;
  const labels = ["Fraca", "Fraca", "Regular", "Média", "Boa", "Forte", "Forte"];
  return { label: labels[Math.min(okCount, 6)], score: okCount, checks };
}

export function AdminSettingsSection() {
  const { user } = useAuth();

  const [name, setName] = useState(user?.user_metadata?.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const strength = passwordStrength(newPassword);

  const { data: currentRole } = useQuery({
    queryKey: ["current_admin_role", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_roles")
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
    if (!name.trim()) { toast.error("Nome nao pode ficar vazio"); return; }
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { name: name.trim() },
      });
      if (error) throw error;
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
    if (newPassword.length < 8) { toast.error("Nova senha deve ter no mínimo 8 caracteres"); return; }
    if (newPassword.length > 64) { toast.error("Nova senha deve ter no máximo 64 caracteres"); return; }
    if (!/[A-Z]/.test(newPassword)) { toast.error("Nova senha deve conter pelo menos uma letra maiúscula"); return; }
    if (!/[a-z]/.test(newPassword)) { toast.error("Nova senha deve conter pelo menos uma letra minúscula"); return; }
    if (!/\d/.test(newPassword)) { toast.error("Nova senha deve conter pelo menos um número"); return; }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) { toast.error("Nova senha deve conter pelo menos um caractere especial"); return; }
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
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Configurações"
        title="Senha e perfil"
        description="Gerencie seu perfil e altere sua senha de acesso"
        actions={null}
      />

      <form onSubmit={handleSaveProfile} className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Conta</p>
            <p className="mt-1 text-sm text-foreground">Altere os dados básicos da conta e mantenha a função apenas para leitura.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[13px] font-medium">Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="h-11 rounded-2xl border-border/70 bg-background text-[13px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-medium">E-mail</Label>
            <Input
              value={user?.email ?? ""}
              disabled
              className="h-11 rounded-2xl border-border/70 bg-muted/30 text-[13px] opacity-60"
            />
          </div>

          {currentRole && (
            <div className="space-y-2">
              <Label className="text-[13px] font-medium">Função</Label>
              <div className="flex h-11 items-center rounded-2xl border border-border/70 bg-muted/20 px-4 text-[13px]">
                <span className="inline-flex items-center rounded-full border bg-destructive/10 px-3 py-0.5 text-[12px] font-semibold text-destructive">
                  {getRoleLabel(currentRole)}
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground">Apenas o superadmin pode alterar funções de outros usuários.</p>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="submit"
            disabled={savingProfile}
            className="h-10 rounded-2xl px-4 text-sm"
          >
            {savingProfile ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </form>

      <form onSubmit={handleSavePassword} className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Segurança</p>
            <p className="mt-1 text-sm text-foreground">Altere sua senha de acesso ao painel</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[13px] font-medium">Senha atual</Label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Sua senha atual"
                maxLength={64}
                className="h-11 w-full rounded-2xl border-border/70 bg-background pr-10 text-[13px]"
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
            <Label className="text-[13px] font-medium">Nova senha</Label>
            <div className="relative">
              <Input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                maxLength={64}
                className="h-11 w-full rounded-2xl border-border/70 bg-background pr-10 text-[13px]"
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
            {newPassword.length > 0 && (
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
                  <span className="text-[11px] font-medium text-muted-foreground">{strength.label}</span>
                  <span className="ml-auto text-[11px] tabular-nums text-muted-foreground/60">{newPassword.length}/64</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {strength.checks.map((c) => (
                    <span
                      key={c.label}
                      className={cn("text-[11px]", c.ok ? "text-emerald-600" : "text-muted-foreground/60")}
                    >
                      {c.ok ? "✓" : "○"} {c.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-medium">Confirmar nova senha</Label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                maxLength={64}
                className="h-11 w-full rounded-2xl border-border/70 bg-background pr-10 text-[13px]"
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

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="submit"
            disabled={savingPassword}
            className="h-10 rounded-2xl px-4 text-sm"
          >
            {savingPassword ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Lock className="mr-1.5 h-4 w-4" />}
            Alterar senha
          </Button>
        </div>
      </form>
    </div>
  );
}
