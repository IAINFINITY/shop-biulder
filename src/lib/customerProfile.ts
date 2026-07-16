import { supabase } from "@/integrations/supabase/client";
import type { AddressFormData } from "@/lib/address";

export const CUSTOMER_PROFILES_TABLE = "customer_profiles";

export interface CustomerProfile {
  user_id: string;
  name: string;
  phone: string;
  company: string;
  cnpj: string;
  email: string | null;
  observation: string | null;
  customer_type: string;
  representante_id: string | null;
  proxis_pes_id: number | null;
  proxis_tpr_id: number | null;
  proxis_found: boolean | null;
  proxis_synced_at: string | null;
  linked_company_cnpj: string | null;
  address_cep: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_ibge: string;
  created_at: string;
  updated_at: string;
}

export type CustomerFormCore = {
  name: string;
  phone: string;
  company: string;
  cnpj: string;
  customer_type?: string;
};

export interface CustomerRegistrationData extends CustomerFormCore {
  email: string;
  password: string;
}

export type DeleteCustomerRecordPayload = {
  userId?: string | null;
  cnpj?: string | null;
  name?: string | null;
};

export function profileAddressToForm(profile: CustomerProfile): AddressFormData {
  return {
    cep: profile.address_cep,
    street: profile.address_street,
    number: profile.address_number,
    complement: profile.address_complement,
    neighborhood: profile.address_neighborhood,
    city: profile.address_city,
    state: profile.address_state,
    ibge: profile.address_ibge,
  };
}

export async function deleteCustomerRecord(payload: DeleteCustomerRecordPayload): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Nao autenticado");

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-customer-user`;
  const res = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Erro ao excluir cliente");
}

export async function deleteCustomerUser(userId: string): Promise<void> {
  return deleteCustomerRecord({ userId });
}

export function addressFormToProfileColumns(address: AddressFormData) {
  return {
    p_address_cep: address.cep,
    p_address_street: address.street,
    p_address_number: address.number,
    p_address_complement: address.complement,
    p_address_neighborhood: address.neighborhood,
    p_address_city: address.city,
    p_address_state: address.state,
    p_address_ibge: address.ibge,
  };
}
