import { supabase } from "@/integrations/supabase/client";
import type { AddressFormData } from "@/lib/address";

export const CUSTOMER_PROFILES_TABLE = "clinic+b2b_customer_profiles";

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
  /**
   * Senha provisoria ainda nao trocada.
   *
   * Marcado no servidor quando o painel cria o funcionario; limpo quando a pessoa
   * define a senha dela. Enquanto for `true`, o site nao deixa fazer mais nada.
   */
  deve_trocar_senha?: boolean;
  /** Optante pelo MEI, conforme a Receita. `null`/ausente = ainda nao consultado. */
  is_mei?: boolean | null;
  /**
   * Recebe notificacao de campanha.
   *
   * So vale para campanha — a notificacao sem destinatario, que vai para todo
   * mundo. Aviso endereçado a pessoa continua chegando mesmo com isto desligado,
   * porque recusar propaganda nao e recusar aviso sobre o proprio pedido.
   *
   * Ausente conta como `true`: a base legal e legitimo interesse, entao o
   * tratamento comeca licito e a pessoa interrompe se quiser.
   */
  aceita_campanhas?: boolean;
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
  if (!token) throw new Error("Não autenticado");

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

export function addressFormToProfileColumns(address: AddressFormData) {
  return {
    address_cep: address.cep,
    address_street: address.street,
    address_number: address.number,
    address_complement: address.complement,
    address_neighborhood: address.neighborhood,
    address_city: address.city,
    address_state: address.state,
    address_ibge: address.ibge,
  };
}

export async function saveCustomerProfileAddress(userId: string, address: AddressFormData): Promise<void> {
  const { error } = await supabase
    .from(CUSTOMER_PROFILES_TABLE)
    .update(addressFormToProfileColumns(address) as never)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message || "Erro ao salvar endereço no perfil");
  }
}

/**
 * Liga ou desliga o recebimento de campanhas.
 *
 * Passa por RPC, e não por `update` na tabela, porque não existe policy de
 * escrita do dono sobre o próprio perfil — e abrir uma liberaria a linha
 * inteira quando só uma coluna pode mudar.
 */
export async function definirAceiteDeCampanhas(aceita: boolean): Promise<void> {
  const { error } = await supabase.rpc("clinic_b2b_definir_aceite_campanhas" as never, {
    p_aceita: aceita,
  } as never);

  if (error) {
    throw new Error(error.message || "Erro ao salvar a preferência de campanhas");
  }
}

/**
 * Marca (ou desmarca) o perfil como optante pelo MEI.
 *
 * Escrito a partir do que a Receita respondeu, nunca de dedução pelo nome — ver
 * `empresarioIndividual.ts` para por que o nome não serve.
 */
export async function salvarMeiDoPerfil(userId: string, ehMei: boolean): Promise<void> {
  const { error } = await supabase
    .from(CUSTOMER_PROFILES_TABLE)
    .update({ is_mei: ehMei } as never)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message || "Erro ao gravar o enquadramento MEI");
  }
}

/**
 * Registra que um membro interno abriu o cadastro de um cliente.
 *
 * A trilha existe porque a RLS deixa todo admin ler o perfil de qualquer
 * cliente — o que é correto para o trabalho — mas não havia registro disso. Sem
 * ele, "quem viu os dados deste cliente" não tinha resposta, e o art. 48 exige
 * dimensionar o alcance de um incidente.
 *
 * Falha em silêncio de propósito: a trilha não pode impedir o atendimento. Se o
 * registro não gravar, o admin ainda precisa abrir a ficha e resolver o problema
 * do cliente que está esperando.
 */
export async function registrarAcessoAdminAoCadastro(
  alvoUserId: string | null,
  alvoCnpj: string | null,
  acao = "abrir-cadastro",
): Promise<void> {
  try {
    await supabase.rpc("clinic_b2b_registrar_acesso_admin" as never, {
      p_alvo_user_id: alvoUserId,
      p_alvo_cnpj: alvoCnpj,
      p_acao: acao,
    } as never);
  } catch {
    // Ver o comentário acima: silêncio é deliberado.
  }
}
