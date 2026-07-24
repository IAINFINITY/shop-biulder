import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import { CUSTOMER_PRICE_OVERRIDES_TABLE, customerTypeLabel } from "@/lib/pricing";
import { toast } from "sonner";

export type CustomerTypeOption = {
  name: string;
  label: string;
};

const CUSTOMER_TYPES_TABLE = "customer_types";

function defaultTypes(): CustomerTypeOption[] {
  return [
    { name: "cliente", label: "Cliente" },
    { name: "lojista", label: "Lojista" },
    { name: "distribuidor", label: "Distribuidor" },
    { name: "funcionario", label: "Funcionário" },
  ];
}

export function useCustomerTypes() {
  const queryClient = useQueryClient();

  const savedQuery = useQuery({
    queryKey: ["customer-types-saved"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = await loadSupabaseClient();
      const { data, error } = await supabase
        .from(CUSTOMER_TYPES_TABLE)
        .select("name")
        .order("name", { ascending: true });

      if (error) {
        return defaultTypes();
      }

      const names = (data ?? []).map((row: { name: string }) => row.name.trim().toLowerCase()).filter(Boolean);
      if (names.length === 0) return defaultTypes();

      return names.map((name) => ({ name, label: customerTypeLabel(name) }));
    },
    initialData: defaultTypes,
  });

  const distinctQuery = useQuery({
    queryKey: ["customer-types-distinct"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = await loadSupabaseClient();
      const { data, error } = await supabase
        .from(CUSTOMER_PRICE_OVERRIDES_TABLE)
        .select("customer_type");

      if (error || !data) return [] as string[];

      const types = new Set<string>();
      for (const row of data) {
        const value = (row as { customer_type: string }).customer_type?.trim().toLowerCase();
        if (value) types.add(value);
      }
      return [...types].sort();
    },
  });

  const options = useMemo<CustomerTypeOption[]>(() => {
    const saved = savedQuery.data ?? [];
    const distinct = distinctQuery.data ?? [];
    const seen = new Set<string>();
    const result: CustomerTypeOption[] = [];

    for (const opt of [...saved, ...distinct.map((name) => ({ name, label: customerTypeLabel(name) }))]) {
      if (seen.has(opt.name)) continue;
      seen.add(opt.name);
      result.push(opt);
    }

    return result.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [savedQuery.data, distinctQuery.data]);

  const addCustomType = async (name: string) => {
    const normalized = name.trim().toLowerCase();
    if (!normalized || normalized.length < 2) return;

    try {
      const supabase = await loadSupabaseClient();
      const { error } = await supabase
        .from(CUSTOMER_TYPES_TABLE)
        .insert({ name: normalized });

      if (error) {
        if (error.code === "23505") {
          toast("Esse tipo já existe.");
        } else {
          toast.error("Não foi possível salvar o novo tipo.");
        }
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["customer-types-saved"] });
      toast.success(`Tipo "${normalized}" adicionado.`);
    } catch (err) {
      console.error("Erro ao salvar tipo de cliente", err);
      toast.error("Erro ao salvar novo tipo.");
    }
  };

  return { options, addCustomType, isLoading: savedQuery.isLoading };
}
