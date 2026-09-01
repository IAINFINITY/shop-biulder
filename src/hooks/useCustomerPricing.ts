import { useQuery } from "@tanstack/react-query";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import {
  CUSTOMER_PRICE_OVERRIDES_TABLE,
  EMPTY_PRICE_MAP,
  buildCustomerPriceMap,
  mergePriceLayers,
  normalizeCustomerType,
  tabelaDePrecoAplicavel,
  type CustomerPriceOverride,
} from "@/lib/pricing";

export function useCustomerPricing(customerType: string | null, proxisTprId: number | null) {
  const normalizedType = normalizeCustomerType(customerType);
  const normalizedTprId = typeof proxisTprId === "number" && Number.isFinite(proxisTprId) ? Math.trunc(proxisTprId) : null;

  return useQuery({
    queryKey: ["customer-pricing", normalizedType, normalizedTprId],
    enabled: Boolean(customerType) || normalizedTprId !== null,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = await loadSupabaseClient();

      // A tabela que o **tipo** aponta, quando aponta. É o que permite "todo
      // lojista paga pela 8729" sem atribuir conta a conta — ver
      // `tabelaDePrecoAplicavel`, que decide entre ela e a da conta.
      const { data: tipo } = await supabase
        .from("clinic+b2b_customer_types")
        .select("price_table_id")
        .eq("name", normalizedType)
        .maybeSingle();

      const tabelaDoTipo =
        typeof tipo?.price_table_id === "number" ? Math.trunc(tipo.price_table_id) : null;
      const tabela = tabelaDePrecoAplicavel(normalizedType, normalizedTprId, tabelaDoTipo);

      // Camada de baixo: a tabela geral do tipo de cliente — o preco cheio.
      const { data: gerais, error: erroGeral } = await supabase
        .from(CUSTOMER_PRICE_OVERRIDES_TABLE)
        .select("customer_type, proxis_tpr_id, product_code, price")
        .eq("customer_type", normalizedType)
        .is("proxis_tpr_id", null)
        .eq("active", true);

      if (erroGeral) throw erroGeral;
      const geral = buildCustomerPriceMap((gerais ?? []) as CustomerPriceOverride[]);

      // Só a geral quando não há tabela a aplicar — nem da conta, nem do tipo,
      // ou funcionário, cuja tabela **é** a geral.
      if (tabela === null) return geral;

      // Camada de cima: a tabela do cliente no Proxis, identificada pelo TPR.
      //
      // O `is("proxis_tpr_id", null)` na consulta de cima e o que mantem as duas
      // separadas. Antes a geral era buscada so por `customer_type`, e como as
      // tabelas 8728/8744/8745 tambem sao "cliente", as tres entravam no mesmo
      // mapa — o preco exibido virava o da ultima linha que o banco devolvesse.
      const { data: doCliente, error: erroCliente } = await supabase
        .from(CUSTOMER_PRICE_OVERRIDES_TABLE)
        .select("customer_type, proxis_tpr_id, product_code, price")
        .eq("proxis_tpr_id", tabela)
        .eq("active", true);

      if (erroCliente) throw erroCliente;

      return mergePriceLayers(geral, buildCustomerPriceMap((doCliente ?? []) as CustomerPriceOverride[]));
    },
    // `placeholderData` e nao `initialData`: `initialData` entra no cache com
    // data de agora, e com `staleTime` de 5 minutos a consulta nascia "fresca" e
    // o `queryFn` nao chegava a rodar. O mapa ficava vazio e todo mundo via o
    // preco de cadastro.
    //
    // A instancia e fixa de proposito — ver `EMPTY_PRICE_MAP`.
    placeholderData: EMPTY_PRICE_MAP as Map<string, number>,
  });
}
