import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  Loader2,
  Plus,
  PencilLine,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  updateEmployeeUser,
  deleteEmployeeUser,
  CLINIC_MASTER_CNPJ,
  type EmployeeUserRecord,
} from "@/lib/employeeUsers";
import { cn } from "@/lib/utils";
import { formatDocumentId, onlyDigits } from "@/lib/brazilianIds";
import {
  COLUNAS_TXT,
  EXEMPLO_TXT,
  lerTxtDeFuncionarios,
  type ErroImportacao,
} from "@/lib/employeeBulkImport";
import { syncCustomerProxisLink } from "@/lib/proxisCustomer";
import { MODAL_TELA_CHEIA } from "@/lib/modais";
import { validarSenha } from "@/lib/validarSenha";
import { MIN_SEM_MFA } from "@/lib/senha";

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
  const [importOpen, setImportOpen] = useState(false);
  const [importTexto, setImportTexto] = useState("");
  const [importando, setImportando] = useState(false);
  const [importProgresso, setImportProgresso] = useState({ feitos: 0, total: 0 });
  const importFileRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<EmployeeUserRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [updating, setUpdating] = useState(false);

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

  function resetEditState() {
    setEditEmployee(null);
    setEditName("");
    setEditPhone("");
    setEditEmail("");
    setEditCpf("");
    setUpdating(false);
  }

  function openEditEmployee(employee: EmployeeUserRecord) {
    setEditEmployee(employee);
    setEditName(employee.name);
    setEditPhone(employee.phone);
    setEditEmail(employee.email ?? "");
    setEditCpf(formatDocumentId(employee.cnpj));
    setEditOpen(true);
  }

  // `employees` ja esta carregado nesta tela: barrar o repetido aqui custa nada
  // e evita descobrir no meio da importacao o que dava para saber antes.
  const leitura = useMemo(
    () => lerTxtDeFuncionarios(importTexto, employees.map((e) => ({ email: e.email, cpf: e.cnpj }))),
    [importTexto, employees],
  );

  async function handleImportar() {
    const { validos } = leitura;
    if (validos.length === 0) return;

    setImportando(true);
    setImportProgresso({ feitos: 0, total: validos.length });

    const falhas: ErroImportacao[] = [];
    let criados = 0;

    // Um a um, e nao em paralelo: a criacao passa por auth, e disparar dezenas de
    // cadastros juntos derruba no limite de requisicoes — a metade que falha
    // volta como erro generico, sem dizer quem ficou de fora.
    for (const linha of validos) {
      try {
        const { userId } = await createEmployeeUser({
          name: linha.nome,
          phone: linha.telefone,
          email: linha.email,
          cpf: linha.cpf,
        });
        await syncCustomerProxisLink(CLINIC_MASTER_CNPJ, userId).catch(() => null);
        criados += 1;
      } catch (err) {
        falhas.push({
          linha: linha.linha,
          conteudo: `${linha.nome} · ${linha.email}`,
          motivo: err instanceof Error ? err.message : "Erro desconhecido",
        });
      }
      setImportProgresso((atual) => ({ ...atual, feitos: atual.feitos + 1 }));
    }

    setImportando(false);
    queryClient.invalidateQueries({ queryKey: ["employee_users"] });

    if (falhas.length === 0) {
      toast.success(`${criados} funcionário(s) importado(s).`);
      setImportOpen(false);
      setImportTexto("");
      return;
    }

    // O texto fica na tela com so as linhas que falharam, para a pessoa corrigir
    // e reenviar sem ter de garimpar quais deram certo.
    toast.warning(`${criados} criado(s), ${falhas.length} com erro. Veja a lista.`);
    setImportTexto(falhas.map((f) => [`# linha ${f.linha}: ${f.motivo}`, f.conteudo].join("\n")).join("\n"));
  }

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
    // Politica unica em `src/lib/senha.ts`; as regras de composicao que estavam
    // aqui sao proibidas pela §10 do padrao de autenticacao.
    const validacaoDeSenha = await validarSenha(newPassword);
    if (!validacaoDeSenha.ok) {
      toast.error(validacaoDeSenha.problema!);
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

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editEmployee || !editName || !editPhone || !editEmail || !editCpf) {
      toast.error("Preencha todos os campos");
      return;
    }

    const cpfDigits = onlyDigits(editCpf);
    if (cpfDigits.length !== 11) {
      toast.error("CPF inválido. Preencha 11 dígitos.");
      return;
    }

    setUpdating(true);
    try {
      await updateEmployeeUser({
        userId: editEmployee.user_id,
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        cpf: cpfDigits,
      });

      toast.success("Funcionário atualizado com sucesso");
      setEditOpen(false);
      resetEditState();
      queryClient.invalidateQueries({ queryKey: ["employee_users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar funcionário");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Funcionários"
        title="Equipe vinculada à Clinic+"
        description="Gerencie funcionários que podem fazer pedidos em nome da empresa."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="h-10 rounded-2xl px-4 text-sm"
            >
              <Upload className="mr-1.5 h-4 w-4" />
              Importar TXT
            </Button>
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="h-10 rounded-2xl px-4 text-sm"
            >
              <UserPlus className="mr-1.5 h-4 w-4" />
              Novo funcionário
            </Button>
          </div>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome, telefone ou CPF..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 rounded-2xl border-border/70 bg-background pl-9 text-[0.8125rem]"
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
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-xs font-semibold text-primary">
                      {emp.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{emp.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{emp.phone || "—"}</p>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-2.5 py-1 text-[0.6875rem] text-primary">
                  Funcionário
                </Badge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Telefone</p>
                  <div className="flex h-11 items-center rounded-2xl border border-border/70 bg-muted/20 px-4 text-sm text-foreground">
                    {emp.phone || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Documento</p>
                  <div className="flex h-11 items-center rounded-2xl border border-border/70 bg-muted/20 px-4 text-sm text-foreground">
                    {formatDocumentId(emp.cnpj) || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Vinculado a</p>
                  <div className="flex h-11 items-center rounded-2xl border border-border/70 bg-muted/20 px-4 text-sm text-foreground">
                    {emp.linked_company_cnpj ? formatDocumentId(emp.linked_company_cnpj) : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-[0.6875rem] text-muted-foreground">
                  Criado em {new Date(emp.created_at).toLocaleDateString("pt-BR")}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-full px-4 text-[0.8125rem]"
                    onClick={() => openEditEmployee(emp)}
                  >
                    <PencilLine className="h-4 w-4" />
                    Editar
                  </Button>
                  <ConfirmActionDialog
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-full border-destructive/40 px-4 text-[0.8125rem] text-destructive hover:bg-destructive/10"
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
        <DialogContent className={cn(MODAL_TELA_CHEIA, "max-h-[calc(100dvh-2rem)] max-w-[56rem] overflow-y-auto rounded-[1.35rem] border-border/70 sm:rounded-[1.75rem]")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
              <UserPlus className="h-5 w-5" />
              Novo funcionário
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Nome
                </Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome completo"
                  required
                  className="h-11 rounded-2xl border-border/70 bg-background text-[0.8125rem]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Telefone
                </Label>
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  required
                  className="h-11 rounded-2xl border-border/70 bg-background text-[0.8125rem]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  CPF
                </Label>
                <Input
                  value={newCpf}
                  onChange={(e) => setNewCpf(formatDocumentId(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  maxLength={14}
                  required
                  className="h-11 rounded-2xl border-border/70 bg-background text-[0.8125rem]"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  E-mail
                </Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="funcionario@email.com"
                  required
                  className="h-11 rounded-2xl border-border/70 bg-background text-[0.8125rem]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={`Mínimo ${MIN_SEM_MFA} caracteres`}
                    maxLength={64}
                    required
                    className="h-11 rounded-2xl border-border/70 bg-background pr-10 text-[0.8125rem]"
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
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Confirmar senha
                </Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    placeholder="Repita a senha"
                    maxLength={64}
                    required
                    className="h-11 rounded-2xl border-border/70 bg-background pr-10 text-[0.8125rem]"
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

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) resetEditState();
        }}
      >
        <DialogContent className={cn(MODAL_TELA_CHEIA, "max-h-[calc(100dvh-2rem)] max-w-[56rem] overflow-y-auto rounded-[1.35rem] border-border/70 sm:rounded-[1.75rem]")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
              <PencilLine className="h-5 w-5" />
              Editar funcionário
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdate} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Nome</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome completo"
                  required
                  className="h-11 rounded-2xl border-border/70 bg-background text-[0.8125rem]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Telefone</Label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  required
                  className="h-11 rounded-2xl border-border/70 bg-background text-[0.8125rem]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">CPF</Label>
                <Input
                  value={editCpf}
                  onChange={(e) => setEditCpf(formatDocumentId(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  maxLength={14}
                  required
                  className="h-11 rounded-2xl border-border/70 bg-background text-[0.8125rem]"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">E-mail</Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="funcionario@email.com"
                  required
                  className="h-11 rounded-2xl border-border/70 bg-background text-[0.8125rem]"
                />
              </div>

              <div className="rounded-[1.25rem] border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-foreground">
                O vínculo com a Clinic+ será mantido automaticamente.
                <div className="mt-1 text-muted-foreground">
                  CNPJ {formatDocumentId(CLINIC_MASTER_CNPJ)}
                </div>
              </div>
            </div>

            <DialogFooter className="md:col-span-2 gap-2 border-t border-border/70 pt-4 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditOpen(false);
                  resetEditState();
                }}
                className="h-11 rounded-2xl px-5 text-sm"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updating} className="h-11 rounded-2xl px-5 text-sm">
                {updating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PencilLine className="mr-1.5 h-4 w-4" />}
                {updating ? "Salvando..." : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          if (importando) return;
          setImportOpen(open);
        }}
      >
        <DialogContent className={cn(MODAL_TELA_CHEIA, "max-h-[calc(100dvh-2rem)] max-w-[46rem] overflow-y-auto rounded-[1.35rem] border-border/70 sm:rounded-[1.75rem]")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
              <Upload className="h-5 w-5" />
              Importar funcionários por TXT
            </DialogTitle>
          </DialogHeader>

          {/* O formato vem antes do campo de proposito: e a duvida que a pessoa
              tem no instante em que abre esta tela. */}
          <div className="space-y-2 rounded-[1.25rem] border border-border/70 bg-muted/30 p-4">
            <p className="text-[0.8125rem] font-medium text-foreground">Um funcionário por linha, nesta ordem:</p>
            <code className="block rounded-lg bg-background px-3 py-2 font-mono text-[0.8125rem] text-foreground">
              {COLUNAS_TXT.join(",")}
            </code>
            <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
              Telefone com DDD (10 ou 11 dígitos) e CPF com 11 dígitos — pontuação é ignorada, pode colar como estiver.
              Ponto e vírgula ou tabulação também servem de separador. Linha começando com{" "}
              <code className="font-mono">#</code> é comentário, e o cabeçalho é ignorado.
            </p>
            <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">A senha não vai no arquivo.</span> Todos entram com a
              senha provisória definida nas configurações e{" "}
              <span className="font-medium text-foreground">são obrigados a trocá-la no primeiro acesso</span> — o
              site não deixa usar nada antes disso.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="h-10 sm:h-8 rounded-full px-3 text-xs"
                onClick={() => setImportTexto(EXEMPLO_TXT)}
              >
                Preencher com exemplo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 sm:h-8 rounded-full px-3 text-xs"
                onClick={() => importFileRef.current?.click()}
              >
                Escolher arquivo .txt
              </Button>
              <input
                ref={importFileRef}
                type="file"
                accept=".txt,.csv,text/plain"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  setImportTexto(await file.text());
                }}
              />
            </div>
          </div>

          <div className="space-y-2 py-2">
            <Label htmlFor="import-txt" className="text-[0.8125rem] font-medium">
              Conteúdo
            </Label>
            <Textarea
              id="import-txt"
              value={importTexto}
              onChange={(event) => setImportTexto(event.target.value)}
              placeholder={"Maria Souza,maria@empresa.com.br,11987654321,12345678901"}
              rows={8}
              className="rounded-2xl border-border/70 bg-background font-mono text-[0.8125rem]"
            />
          </div>

          {importTexto.trim() ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full border-success/30 bg-success/5 px-3 py-1 text-[0.6875rem] text-success"
                >
                  {leitura.validos.length} pronto(s) para importar
                </Badge>
                {leitura.erros.length > 0 ? (
                  <Badge
                    variant="outline"
                    className="rounded-full border-destructive/30 bg-destructive/5 px-3 py-1 text-[0.6875rem] text-destructive"
                  >
                    {leitura.erros.length} com problema
                  </Badge>
                ) : null}
              </div>

              {/* Cada recusa com o numero da linha: e assim que a pessoa acha o
                  erro no proprio arquivo, em vez de reler tudo. */}
              {leitura.erros.length > 0 ? (
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-destructive/20 bg-destructive/[0.04] p-3">
                  {leitura.erros.map((erro) => (
                    <li key={erro.linha} className="text-[0.6875rem] leading-relaxed text-destructive">
                      <span className="font-medium">Linha {erro.linha}:</span> {erro.motivo}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="gap-2 border-t border-border/70 pt-4 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={importando}
              onClick={() => setImportOpen(false)}
              className="h-11 rounded-2xl px-5 text-sm"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={importando || leitura.validos.length === 0}
              onClick={handleImportar}
              className="h-11 rounded-2xl px-5 text-sm"
            >
              {importando ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Importando {importProgresso.feitos}/{importProgresso.total}...
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-4 w-4" />
                  Importar {leitura.validos.length || ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
