import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import { CUSTOMER_PRICE_OVERRIDES_TABLE, customerTypeLabel } from "@/lib/pricing";
import { toast } from "sonner";

export type CustomerTypeOption = {
  name: string;
  label: string;
  /**
   * De onde vêm os preços deste tipo. `null` = preços próprios.
   *
   * Opcional porque um tipo pode chegar por `distinctQuery` — descoberto a
   * partir dos perfis, sem linha em `customer_types` — e nesse caso não há o que
   * apontar. Ver `tabelaDePrecoAplicavel`.
   */
  priceTableId?: number | null;
};

const CUSTOMER_TYPES_TABLE = "clinic+b2b_customer_types";

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
        .select("name, price_table_id")
        .order("name", { ascending: true });

      if (error) {
        return defaultTypes();
      }

      const linhas = (data ?? [])
        .map((row: { name: string; price_table_id: number | null }) => ({
          name: row.name.trim().toLowerCase(),
          // De onde vêm os preços deste tipo: `null` = próprios. Ver
          // `tabelaDePrecoAplicavel`.
          priceTableId: typeof row.price_table_id === "number" ? row.price_table_id : null,
        }))
        .filter((linha) => Boolean(linha.name));

      if (linhas.length === 0) return defaultTypes();

      return linhas.map((linha) => ({ ...linha, label: customerTypeLabel(linha.name) }));
    },
    // `placeholderData`, e nao `initialData`.
    //
    // `initialData` entra no cache como se tivesse acabado de chegar do servidor:
    // com `staleTime` de 5 minutos a consulta podia nunca disparar, e a lista de
    // tipos ficava valendo os quatro padroes a sessao inteira. Essa lista
    // alimenta o `podeVer`, entao a visibilidade dos produtos oscilava junto —
    // era o que fazia sumirem familias inteiras da arvore de filtros para quem
    // nao e admin.
    //
    // `placeholderData` pinta o mesmo enquanto carrega, mas nao mente para o
    // cache: a consulta roda e o banco continua sendo a fonte.
    placeholderData: defaultTypes,
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

  /**
   * Apaga um tipo de conta.
   *
   * ⚠️ **Recusa se houver conta usando.** Apagar o tipo de 44 clientes os
   * deixaria com um `customer_type` que não existe em lugar nenhum: eles
   * sumiriam das abas de Clientes, e a tabela de preço do tipo deixaria de
   * casar — sem erro, só com o preço errado. A checagem é aqui, e não uma
   * `foreign key`, porque `customer_type` é texto livre no perfil e nunca teve
   * essa amarra.
   */
  const removeCustomType = async (name: string) => {
    const normalizado = name.trim().toLowerCase();
    if (!normalizado) return false;

    try {
      const supabase = await loadSupabaseClient();

      const { count, error: erroDeContagem } = await supabase
        .from("clinic+b2b_customer_profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("customer_type", normalizado);

      if (erroDeContagem) {
        toast.error("Não foi possível conferir se há contas nesse tipo.");
        return false;
      }

      if ((count ?? 0) > 0) {
        toast.error(`Não dá para apagar: ${count} conta(s) usam "${normalizado}".`, {
          description: "Mude o tipo dessas contas primeiro, em Clientes.",
        });
        return false;
      }

      const { error } = await supabase.from(CUSTOMER_TYPES_TABLE).delete().eq("name", normalizado);
      if (error) {
        toast.error("Não foi possível apagar o tipo.");
        return false;
      }

      await queryClient.invalidateQueries({ queryKey: ["customer-types-saved"] });
      toast.success(`Tipo "${normalizado}" apagado.`);
      return true;
    } catch (err) {
      console.error("Erro ao apagar tipo de cliente", err);
      toast.error("Erro ao apagar o tipo.");
      return false;
    }
  };

  return { options, addCustomType, removeCustomType, isLoading: savedQuery.isLoading };
}
