import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CUSTOMER_ADDRESSES_TABLE } from "@/lib/customerAddresses";
import { CUSTOMER_PROFILES_TABLE } from "@/lib/customerProfile";
import { ORDERS_TABLE } from "@/lib/orders";
import { SUPPORT_CONVERSATIONS_TABLE } from "@/lib/supportChat";
import { montarPacoteDeDados, type PacoteDeDados } from "@/lib/meusDados";

const FAVORITOS_TABLE = "clinic+b2b_customer_favorites";
const DISPOSITIVOS_TABLE = "clinic+b2b_dispositivos_confiaveis";

/**
 * Busca tudo o que o sistema guarda sobre quem está logado.
 *
 * ## Quem garante o recorte
 *
 * A RLS, não o `where` daqui. Cada consulta pede a tabela inteira e o banco
 * devolve só as linhas da pessoa — é a mesma regra que protege a API quando
 * alguém a chama por fora, então o recorte não depende deste arquivo estar
 * certo.
 *
 * A exceção é a avaliação, que passa por `clinic_b2b_minhas_avaliacoes`. A
 * coluna `user_id` foi fechada para `authenticated` em `20260819120000`, e no
 * Postgres usar uma coluna no `where` exige privilégio de leitura sobre ela —
 * então filtrar por `user_id` deixou de ser possível, inclusive para o próprio
 * dono. A RPC lê com o privilégio do dono e devolve só o que é de quem chamou.
 *
 * ## O que fica de fora
 *
 * A trilha de acesso (`auth_events`): ela é fechada por RLS sem policy nenhuma,
 * legível apenas pelo service role. Entregá-la exigiria uma rota no servidor, e
 * ela não descreve a pessoa — registra evento de segurança, sem dado pessoal
 * além do identificador interno.
 */
export function useMeusDados(userId: string | null, email: string | null, habilitado = true) {
  return useQuery<PacoteDeDados>({
    queryKey: ["meus-dados", userId],
    enabled: habilitado && Boolean(userId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [perfil, enderecos, pedidos, avaliacoes, favoritos, conversas, aparelhos] = await Promise.all([
        supabase.from(CUSTOMER_PROFILES_TABLE).select("*").eq("user_id", userId!).maybeSingle(),
        supabase.from(CUSTOMER_ADDRESSES_TABLE).select("*"),
        supabase.from(ORDERS_TABLE).select("*").order("created_at", { ascending: false }),
        supabase.rpc("clinic_b2b_minhas_avaliacoes" as never),
        supabase.from(FAVORITOS_TABLE).select("*"),
        supabase.from(SUPPORT_CONVERSATIONS_TABLE).select("*"),
        supabase.from(DISPOSITIVOS_TABLE).select("id,rotulo,criado_em,expira_em,ultimo_uso_em,revogado_em"),
      ]);

      // Uma consulta que falha não pode devolver um pacote incompleto sem aviso:
      // a pessoa acharia que aquilo é tudo o que existe sobre ela.
      const falhou = [perfil, enderecos, pedidos, avaliacoes, favoritos, conversas, aparelhos].find((r) => r.error);
      if (falhou?.error) throw falhou.error;

      return montarPacoteDeDados(
        { id: userId!, email },
        {
          perfil: perfil.data ?? null,
          enderecos: enderecos.data ?? [],
          pedidos: pedidos.data ?? [],
          avaliacoes: (avaliacoes.data as unknown[]) ?? [],
          favoritos: favoritos.data ?? [],
          conversas: conversas.data ?? [],
          aparelhos: aparelhos.data ?? [],
        },
      );
    },
  });
}
