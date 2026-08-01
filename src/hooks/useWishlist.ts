import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  clearProductIdList,
  readProductIdList,
  toggleId,
  writeProductIdList,
} from "@/lib/productIdList";

const STORAGE_KEY = "clinic-plus-wishlist";

/**
 * Teto da lista.
 *
 * Antes os favoritos cresciam sem limite no localStorage. O numero e alto de
 * proposito: num catalogo B2B o cliente favorita o que recompra, e 200 itens
 * cobre folgado o catalogo inteiro sem deixar a lista virar lixo eterno.
 */
const MAX_ITEMS = 200;

export function useWishlist() {
  const [ids, setIds] = useState<string[]>(() => readProductIdList(STORAGE_KEY));

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      setIds(readProductIdList(STORAGE_KEY));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((productId: string) => {
    // Uma fonte so: o estado anterior decide e grava. A versao anterior lia o
    // localStorage para saber se ja era favorito e montava o proximo valor a
    // partir do estado — se os dois divergissem, o aviso saia trocado.
    setIds((previous) => {
      const next = toggleId(previous, productId, MAX_ITEMS);
      writeProductIdList(STORAGE_KEY, next);
      toast.success(next.length < previous.length ? "Removido dos favoritos" : "Adicionado aos favoritos");
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setIds([]);
    clearProductIdList(STORAGE_KEY);
  }, []);

  return useMemo(() => ({ ids, toggle, clear }), [ids, toggle, clear]);
}
