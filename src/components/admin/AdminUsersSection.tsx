import { useEffect, useMemo, useState } from "react";
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
  ShieldCheck,
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SectionHeader } from "@/components/shared/SectionHeader";

/**
 * Uma aba de papel, com o número de contas dentro.
 *
 * ⚠️ **Zero aparece aqui**, ao contrário das abas da caixa de mensagens. Lá o
 * zero era ruído porque as abas eram estados que iam e vinham; aqui elas são a
 * lista de papéis que existem no sistema, e "Representante: 0" é resposta —
 * significa que ninguém ocupa aquele papel, que é diferente de o papel não
 * existir.
 */
function AbaDePapel({
  ativo,
  onClick,
  total,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={ativo ? "default" : "outline"}
      className="h-10 sm:h-9 rounded-full px-3 text-[0.8125rem]"
      onClick={onClick}
    >
      {children}
      <span
        className={cn(
          "ml-1.5 rounded-full px-1.5 py-px text-[0.6875rem] font-semibold tabular-nums",
          ativo ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
        )}
      >
        {total}
      </span>
    </Button>
  );
}

/** Frases dos diálogos, fora do JSX para não divergirem entre a tabela e o cartão. */
const DESCRICAO_STATUS = (nome: string, ativo: boolean) =>
  ativo
    ? `O usuário "${nome}" perderá acesso ao painel.`
    : `O usuário "${nome}" recuperará acesso ao painel.`;

const DESCRICAO_EXCLUSAO = (nome: string) =>
  `Tem certeza que deseja excluir permanentemente o usuário "${nome}"? Esta ação não pode ser desfeita.`;

import { AdminTabelaDePessoas, CelulaDePessoa } from "@/components/admin/AdminTabelaDePessoas";
import { AdminPaginacao } from "@/components/admin/AdminPaginacao";
import { paginar } from "@/lib/paginacao";
import { AdminListaPadrao } from "./AdminListaPadrao";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { useAuth } from "@/hooks/useAuth";
import {
  ADMIN_ROLES,
  SUPERADMIN_PROMOTION_OPTION,
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

  // Promover a superadmin e a unica mudanca de papel com um confirm dialog no
  // meio: as outras trocas (admin -> consultor, etc.) continuam disparando
  // direto do Select, porque sao reversiveis por qualquer superadmin a qualquer
  // momento. Esta nao e — uma vez promovido, a linha vira badge fixo e some o
  // Select, igual ja acontecia com o superadmin original. Um clique errado
  // aqui nao se desfaz sozinho.
  const [promotionTarget, setPromotionTarget] = useState<AdminUserRecord | null>(null);
  const [promoting, setPromoting] = useState(false);

  async function handleRoleChange(target: AdminUserRecord, nextRole: string) {
    if (nextRole === "superadmin") {
      setPromotionTarget(target);
      return;
    }
    try {
      await updateAdminRole(target.user_id, nextRole as AdminUserRecord["role"]);
      toast.success("Papel atualizado");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar papel");
    }
  }

  async function confirmPromotion() {
    if (!promotionTarget) return;
    setPromoting(true);
    try {
      await updateAdminRole(promotionTarget.user_id, "superadmin");
      toast.success(`${promotionTarget.display_name || promotionTarget.email} agora é superadmin`);
      setPromotionTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao promover a superadmin");
    } finally {
      setPromoting(false);
    }
  }

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

  // 11 administradores hoje, mas a lista nasce sem teto: pagina como as outras
  // duas seções, para o padrão valer também no comportamento.
  const [paginaAtual, setPaginaAtual] = useState(0);
  useEffect(() => {
    setPaginaAtual(0);
  }, [search, roleFilter]);
  const pagina = useMemo(() => paginar(filteredUsers, paginaAtual), [filteredUsers, paginaAtual]);

  /**
   * O mesmo registro desenhado para tela estreita.
   *
   * Sai daqui, e nao de um bloco `lg:hidden` paralelo a tabela: com dois
   * blocos irmaos, mexer numa coluna e esquecer o cartao era so questao de
   * tempo — e o esquecimento so aparece para quem abre no celular.
   */
  const cartaoDeAdmin = (u: AdminUserRecord) => (
    <>
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
                      onValueChange={(val) => void handleRoleChange(u, val)}
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
                        {/* Separada visualmente: nao e "mais um papel", e uma
                            promocao — escolher aqui abre confirmacao, nao
                            troca na hora como as opcoes acima. */}
                        <SelectItem
                          value={SUPERADMIN_PROMOTION_OPTION.value}
                          className="mt-1 rounded-lg border-t border-border/60 pt-2 text-destructive"
                        >
                          {SUPERADMIN_PROMOTION_OPTION.label}
                        </SelectItem>
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
    </>
  );

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
      <SectionHeader
        eyebrow="Administradores"
        title="Contas e permissões"
        description="Gerencie contas com acesso ao painel administrativo"
        actions={
          <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1 text-[0.6875rem] font-medium">
            {filteredUsers.length} conta(s)
          </Badge>
        }
      />

      <AdminListaPadrao
        busca={search}
        onBuscaChange={setSearch}
        buscaPlaceholder="Buscar por e-mail, nome ou papel"
        contagem={filteredUsers.length}
        acaoPrincipal={
          <Button type="button" onClick={() => setCreateOpen(true)} className="h-11 rounded-2xl px-4 text-sm">
            <UserPlus className="h-4 w-4" />
            Novo usuário
          </Button>
        }
        abas={
          <>

          {/* ⚠️ A contagem vive **na aba**, e não numa legenda no rodapé.

              Ela ficava embaixo da lista, numa fileira de selos ("admin 7,
              consultor 2, representante 0..."), separada dos botões que
              filtram exatamente por aqueles mesmos papéis. Eram dois lugares
              para uma informação só, e o de baixo obrigava a rolar a lista
              inteira para saber quantos havia de cada.

              Junto, cada aba responde "quantos tem aqui?" antes do clique — que
              é o padrão que Clientes já usava. */}
          <AbaDePapel ativo={roleFilter === null} onClick={() => setRoleFilter(null)} total={users.length}>
            Todos
          </AbaDePapel>
          {ADMIN_ROLES.map((r) => (
            <AbaDePapel
              key={r.value}
              ativo={roleFilter === r.value}
              onClick={() => setRoleFilter(roleFilter === r.value ? null : r.value)}
              total={roleCounts[r.value] ?? 0}
            >
              {r.label}
            </AbaDePapel>
          ))}
          <AbaDePapel
            ativo={roleFilter === "superadmin"}
            onClick={() => setRoleFilter(roleFilter === "superadmin" ? null : "superadmin")}
            total={roleCounts["superadmin"] ?? 0}
          >
            Superadmin
          </AbaDePapel>
          </>
        }
        rodape={<AdminPaginacao pagina={pagina} onMudarPagina={setPaginaAtual} />}
      >
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

          <AdminTabelaDePessoas
            itens={pagina.itens}
            chaveDoItem={(u) => `${u.user_id}-${u.role}`}
            vazio="Nenhum administrador encontrado."
            colunas={[
              {
                chave: "nome",
                rotulo: "Administrador",
                largura: "30%",
                celula: (u) => (
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-xs font-semibold text-primary">
                      {(u.display_name || u.email).slice(0, 1).toUpperCase()}
                    </span>
                    <CelulaDePessoa nome={u.display_name || u.email.split("@")[0]} detalhe={u.email} />
                  </div>
                ),
              },
              {
                chave: "papel",
                rotulo: "Papel",
                largura: "22%",
                celula: (u) =>
                  u.role === "superadmin" ? (
                    <span
                      className={cn(
                        "inline-flex w-32 items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold",
                        getRoleVariant(u.role),
                      )}
                    >
                      {getRoleLabel(u.role)}
                    </span>
                  ) : (
                    <Select value={u.role} onValueChange={(val) => void handleRoleChange(u, val)}>
                      <SelectTrigger
                        className={cn(
                          "inline-flex h-8 w-32 items-center gap-1.5 rounded-full border bg-background px-3 text-xs",
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
                        {/* Separada visualmente: nao e "mais um papel", e uma
                            promocao — escolher aqui abre confirmacao, nao
                            troca na hora como as opcoes acima. */}
                        <SelectItem
                          value={SUPERADMIN_PROMOTION_OPTION.value}
                          className="mt-1 rounded-lg border-t border-border/60 pt-2 text-destructive"
                        >
                          {SUPERADMIN_PROMOTION_OPTION.label}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ),
              },
              {
                chave: "status",
                rotulo: "Status",
                largura: "14%",
                celula: (u) =>
                  u.is_active ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Ativo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
                      <XCircle className="h-3.5 w-3.5" />
                      Inativo
                    </span>
                  ),
              },
              {
                chave: "criado",
                rotulo: "Criado em",
                largura: "14%",
                alinhamento: "direita",
                ocultarAte: "xl",
                celula: (u) => (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </span>
                ),
              },
            ]}
            larguraDasAcoes="20%"
            acoes={(u) =>
              u.role === "superadmin" ? null : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                    title="Editar permissões"
                    onClick={() => openEdit(u)}
                  >
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Editar</span>
                  </Button>
                  <ConfirmActionDialog
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title={u.is_active ? "Desativar" : "Ativar"}
                        className={cn(
                          "h-8 w-8 rounded-full",
                          u.is_active
                            ? "text-destructive hover:bg-destructive/10"
                            : "text-success hover:bg-success/10",
                        )}
                      >
                        {u.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </Button>
                    }
                    title={u.is_active ? "Desativar usuário" : "Ativar usuário"}
                    description={DESCRICAO_STATUS(u.display_name || u.email, u.is_active)}
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
                        title="Excluir administrador"
                        className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                    title="Excluir usuário"
                    description={DESCRICAO_EXCLUSAO(u.display_name || u.email)}
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
              )
            }
            cartaoNoCelular={cartaoDeAdmin}
          />
        </>
      )}
      </AdminListaPadrao>

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

      <AlertDialog
        open={Boolean(promotionTarget)}
        onOpenChange={(open) => {
          if (!open && !promoting) setPromotionTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-[28rem] rounded-[1.5rem] border-border/70">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
              <ShieldCheck className="h-5 w-5 text-destructive" />
              Tornar {promotionTarget?.display_name || promotionTarget?.email} superadmin?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-[0.8125rem] leading-6 text-muted-foreground">
              Superadmin tem acesso total: todas as seções do painel, inclusive esta — a de
              gerenciar outros usuários. As permissões marcadas para essa pessoa deixam de valer,
              porque superadmin nunca é restringido por elas.
              <br />
              <br />
              Depois de promovida, esta tela não oferece mais um caminho para tirar o papel — como
              já acontecia com o superadmin original. Reverter exige acesso direto ao banco.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              className="mt-0 rounded-2xl px-4 text-sm"
              disabled={promoting}
              onClick={() => setPromotionTarget(null)}
            >
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={promoting}
              onClick={() => void confirmPromotion()}
              className="mt-0 rounded-2xl bg-destructive px-4 text-sm text-destructive-foreground hover:bg-destructive/90"
            >
              {promoting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {promoting ? "Promovendo..." : "Tornar superadmin"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
