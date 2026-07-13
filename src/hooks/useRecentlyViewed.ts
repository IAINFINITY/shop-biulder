import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "clinic-plus-recently-viewed";
const MAX_ITEMS = 20;

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

export function useRecentlyViewed() {
  const [ids, setIds] = useState<string[]>(readIds);

  useEffect(() => {
    const onStorage = () => setIds(readIds());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((productId: string) => {
    setIds((prev) => {
      const next = [productId, ...prev.filter((id) => id !== productId)].slice(0, MAX_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setIds([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return useMemo(() => ({ ids, add, clear }), [ids, add, clear]);
}
