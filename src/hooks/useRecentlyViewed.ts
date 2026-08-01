import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearProductIdList,
  promoteId,
  readProductIdList,
  writeProductIdList,
} from "@/lib/productIdList";

const STORAGE_KEY = "clinic-plus-recently-viewed";
const MAX_ITEMS = 20;

export function useRecentlyViewed() {
  const [ids, setIds] = useState<string[]>(() => readProductIdList(STORAGE_KEY));

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      setIds(readProductIdList(STORAGE_KEY));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((productId: string) => {
    setIds((previous) => {
      // Reabrir o mesmo produto nao pode gerar escrita nem re-render.
      if (previous[0] === productId) return previous;

      const next = promoteId(previous, productId, MAX_ITEMS);
      writeProductIdList(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setIds([]);
    clearProductIdList(STORAGE_KEY);
  }, []);

  return useMemo(() => ({ ids, add, clear }), [ids, add, clear]);
}
