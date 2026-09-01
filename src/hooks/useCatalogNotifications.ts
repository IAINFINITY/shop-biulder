import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CATALOG_NOTIFICATIONS_TABLE,
  normalizeCatalogNotificationFromSupabaseRow,
  type CatalogNotification,
} from "@/lib/catalogNotifications";

/**
 * Para quem esta lista é.
 *
 * ## ⚠️ Por que isto é obrigatório
 *
 * Era opcional, e o padrão era "sem filtro". A tabela tem **duas** policies de
 * SELECT, e policies do Postgres se somam com OU:
 *
 * - a pública, que exige `target_user_id = auth.uid()` ou aviso geral;
 * - a interna, `clinic_b2b_is_internal_staff()`, sem restrição de alvo.
 *
 * A interna existe para o painel administrar campanhas, e está certa. O efeito
 * colateral é que a mesma consulta, feita na área do cliente, devolvia para um
 * administrador os avisos **pessoais de todos os clientes** — "Minha conta"
 * aparecia com 5 em toda conta de admin, e os cinco eram "Seu pedido foi
 * concluído" de um cliente só.
 *
 * A tela do cliente estava protegida por acidente: funcionava porque quem
 * abria não era funcionário. Isso não é um filtro, é uma coincidência.
 *
 * Obrigatório porque um parâmetro opcional volta a ser esquecido. Aqui o
 * compilador pergunta "de quem é esta lista?" antes de deixar a chamada passar.
 */
export type AudienciaDoAviso =
  /**
   * Tela administrativa: **só campanhas**.
   *
   * Já se chamou `"painel"` e trazia tudo. O resultado é que "Campanhas e avisos
   * do catálogo" listava, com botão de Editar e de Excluir, os avisos automáticos
   * de pedido de um cliente — "Seu pedido foi concluído" ao lado das campanhas,
   * como se alguém os tivesse escrito.
   *
   * Aviso de pedido não é conteúdo: é registro de um fato, escrito por gatilho.
   * A migration `20260901190000` tirou do painel até o direito de lê-lo.
   */
  | { escopo: "campanhas" }
  /** Área do cliente: os avisos desta conta e os gerais. */
  | { escopo: "usuario"; userId: string | null | undefined };

type UseCatalogNotificationsOptions = {
  activeOnly?: boolean;
  audiencia: AudienciaDoAviso;
};

export function useCatalogNotifications(options: UseCatalogNotificationsOptions) {
  const activeOnly = options.activeOnly !== false;
  const doUsuario = options.audiencia.escopo === "usuario" ? options.audiencia.userId ?? null : null;
  const somenteCampanhas = options.audiencia.escopo === "campanhas";

  return useQuery({
    // ⚠️ O alvo entra na chave. Sem isso a lista do painel (todos os avisos) e a
    // do cliente (os dele) dividiriam o mesmo cache, e quem chegasse primeiro
    // decidiria o que o outro vê — o mesmo defeito que a tela de Preços teve com
    // duas consultas sob `["price-tables"]`.
    queryKey: ["catalog-notifications", activeOnly ? "active" : "all", doUsuario ?? "campanhas"],
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      let query = supabase
        .from(CATALOG_NOTIFICATIONS_TABLE)
        .select(
          "id,title,summary,body,image_url,cta_label,cta_url,target_user_id,active,priority,starts_at,ends_at,created_at,updated_at,tipo",
        )
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (activeOnly) {
        query = query.eq("active", true);
      }

      if (doUsuario) {
        // `or` do PostgREST: o aviso é desta pessoa, ou é geral (sem alvo).
        query = query.or(`target_user_id.eq.${doUsuario},target_user_id.is.null`);
      }

      if (somenteCampanhas) {
        // Redundante com a RLS de propósito: a policy interna já recusa o que
        // não é campanha. Mas quem lê esta função não vê a policy, e uma tela
        // que pede "tudo" e recebe "campanhas" parece um bug até alguém abrir o
        // banco. O filtro escrito diz a intenção no lugar onde ela é lida.
        query = query.eq("tipo", "campanha");
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []).map((row) => normalizeCatalogNotificationFromSupabaseRow(row)) as CatalogNotification[];
    },
  // Sem `initialData`: o react-query o trata como recem-chegado do servidor, e
  // com `staleTime` acima de zero um array vazio ficaria "fresco" ate expirar —
  // a consulta nunca dispararia e a tela mostraria a lista vazia esse tempo todo.
  // Quem chama ja destrutura com `= []`, entao nao falta valor de partida.
  });
}
