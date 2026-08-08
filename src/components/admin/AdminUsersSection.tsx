import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Edit,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserPlus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ADMIN_ROLES,
  getRoleLabel,
  getRoleVariant,
  listAdminUsers,
  createAdminUser,
  updateAdminRole,
  toggleAdminActive,
  deleteAdminUser,
  updateAdminDisplayName,
  updateAdminPermissions,
  type AdminPermissions,
  type AdminUserCreatePayload,
  type AdminUserRecord,
} from "@/lib/adminUsers";
import type { AdminSection } from "./adminTypes";
import { cn } from "@/lib/utils";
import { MODAL_TELA_CHEIA } from "@/lib/modais";
import { validarSenha } from "@/lib/validarSenha";
import { forcaDaSenha } from "@/lib/forcaDaSenha";
import { MIN_SEM_MFA } from "@/lib/senha";

const PERMISSION_OPTIONS: { id: AdminSection; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "banners", label: "Banners" },
  { id: "notificacoes", label: "Notificações" },
  { id: "produtos", label: "Produtos" },
  { id: "imagens", label: "Imagens" },
  { id: "precos", label: "Preços" },
  { id: "pedidos", label: "Pedidos" },
  { id: "clientes", label: "Clientes" },
  { id: "mensagens", label: "Mensagens" },
  { id: "funcionarios", label: "Funcionários" },
  { id: "configuracoes", label: "Configurações" },
];

const SUPERADMIN_ONLY_OPTIONS: { id: AdminSection; label: string }[] = [
  { id: "usuarios", label: "Usuários" },
];

function defaultPermissions(): AdminPermissions {
  const perms = {} as AdminPermissions;
  for (const opt of PERMISSION_OPTIONS) {
    perms[opt.id] = false;
  }
  for (const opt of SUPERADMIN_ONLY_OPTIONS) {
    perms[opt.id] = false;
  }
  return perms;
}

function allPermissions(): AdminPermissions {
  const perms = defaultPermissions();
  for (const key of Object.keys(perms) as AdminSection[]) {
    perms[key] = true;
  }
  return perms;
}

type PermissionChecklistProps = {
  value: AdminPermissions;
  onChange: (value: AdminPermissions) => void;
};

function PermissionChecklist({ value, onChange }: PermissionChecklistProps) {
  const toggle = (id: AdminSection) => {
    onChange({ ...value, [id]: !value[id] });
  };

  return (
    <div className="space-y-3">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Permissões
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PERMISSION_OPTIONS.map((opt) => (
          <label
            key={opt.id}
            className="flex items-center gap-2 rounded-xl border border-border/70 px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/30 transition-colors"
          >
            <Checkbox
              checked={value[opt.id]}
              onCheckedChange={() => toggle(opt.id)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      <p className="text-[0.6875rem] text-muted-foreground">
        {SUPERADMIN_ONLY_OPTIONS.map((o) => o.label).join(" e ")} — apenas visível para superadmin
      </p>
    </div>
  );
}


export function AdminUsersSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<AdminUserRecord["role"]>("admin");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPermissions, setNewPermissions] = useState<AdminPermissions>(defaultPermissions());

  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [editPermissions, setEditPermissions] = useState<AdminPermissions>(defaultPermissions());
  const [editName, setEditName] = useState("");
  const [savingPermissions, setSavingPermissions] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin_users"],
    queryFn: listAdminUsers,
    enabled: !!user,
  });

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) {
      counts[u.role] = (counts[u.role] ?? 0) + 1;
    }
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        if (search) {
          const q = search.toLowerCase();
          if (
            !u.email.toLowerCase().includes(q) &&
            !u.display_name.toLowerCase().includes(q) &&
            !getRoleLabel(u.role).toLowerCase().includes(q)
          ) return false;
        }
        if (roleFilter !== null && u.role !== roleFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.role === "superadmin" && b.role !== "superadmin") return -1;
        if (a.role !== "superadmin" && b.role === "superadmin") return 1;
        return 0;
      });
  }, [search, roleFilter, users]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail || !newPassword) { toast.error("Preencha e-mail e senha"); return; }
    if (newPassword !== newPasswordConfirm) { toast.error("As senhas não conferem"); return; }
    // Politica unica em `src/lib/senha.ts` (§10 do padrao de autenticacao).
    const validacaoDeSenha = await validarSenha(newPassword);
    if (!validacaoDeSenha.ok) {
      toast.error(validacaoDeSenha.problema!);
      return;
    }
    // Ver a nota em `AdminSettingsSection`: as regras de composição rodavam
    // antes de `validarSenha` e recusavam a senha sem a política nova opinar.
    setCreating(true);
    try {
      await createAdminUser({
        email: newEmail.trim(),
        password: newPassword,
        displayName: newDisplayName.trim(),
        role: newRole,
        permissions: newPermissions,
      });
      toast.success("Usuário criado com sucesso");
      setCreateOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setNewDisplayName("");
      setNewRole("admin");
      setNewPermissions(defaultPermissions());
      setShowPassword(false);
      setShowConfirmPassword(false);
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar usuário");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(user: AdminUserRecord) {
    setEditingUser(user);
    setEditPermissions(user.permissions ?? { ...allPermissions(), funcionarios: false });
    setEditName(user.display_name ?? "");
    setEditOpen(true);
  }

  async function handleSavePermissions() {
    if (!editingUser) return;
    setSavingPermissions(true);
    try {
      // Nome primeiro: se ele falhar, nao adianta ter gravado permissao — o
      // superadmin fecharia o dialogo achando que salvou as duas coisas.
      const nome = editName.trim();
      if (nome !== (editingUser.display_name ?? "")) {
        await updateAdminDisplayName(editingUser.user_id, nome);
      }
      await updateAdminPermissions(editingUser.user_id, editPermissions);
      toast.success("Usuário atualizado");
      setEditOpen(false);
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar permissões");
    } finally {
      setSavingPermissions(false);
    }
  }

  const strength = forcaDaSenha(newPassword);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Usuários"
        title="Contas e permissões"
        description="Gerencie contas com acesso ao painel administrativo"
        actions={
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="h-10 rounded-2xl px-4 text-sm"
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            Novo usuário
          </Button>
        }
      />

      <div className="sticky top-0 z-10 -mx-4 space-y-3 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:static sm:z-auto sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por e-mail, nome ou papel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-2xl border-border/70 bg-background pl-9 text-[0.8125rem]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {ADMIN_ROLES.map((r) => (
            <Badge key={r.value} variant="outline" className="rounded-full border-primary/15 bg-primary/5 px-2.5 py-1 text-[0.6875rem] text-primary">
              {r.label}: {roleCounts[r.value] ?? 0}
            </Badge>
          ))}
          <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[0.6875rem] text-muted-foreground">
            Superadmin: {roleCounts["superadmin"] ?? 0}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={roleFilter === null ? "default" : "outline"} className="h-10 rounded-full px-3 text-[0.8125rem]" onClick={() => setRoleFilter(null)}>
            Todos
          </Button>
          {ADMIN_ROLES.map((r) => (
            <Button
              key={r.value}
              type="button"
              variant={roleFilter === r.value ? "default" : "outline"}
              className="h-10 rounded-full px-3 text-[0.8125rem]"
              onClick={() => setRoleFilter(roleFilter === r.value ? null : r.value)}
            >
              {r.label}
            </Button>
          ))}
          <Button
            type="button"
            variant={roleFilter === "superadmin" ? "default" : "outline"}
            className="h-10 rounded-full px-3 text-[0.8125rem]"
            onClick={() => setRoleFilter(roleFilter === "superadmin" ? null : "superadmin")}
          >
            Superadmin
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-[1.25rem] border border-dashed border-border/70 p-8 text-center text-muted-foreground">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="text-sm font-medium">
            {search ? "Nenhum usuário encontrado" : "Nenhum usuário administrativo cadastrado"}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {filteredUsers.map((u) => (
              <div key={`${u.user_id}-${u.role}`} className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-background p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-xs font-semibold text-primary">
                        {(u.display_name || u.email).slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {u.display_name || u.email.split("@")[0]}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </div>
                  {u.is_active ? (
                    <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[0.6875rem] text-emerald-600">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-full border-red-200 bg-red-50 px-2.5 py-1 text-[0.6875rem] text-red-500">
                      Inativo
                    </Badge>
                  )}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Papel</p>
                    {u.role === "superadmin" ? (
                      <span className={cn("inline-flex w-full items-center justify-center rounded-full border px-4 py-2 text-[0.8125rem] font-semibold", getRoleVariant(u.role))}>
                        {getRoleLabel(u.role)}
                      </span>
                    ) : (
                      <Select
                        value={u.role}
                        onValueChange={async (val) => {
                          try {
                            await updateAdminRole(u.user_id, val as AdminUserRecord["role"]);
                            toast.success("Papel atualizado");
                            queryClient.invalidateQueries({ queryKey: ["admin_users"] });
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Erro ao alterar papel");
                          }
                        }}
                      >
                        <SelectTrigger className={cn("h-11 w-full rounded-2xl border bg-background px-4 text-[0.8125rem]", getRoleVariant(u.role))}>
                          <SelectValue>{getRoleLabel(u.role)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border/70 text-[0.8125rem]">
                          {ADMIN_ROLES.filter((r) => r.value !== u.role).map((r) => (
                            <SelectItem key={r.value} value={r.value} className="rounded-lg">
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Criado em</p>
                    <div className="flex h-11 items-center rounded-2xl border border-border/70 bg-muted/20 px-4 text-sm text-foreground">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-[0.6875rem] text-muted-foreground">
                    ID: <span className="font-mono text-foreground">{u.user_id.slice(0, 8)}...</span>
                  </p>
                  <div className="flex items-center gap-2">
                  {u.role !== "superadmin" && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-full px-4 text-[0.8125rem]"
                        onClick={() => openEdit(u)}
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </Button>
                      <ConfirmActionDialog
                        trigger={
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "h-10 rounded-full px-4 text-[0.8125rem]",
                              u.is_active
                                ? "border-destructive/20 text-destructive hover:bg-destructive/10"
                                : "border-emerald-200 text-emerald-600 hover:bg-emerald-50",
                            )}
                          >
{u.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          {u.is_active ? "Desativar" : "Ativar"}
                        </Button>
                      }
                      title={u.is_active ? "Desativar usuário" : "Ativar usuário"}
                      description={
                        u.is_active
                          ? `O usuário "${u.display_name || u.email}" perderá acesso ao painel.`
                          : `O usuário "${u.display_name || u.email}" recuperará acesso ao painel.`
                      }
                        confirmLabel={u.is_active ? "Desativar" : "Ativar"}
                        processingLabel={u.is_active ? "Desativando..." : "Ativando..."}
                        destructive={u.is_active}
                        onConfirm={async () => {
                          try {
                            await toggleAdminActive(u.user_id, !u.is_active);
                            toast.success(u.is_active ? "Usuário desativado" : "Usuário ativado");
                            queryClient.invalidateQueries({ queryKey: ["admin_users"] });
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Erro ao alterar status");
                          }
                        }}
                      />
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
                        title="Excluir usuário"
                        description={`Tem certeza que deseja excluir permanentemente o usuário "${u.display_name || u.email}"? Esta ação não pode ser desfeita.`}
                        confirmLabel="Excluir"
                        processingLabel="Apagando..."
                        destructive
                        onConfirm={async () => {
                          try {
                            await deleteAdminUser(u.user_id);
                            toast.success("Usuário excluído permanentemente");
                            queryClient.invalidateQueries({ queryKey: ["admin_users"] });
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Erro ao excluir usuário");
                          }
                        }}
                      />
                    </>
                  )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-[1.25rem] border border-border/70 lg:block">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead className="bg-muted/30 text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="w-[24%] whitespace-nowrap px-5 py-3.5 text-left font-semibold">Usuário</th>
                <th className="w-[22%] whitespace-nowrap px-5 py-3.5 text-left font-semibold">E-mail</th>
                <th className="w-[14%] whitespace-nowrap px-5 py-3.5 text-left font-semibold">Papel</th>
                <th className="w-[14%] whitespace-nowrap px-5 py-3.5 text-left font-semibold">Status</th>
                <th className="w-[13%] whitespace-nowrap px-5 py-3.5 text-left font-semibold">Criado em</th>
                <th className="w-[13%] whitespace-nowrap px-5 py-3.5 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={`${u.user_id}-${u.role}`} className="border-t border-border/60 hover:bg-muted/20">
                  <td className="truncate px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-xs font-semibold text-primary">
                        {(u.display_name || u.email).slice(0, 1).toUpperCase()}
                      </span>
                      <span className="truncate text-sm font-semibold text-foreground">
                        {u.display_name || u.email.split("@")[0]}
                      </span>
                    </div>
                  </td>
                  <td className="truncate px-5 py-3.5 text-muted-foreground">{u.email}</td>
                  <td className="truncate px-5 py-3.5">
                    {u.role === "superadmin" ? (
                          <span className={cn("inline-flex w-36 items-center justify-center rounded-full border px-5 py-2 text-[0.8125rem] font-semibold", getRoleVariant(u.role))}>
                        {getRoleLabel(u.role)}
                      </span>
                    ) : (
                      <Select
                        value={u.role}
                        onValueChange={async (val) => {
                          try {
                            await updateAdminRole(u.user_id, val as AdminUserRecord["role"]);
                            toast.success("Papel atualizado");
                            queryClient.invalidateQueries({ queryKey: ["admin_users"] });
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Erro ao alterar papel");
                          }
                        }}
                      >
                        <SelectTrigger
                          className={cn(
                            "inline-flex h-10 sm:h-9 w-36 items-center gap-1.5 rounded-full border bg-background px-5 text-[0.8125rem]",
                            getRoleVariant(u.role),
                            "hover:bg-muted/60 [&>svg]:h-3.5 [&>svg]:w-3.5",
                          )}
                        >
                          <SelectValue>{getRoleLabel(u.role)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border/70 text-[0.8125rem]">
                          {ADMIN_ROLES.filter((r) => r.value !== u.role).map((r) => (
                            <SelectItem key={r.value} value={r.value} className="rounded-lg">
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="truncate px-5 py-3.5">
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-red-500">
                        <XCircle className="h-3.5 w-3.5" />
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="truncate px-5 py-3.5 text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                    {u.role !== "superadmin" && (
                      <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 sm:h-9 w-10 sm:w-9 rounded-full text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(u)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <ConfirmActionDialog
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-10 w-10 sm:h-9 sm:w-9 rounded-full",
                              u.is_active
                                ? "text-destructive hover:bg-destructive/10"
                                : "text-emerald-600 hover:bg-emerald-50",
                            )}
                          >
                            {u.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          </Button>
                        }
                        title={u.is_active ? "Desativar usuário" : "Ativar usuário"}
                        description={
                          u.is_active
                            ? `O usuário "${u.display_name || u.email}" perderá acesso ao painel.`
                            : `O usuário "${u.display_name || u.email}" recuperará acesso ao painel.`
                        }
                        confirmLabel={u.is_active ? "Desativar" : "Ativar"}
                        processingLabel={u.is_active ? "Desativando..." : "Ativando..."}
                        destructive={u.is_active}
                        onConfirm={async () => {
                          try {
                            await toggleAdminActive(u.user_id, !u.is_active);
                            toast.success(u.is_active ? "Usuário desativado" : "Usuário ativado");
                            queryClient.invalidateQueries({ queryKey: ["admin_users"] });
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Erro ao alterar status");
                          }
                        }}
                      />
                      <ConfirmActionDialog
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 sm:h-9 sm:w-9 rounded-full text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                        title="Excluir usuário"
                        description={`Tem certeza que deseja excluir permanentemente o usuário "${u.display_name || u.email}"? Esta ação não pode ser desfeita.`}
                        confirmLabel="Excluir"
                        processingLabel="Apagando..."
                        destructive
                        onConfirm={async () => {
                          try {
                            await deleteAdminUser(u.user_id);
                            toast.success("Usuário excluído permanentemente");
                            queryClient.invalidateQueries({ queryKey: ["admin_users"] });
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Erro ao excluir usuário");
                          }
                        }}
                      />
                      </>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setNewEmail("");
            setNewPassword("");
            setNewPasswordConfirm("");
            setNewDisplayName("");
            setNewRole("admin");
            setShowPassword(false);
            setShowConfirmPassword(false);
          }
        }}
      >
        <DialogContent className={cn(MODAL_TELA_CHEIA, "max-h-[calc(100dvh-2rem)] max-w-[58rem] overflow-y-auto rounded-[1.35rem] border-border/70 sm:rounded-[1.75rem]")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
              <UserPlus className="h-5 w-5" />
              Novo usuário administrativo
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Nome de exibição
                </Label>
                <Input
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="João Silva"
                  className="h-11 rounded-2xl border-border/70 bg-background text-[0.8125rem]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  E-mail
                </Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="admin@exemplo.com"
                  required
                  className="h-11 rounded-2xl border-border/70 bg-background text-[0.8125rem]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Papel
                </Label>
                <Select value={newRole} onValueChange={(val) => setNewRole(val as AdminUserRecord["role"])}>
                  <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background text-[0.8125rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/70 text-[0.8125rem]">
                    {ADMIN_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="rounded-lg">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

              <div className="space-y-4">
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
                {newPassword.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
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
                        <span
                          key={c.label}
                          className={cn("text-[0.6875rem]", c.ok ? "text-emerald-600" : "text-muted-foreground/60")}
                        >
                          {c.ok ? "✓" : "○"} {c.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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

            <div className="md:col-span-2 border-t border-border/60 pt-4">
              <PermissionChecklist value={newPermissions} onChange={setNewPermissions} />
            </div>

            <DialogFooter className="md:col-span-2 gap-2 border-t border-border/70 pt-4 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  setNewEmail("");
                  setNewPassword("");
                  setNewPasswordConfirm("");
                  setNewDisplayName("");
                  setNewRole("admin");
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
                {creating ? "Criando..." : "Criar usuário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open);
        if (!open) {
          setEditingUser(null);
        }
      }}>
        <DialogContent className={cn(MODAL_TELA_CHEIA, "max-h-[calc(100dvh-2rem)] max-w-[42rem] overflow-y-auto rounded-[1.35rem] border-border/70 sm:rounded-[1.75rem]")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
              <Edit className="h-5 w-5" />
              Editar usuário — {editingUser?.email?.split("@")[0] || "..."}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Pedido do dono: o email pode trocar de dono, e a pessoa pode mudar
                de setor ou sair. Sem editar o nome, a lista envelhece e deixa de
                dizer quem e quem. O email fica de fora daqui — quem troca email
                e a propria pessoa, e mudar por aqui trocaria o login dela. */}
            <div className="space-y-2">
              <Label htmlFor="edit-display-name" className="text-[0.8125rem] font-medium">
                Nome exibido
              </Label>
              <Input
                id="edit-display-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder={editingUser?.email?.split("@")[0] ?? "Nome da pessoa"}
                maxLength={80}
                className="h-11 rounded-2xl border-border/70 bg-background"
              />
              <p className="text-[0.6875rem] text-muted-foreground">
                Vazio faz a lista voltar a mostrar o início do e-mail. O login não muda.
              </p>
            </div>

            <PermissionChecklist value={editPermissions} onChange={setEditPermissions} />
          </div>

          <DialogFooter className="gap-2 border-t border-border/70 pt-4 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditOpen(false);
                setEditingUser(null);
              }}
              className="h-11 rounded-2xl px-5 text-sm"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={savingPermissions}
              onClick={handleSavePermissions}
              className="h-11 rounded-2xl px-5 text-sm"
            >
              {savingPermissions ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
              {savingPermissions ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
