import { supabase } from "@/integrations/supabase/client";
import { CUSTOMER_PROFILES_TABLE, type CustomerProfile } from "@/lib/customerProfile";

export const CLINIC_MASTER_CNPJ = import.meta.env.VITE_CLINIC_MASTER_CNPJ || "04163851000106";

export type EmployeeUserRecord = CustomerProfile;

export type EmployeeUserCreatePayload = {
  name: string;
  phone: string;
  email: string;
  /**
   * @deprecated Ignorado pelo servidor desde 2026-08-08: a senha provisoria vem
   * de `clinic+b2b_config_seguranca`. Quem cria nao escolhe mais a senha.
   */
  password?: string;
  cpf: string;
};

export type EmployeeUserUpdatePayload = {
  userId: string;
  name: string;
  phone: string;
  email: string;
  cpf: string;
};

export async function listEmployees(): Promise<EmployeeUserRecord[]> {
  const { data, error } = await supabase
    .from(CUSTOMER_PROFILES_TABLE)
    .select("*")
    .not("linked_company_cnpj", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as EmployeeUserRecord[];
}

/**
 * Traduz o erro do banco para quem esta olhando a tela.
 *
 * O CPF e barrado pelo indice unico `customer_profiles_cnpj_unique`, e a mensagem
 * chega crua: "duplicate key value violates unique constraint...". Numa
 * importacao de 50 linhas isso apareceria repetido, sem dizer o que fazer. O
 * e-mail ja vinha tratado pela funcao; o CPF nao.
 */
function mensagemDeErroLegivel(erro: unknown): string {
  const texto = typeof erro === "string" && erro.trim() ? erro : "Erro ao criar funcionário";
  if (/customer_profiles_cnpj_unique|duplicate key.*cnpj/i.test(texto)) {
    return "Este CPF já está cadastrado para outro funcionário";
  }
  return texto;
}

export async function createEmployeeUser(payload: EmployeeUserCreatePayload): Promise<{ userId: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Não autenticado");

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee-user`;
  const res = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...payload,
      linkedCompanyCnpj: CLINIC_MASTER_CNPJ,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(mensagemDeErroLegivel(body.error));

  const userId = body?.user?.id;
  if (!userId) throw new Error("Resposta inválida ao criar funcionário");

  return { userId };
}

export async function updateEmployeeUser(payload: EmployeeUserUpdatePayload): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Não autenticado");

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-employee-user`;
  const res = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...payload,
      linkedCompanyCnpj: CLINIC_MASTER_CNPJ,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Erro ao atualizar funcionário");
}

export async function deleteEmployeeUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from(CUSTOMER_PROFILES_TABLE)
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
}
