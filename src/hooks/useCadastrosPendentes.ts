import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/apiFetch";
import type { CadastroPendente } from "@/lib/cadastrosPendentes";

/**
 * Quem se cadastrou e travou na confirmação de e-mail.
 *
 * ## Por que é um hook, e não uma consulta dentro da seção
 *
 * Duas telas precisam do mesmo número: a aba "Aguardando confirmação" da lista
 * de Clientes precisa dele para o **rótulo**, e a própria seção precisa da
 * **lista**. Repetir a consulta nos dois lugares daria duas contagens que podem
 * discordar por meio segundo — e um número que não bate com a lista logo abaixo
 * se lê como defeito, não como número. Com a mesma chave, o react-query junta
 * as duas chamadas numa só.
 *
 * ⚠️ Mora em `hooks/` e não junto do componente porque exportar um hook de um
 * arquivo de componente quebra o fast refresh do Vite — o arquivo inteiro
 * recarrega a cada edição em vez de trocar só o componente.
 */
export function useCadastrosPendentes() {
  return useQuery({
    queryKey: ["cadastros-pendentes"],
    staleTime: 60_000,
    queryFn: async () => {
      const resposta = await apiFetch("/api/cadastros-pendentes");
      if (!resposta.ok) throw new Error("Não foi possível consultar os cadastros.");
      return ((await resposta.json()) as { pendentes: CadastroPendente[] }).pendentes ?? [];
    },
  });
}
