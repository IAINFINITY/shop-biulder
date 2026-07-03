import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CUSTOMER_ADDRESSES_TABLE,
  customerAddressFromRow,
  customerAddressRowFromForm,
  type CustomerAddress,
  type CustomerAddressFormData,
} from "@/lib/customerAddresses";

export function useCustomerAddresses(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["customer-addresses", userId],
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(CUSTOMER_ADDRESSES_TABLE)
        .select("id,user_id,label,is_default,cep,street,number,complement,neighborhood,city,state,ibge,created_at,updated_at")
        .eq("user_id", userId as string)
        .order("is_default", { ascending: false })
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((row) => customerAddressFromRow(row)) as CustomerAddress[];
    },
    initialData: [] as CustomerAddress[],
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["customer-addresses", userId] });
  };

  const saveAddress = async (form: CustomerAddressFormData, addressId?: string) => {
    if (!userId) return { error: new Error("UsuÃ¡rio nÃ£o autenticado"), data: null as CustomerAddress | null };
    const payload = { ...customerAddressRowFromForm(userId, form), is_default: false };
    const mutation = addressId
      ? supabase.from(CUSTOMER_ADDRESSES_TABLE).update(payload).eq("id", addressId).select().single()
      : supabase.from(CUSTOMER_ADDRESSES_TABLE).insert(payload).select().single();
    const { data, error } = await mutation;
    await refresh();
    return { error, data: data ? customerAddressFromRow(data) : null };
  };

  const deleteAddress = async (addressId: string) => {
    const { error } = await supabase.from(CUSTOMER_ADDRESSES_TABLE).delete().eq("id", addressId);
    await refresh();
    return { error };
  };

  const setDefaultAddress = async (addressId: string) => {
    if (!userId) return { error: new Error("UsuÃ¡rio nÃ£o autenticado") };
    const { error } = await supabase.rpc("set_customer_default_address", {
      p_user_id: userId,
      p_address_id: addressId,
    });
    await refresh();
    return { error };
  };

  return {
    ...query,
    refresh,
    saveAddress,
    deleteAddress,
    setDefaultAddress,
  };
}

