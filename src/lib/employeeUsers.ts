import { supabase } from "@/integrations/supabase/client";
import { CUSTOMER_PROFILES_TABLE, type CustomerProfile } from "@/lib/customerProfile";

export const CLINIC_MASTER_CNPJ = import.meta.env.VITE_CLINIC_MASTER_CNPJ || "04163851000106";

export type EmployeeUserRecord = CustomerProfile;

export type EmployeeUserCreatePayload = {
  name: string;
  phone: string;
  email: string;
  password: string;
  cpf: string;
};

export async function listEmployees(): Promise<EmployeeUserRecord[]> {
  const { data, error } = await supabase
    .from(CUSTOMER_PROFILES_TABLE)
    .select("*")
    .eq("customer_type", "funcionario")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as EmployeeUserRecord[];
}

export async function createEmployeeUser(payload: EmployeeUserCreatePayload): Promise<{ userId: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Nao autenticado");

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
  if (!res.ok) throw new Error(body.error ?? "Erro ao criar funcionario");

  const userId = body?.user?.id;
  if (!userId) throw new Error("Resposta invalida ao criar funcionario");

  return { userId };
}

export async function deleteEmployeeUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from(CUSTOMER_PROFILES_TABLE)
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
}
