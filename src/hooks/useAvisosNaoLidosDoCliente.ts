import { useMemo } from "react";

import { useCatalogNotifications } from "@/hooks/useCatalogNotifications";
import { useCatalogNotificationReads } from "@/hooks/useCatalogNotificationReads";

/**
 * Quantos avisos o cliente ainda não abriu.
 *
 * ## Por que existe
 *
 * O aviso chegava e ficava esperando o cliente resolver entrar na conta e clicar
 * em Notificações — três cliques depois de um sinal que ninguém dá. Um pedido
 * que muda de estado, um atendimento que a equipe abre: tudo isso vira uma
 * notificação que só existe para quem já foi procurá-la.
 *
 * Agora o número aparece no "Minha conta" do catálogo, que é onde o cliente
 * passa.
 *
 * ## ⚠️ A contagem sai daqui, e não de uma segunda cópia da regra
 *
 * A tela da conta já calculava isto no meio do componente. Repetir a conta no
 * cabeçalho daria dois números para a mesma pergunta — e o dia em que a regra
 * mudasse (um filtro por data, por exemplo), um dos dois ficaria para trás. O
 * `react-query` junta as duas chamadas pela mesma chave, então não custa
 * consulta a mais.
 */
export function useAvisosNaoLidosDoCliente(userId: string | null | undefined): number {
  const { data: avisos = [] } = useCatalogNotifications();
  const { data: leituras = [] } = useCatalogNotificationReads(userId ?? null);

  return useMemo(() => {
    if (!userId) return 0;
    const lidos = new Set(leituras.map((leitura) => leitura.notification_id));
    return avisos.filter((aviso) => !lidos.has(aviso.id)).length;
  }, [avisos, leituras, userId]);
}
