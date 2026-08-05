import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { apiFetch } from "@/lib/apiFetch";

/**
 * Confere se o codigo do produto existe no Proxis.
 *
 * Usado no formulario do admin: produto sem cadastro no ERP nao pode ficar ativo
 * no catalogo, porque no pedido ele e descartado — o cliente pede cinco itens e
 * o ERP recebe quatro.
 *
 * `found: null` quer dizer "nao deu para saber" (ERP fora do ar, rede caindo), e
 * e diferente de `false`. Tratar os dois como iguais barraria um cadastro
 * correto por causa de uma indisponibilidade passageira.
 */

export type ProxisItemCheck = {
  code: string;
  found: boolean | null;
  ite_id: number | null;
  description: string | null;
};

export function useProxisItemCheck(productCode: string) {
  const code = useDebounce(productCode.trim(), 600);

  return useQuery<ProxisItemCheck>({
    queryKey: ["proxis-item-check", code],
    enabled: code.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const res = await apiFetch(`/api/proxis-item-check?code=${encodeURIComponent(code)}`);
      const payload = (await res.json()) as ProxisItemCheck & { error?: string };
      // 502 = falha ao falar com o ERP. Devolve `found: null` em vez de lancar,
      // para a tela distinguir "nao existe" de "nao consegui verificar".
      if (!res.ok) return { code, found: null, ite_id: null, description: null };
      return payload;
    },
  });
}
