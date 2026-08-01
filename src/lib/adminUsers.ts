import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { AdminSection } from "@/components/admin/adminTypes";

export type AdminPermissions = Record<AdminSection, boolean>;

export type AdminUserRecord = {
  user_id: string;
  email: string;
  display_name: string;
  role: "superadmin" | "admin" | "consultor" | "representante" | "admin_atendimento";
  is_active: boolean;
  created_at: string;
  permissions: AdminPermissions | null;
};

export type AdminUserCreatePayload = {
  email: string;
  password: string;
  displayName: string;
  role: AdminUserRecord["role"];
  permissions?: AdminPermissions | null;
};

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  consultor: "Consultor",
  representante: "Representante",
  admin_atendimento: "Atendimento",
};

const ROLE_VARIANTS: Record<string, string> = {
  superadmin: "bg-destructive/10 text-destructive border-destructive/20",
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  consultor: "bg-destructive/10 text-destructive border-destructive/20",
  representante: "bg-destructive/10 text-destructive border-destructive/20",
  admin_atendimento: "bg-destructive/10 text-destructive border-destructive/20",
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function getRoleVariant(role: string): string {
  return ROLE_VARIANTS[role] ?? "bg-gray-100 text-gray-800 border-gray-200";
}

export const ADMIN_ROLES: { value: AdminUserRecord["role"]; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "consultor", label: "Consultor" },
  { value: "representante", label: "Representante" },
  { value: "admin_atendimento", label: "Atendimento" },
];

export async function listAdminUsers(): Promise<AdminUserRecord[]> {
  const { data, error } = await supabase.rpc("list_admin_users");
  if (error) throw error;
  return (data ?? []) as AdminUserRecord[];
}

export async function createAdminUser(payload: AdminUserCreatePayload): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Não autenticado");

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin-user`;
  const res = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Erro ao criar usuário");
}

export async function updateAdminPermissions(userId: string, permissions: AdminPermissions): Promise<void> {
  const { error } = await supabase.rpc("update_admin_permissions", {
    p_user_id: userId,
    // `AdminPermissions` e `Record<AdminSection, boolean>`, que e Json valido.
    // O cast anterior era para `Record<string, unknown>`, que o tipo `Json` recusa.
    p_permissions: permissions as unknown as Json,
  });
  if (error) throw error;
}

/**
 * Renomeia o usuario no painel.
 *
 * Pedido do dono do site: o email pode trocar de dono, e a pessoa pode mudar de
 * setor ou sair da empresa. Sem poder editar o nome, a lista envelhece e deixa
 * de dizer quem e quem — e o email deixa de ser um identificador confiavel.
 */
export async function updateAdminDisplayName(userId: string, displayName: string): Promise<void> {
  const { error } = await supabase.rpc("update_admin_display_name", {
    p_user_id: userId,
    p_display_name: displayName,
  });
  if (error) throw error;
}

/** O papel sai de `ADMIN_ROLES`, entao o tipo e fechado — `string` deixava passar qualquer coisa. */
export async function updateAdminRole(userId: string, role: AdminUserRecord["role"]): Promise<void> {
  const { error } = await supabase.rpc("update_admin_role", {
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
}

export async function toggleAdminActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.rpc("toggle_admin_active", {
    p_user_id: userId,
    p_active: isActive,
  });
  if (error) throw error;
}

export async function deleteAdminUser(userId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Não autenticado");

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-admin-user`;
  const res = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Erro ao excluir usuário");
}

export function canManageRole(currentRole: string, targetRole: string): boolean {
  if (currentRole !== "superadmin") return false;
  if (targetRole === "superadmin") return false;
  return true;
}
