import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "clinic-plus-wishlist";

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function useWishlist() {
  const [ids, setIds] = useState<string[]>(readIds);

  useEffect(() => {
    const onStorage = () => setIds(readIds());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((productId: string) => {
    const current = readIds();
    const wasFav = current.includes(productId);
    setIds((prev) => {
      const next = wasFav ? prev.filter((id) => id !== productId) : [productId, ...prev];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    toast.success(wasFav ? "Removido dos favoritos" : "Adicionado aos favoritos");
  }, []);

  const clear = useCallback(() => {
    setIds([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return useMemo(() => ({ ids, toggle, clear }), [ids, toggle, clear]);
}
