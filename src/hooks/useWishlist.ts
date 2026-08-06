import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import {
  alternarFavorito,
  definirQuantidade,
  mesclarFavoritos,
  parseFavoritosArmazenados,
  type ItemFavorito,
} from "@/lib/favoritos";

const STORAGE_KEY = "clinic-plus-wishlist";
const TABELA = "clinic+b2b_customer_favorites";

/** Referencia estavel para o caso "ainda nao respondeu". Ver o `useMemo` abaixo. */
const LISTA_VAZIA: ItemFavorito[] = [];

function lerLocal(): ItemFavorito[] {
  if (typeof window === "undefined") return [];
  try {
    return parseFavoritosArmazenados(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function gravarLocal(itens: ItemFavorito[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(itens));
  } catch {
    // Storage cheio ou bloqueado: a lista continua valendo em memoria.
  }
}

function limparLocal(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}

/**
 * A lista de recompra do cliente.
 *
 * Antes vivia so no `localStorage`, e isso trazia dois problemas que nao eram de
 * acabamento. Primeiro, a lista nao seguia o cliente: favoritar no celular nao
 * aparecia no desktop, e a propria legenda da tela admitia isso ("neste
 * dispositivo"). Segundo, e pior, a lista era **do navegador e nao do usuario** —
 * o `signOut` nunca limpava a chave, entao quem entrasse depois naquele
 * computador via a lista de quem saiu.
 *
 * Agora: logado le e grava no banco; convidado continua no `localStorage`, porque
 * exigir conta para salvar e o erro que a Baymard encontra em 60% das lojas. No
 * primeiro fetch depois do login as duas se juntam e a local e apagada — o que
 * fecha o vazamento entre contas, ja que nao sobra nada no aparelho.
 */
export function useWishlist() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const [locais, setLocais] = useState<ItemFavorito[]>(() => lerLocal());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      setLocais(lerLocal());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const query = useQuery({
    queryKey: ["favoritos", userId],
    enabled: userId !== null,
    // A lista so muda por acao do proprio cliente, e toda acao ja atualiza o
    // cache na hora. Refazer a consulta a cada montagem so gastaria round-trip.
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ItemFavorito[]> => {
      const supabase = await loadSupabaseClient();
      const { data, error } = await supabase
        .from(TABELA)
        .select("product_id, quantity")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const remoto: ItemFavorito[] = (data ?? []).map((linha) => ({
        productId: String((linha as { product_id: unknown }).product_id),
        quantity: Number((linha as { quantity: unknown }).quantity ?? 1),
      }));

      // O merge mora aqui, e nao num efeito, porque assim acontece **uma vez** e
      // no momento exato em que a lista da conta chega. Num efeito dependeria da
      // ordem em que `user` e `data` chegam, que e justamente o tipo de corrida
      // que faz o item salvo antes do login sumir.
      const local = lerLocal();
      if (local.length === 0) return remoto;

      const mesclado = mesclarFavoritos(local, remoto);
      const jaNaConta = new Set(remoto.map((i) => i.productId));
      const novos = mesclado.filter((i) => !jaNaConta.has(i.productId));

      if (novos.length > 0) {
        const { error: erroUpsert } = await supabase.from(TABELA).upsert(
          novos.map((i) => ({ user_id: userId, product_id: i.productId, quantity: i.quantity })),
          { onConflict: "user_id,product_id" },
        );
        // Se o upsert falhar a lista local fica onde esta, para tentar de novo no
        // proximo carregamento. Apagar aqui perderia o que o cliente salvou.
        if (erroUpsert) return mesclado;
      }

      limparLocal();
      setLocais([]);
      return mesclado;
    },
  });

  /**
   * Se a consulta falhou, cai de volta no aparelho.
   *
   * Cobre o caso de a migration ainda nao ter sido aplicada e o de o banco estar
   * fora do ar. Favoritar e uma acao pequena; derrubar o coracao do catalogo
   * inteiro por causa disso seria pior que guardar so localmente.
   */
  const usandoBanco = userId !== null && !query.isError;

  // `useMemo` aqui nao e zelo: sem ele o `?? []` devolve um array novo a cada
  // render enquanto a consulta nao respondeu, e como toda acao abaixo depende de
  // `itens`, os `useCallback` se refariam sempre — junto com os componentes que
  // os recebem.
  const itens = useMemo(
    () => (usandoBanco ? (query.data ?? LISTA_VAZIA) : locais),
    [locais, query.data, usandoBanco],
  );

  const persistir = useCallback(
    async (proximos: ItemFavorito[], anteriores: ItemFavorito[]) => {
      if (!usandoBanco || !userId) {
        gravarLocal(proximos);
        setLocais(proximos);
        return;
      }

      queryClient.setQueryData(["favoritos", userId], proximos);

      const antesPorId = new Map(anteriores.map((i) => [i.productId, i]));
      const depoisPorId = new Map(proximos.map((i) => [i.productId, i]));
      const removidos = anteriores.filter((i) => !depoisPorId.has(i.productId));
      const gravar = proximos.filter((i) => antesPorId.get(i.productId)?.quantity !== i.quantity);

      try {
        const supabase = await loadSupabaseClient();

        if (removidos.length > 0) {
          const { error } = await supabase
            .from(TABELA)
            .delete()
            .eq("user_id", userId)
            .in("product_id", removidos.map((i) => i.productId));
          if (error) throw error;
        }

        if (gravar.length > 0) {
          const { error } = await supabase.from(TABELA).upsert(
            gravar.map((i) => ({
              user_id: userId,
              product_id: i.productId,
              quantity: i.quantity,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: "user_id,product_id" },
          );
          if (error) throw error;
        }
      } catch {
        // Devolve a tela ao estado real do banco em vez de deixar o cliente
        // acreditando que salvou.
        queryClient.setQueryData(["favoritos", userId], anteriores);
        toast.error("Não foi possível salvar sua lista. Tente de novo.");
      }
    },
    [queryClient, usandoBanco, userId],
  );

  const toggle = useCallback(
    (productId: string) => {
      const anteriores = itens;
      const proximos = alternarFavorito(anteriores, productId);
      toast.success(
        proximos.length < anteriores.length ? "Removido dos favoritos" : "Adicionado aos favoritos",
      );
      void persistir(proximos, anteriores);
    },
    [itens, persistir],
  );

  const setQuantity = useCallback(
    (productId: string, quantidade: number) => {
      void persistir(definirQuantidade(itens, productId, quantidade), itens);
    },
    [itens, persistir],
  );

  const remove = useCallback(
    (productIds: string[]) => {
      const alvo = new Set(productIds);
      void persistir(
        itens.filter((i) => !alvo.has(i.productId)),
        itens,
      );
    },
    [itens, persistir],
  );

  const clear = useCallback(() => {
    void persistir([], itens);
  }, [itens, persistir]);

  const ids = useMemo(() => itens.map((i) => i.productId), [itens]);

  return useMemo(
    () => ({ itens, ids, toggle, setQuantity, remove, clear, carregando: query.isLoading }),
    [itens, ids, toggle, setQuantity, remove, clear, query.isLoading],
  );
}
