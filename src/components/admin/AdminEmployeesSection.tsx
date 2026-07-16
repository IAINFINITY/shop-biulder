import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminSectionHeader } from "./AdminSectionHeader";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { useAuth } from "@/hooks/useAuth";
import {
  listEmployees,
  createEmployeeUser,
  deleteEmployeeUser,
  CLINIC_MASTER_CNPJ,
  type EmployeeUserRecord,
} from "@/lib/employeeUsers";
import { cn } from "@/lib/utils";
import { formatDocumentId, onlyDigits } from "@/lib/brazilianIds";
import { syncCustomerProxisLink } from "@/lib/proxisCustomer";

export function AdminEmployeesSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCpf, setNewCpf] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employee_users"],
    queryFn: listEmployees,
    enabled: !!user,
  });

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      e.phone?.toLowerCase().includes(q) ||
      e.cnpj?.includes(q)
    );
  }, [search, employees]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newPhone || !newEmail || !newCpf || !newPassword) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error("As senhas não conferem");
      return;
    }
    const cpfDigits = onlyDigits(newCpf);
    if (cpfDigits.length !== 11) {
      toast.error("CPF inválido. Preencha 11 dígitos.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres");
      return;
    }
    if (newPassword.length > 64) {
      toast.error("A senha deve ter no máximo 64 caracteres");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast.error("A senha deve conter pelo menos uma letra maiúscula");
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      toast.error("A senha deve conter pelo menos uma letra minúscula");
      return;
    }
    if (!/\d/.test(newPassword)) {
      toast.error("A senha deve conter pelo menos um número");
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      toast.error("A senha deve conter pelo menos um caractere especial");
      return;
    }
    setCreating(true);
    try {
      const { userId } = await createEmployeeUser({
        name: newName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim(),
        password: newPassword,
        cpf: cpfDigits,
      });

      await syncCustomerProxisLink(CLINIC_MASTER_CNPJ, userId).catch(() => null);

      toast.success("Funcionário criado com sucesso");
      setCreateOpen(false);
      setNewName("");
      setNewPhone("");
      setNewEmail("");
      setNewCpf("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      queryClient.invalidateQueries({ queryKey: ["employee_users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar funcionário");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Funcionários"
        title="Equipe vinculada à Clinic+"
        description="Gerencie funcionários que podem fazer pedidos em nome da empresa."
        actions={
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="h-10 rounded-2xl px-4 text-sm"
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            Novo funcionário
          </Button>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome, telefone ou CPF..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 rounded-2xl border-border/70 bg-background pl-9 text-[13px]"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="rounded-[1.25rem] border border-dashed border-border/70 p-8 text-center text-muted-foreground">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="text-sm font-medium">
            {search ? "Nenhum funcionário encontrado" : "Nenhum funcionário cadastrado"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {search ? "Tente alterar os termos da busca." : "Crie o primeiro funcionário para começar."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEmployees.map((emp) => (
            <div
              key={emp.user_id}
              className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-background p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-xs font-bold text-primary">
                      {emp.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{emp.name}</p>
                      <p className="truncate text-[12px] text-muted-foreground">{emp.phone || "—"}</p>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] text-primary">
                  Funcionário
                </Badge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Telefone</p>
                  <div className="flex h-11 items-center rounded-2xl border border-border/70 bg-muted/20 px-4 text-sm text-foreground">
                    {emp.phone || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Documento</p>
                  <div className="flex h-11 items-center rounded-2xl border border-border/70 bg-muted/20 px-4 text-sm text-foreground">
                    {formatDocumentId(emp.cnpj) || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Vinculado a</p>
                  <div className="flex h-11 items-center rounded-2xl border border-border/70 bg-muted/20 px-4 text-sm text-foreground">
                    {emp.linked_company_cnpj ? formatDocumentId(emp.linked_company_cnpj) : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-[11px] text-muted-foreground">
                  Criado em {new Date(emp.created_at).toLocaleDateString("pt-BR")}
                </p>
                <div className="flex items-center gap-2">
                  <ConfirmActionDialog
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-full border-destructive/40 px-4 text-[13px] text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </Button>
                    }
                    title="Excluir funcionário"
                    description={`Tem certeza que deseja excluir permanentemente o funcionário "${emp.name}"? Esta ação não pode ser desfeita.`}
                    confirmLabel="Excluir"
                    processingLabel="Apagando..."
                    destructive
                    onConfirm={async () => {
                      try {
                        await deleteEmployeeUser(emp.user_id);
                        toast.success("Funcionário excluído permanentemente");
                        queryClient.invalidateQueries({ queryKey: ["employee_users"] });
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Erro ao excluir funcionário");
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setNewName("");
            setNewPhone("");
            setNewEmail("");
            setNewCpf("");
            setNewPassword("");
            setNewPasswordConfirm("");
            setShowPassword(false);
            setShowConfirmPassword(false);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-[56rem] overflow-y-auto rounded-[1.35rem] border-border/70 sm:rounded-[1.75rem]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[1.05rem] font-black tracking-[-0.04em] text-foreground">
              <UserPlus className="h-5 w-5" />
              Novo funcionário
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Nome
                </Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome completo"
                  required
                  className="h-11 rounded-2xl border-border/70 bg-background text-[13px]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Telefone
                </Label>
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  required
                  className="h-11 rounded-2xl border-border/70 bg-background text-[13px]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  CPF
                </Label>
                <Input
                  value={newCpf}
                  onChange={(e) => setNewCpf(formatDocumentId(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  maxLength={14}
                  required
                  className="h-11 rounded-2xl border-border/70 bg-background text-[13px]"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  E-mail
                </Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="funcionario@email.com"
                  required
                  className="h-11 rounded-2xl border-border/70 bg-background text-[13px]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    maxLength={64}
                    required
                    className="h-11 rounded-2xl border-border/70 bg-background pr-10 text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Confirmar senha
                </Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    placeholder="Repita a senha"
                    maxLength={64}
                    required
                    className="h-11 rounded-2xl border-border/70 bg-background pr-10 text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 rounded-[1.25rem] border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-foreground">
              O funcionário será vinculado automaticamente à Clinic+ (CNPJ {formatDocumentId(CLINIC_MASTER_CNPJ)})
              e poderá fazer pedidos com as tabelas de preço da empresa.
            </div>

            <DialogFooter className="md:col-span-2 gap-2 border-t border-border/70 pt-4 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  setNewName("");
                  setNewPhone("");
                  setNewEmail("");
                  setNewCpf("");
                  setNewPassword("");
                  setNewPasswordConfirm("");
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                }}
                className="h-11 rounded-2xl px-5 text-sm"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="h-11 rounded-2xl px-5 text-sm"
              >
                {creating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
                {creating ? "Criando..." : "Criar funcionário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
