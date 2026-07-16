import { useState, useCallback } from "react";

const COMPARISON_KEY = "clinicplus_comparison";
const MAX_COMPARE = 4;

function loadIds(): string[] {
  try {
    const raw = localStorage.getItem(COMPARISON_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string").slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

function saveIds(ids: string[]) {
  try {
    localStorage.setItem(COMPARISON_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function useComparison() {
  const [ids, setIds] = useState<string[]>(loadIds);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const already = prev.includes(id);
      const next = already ? prev.filter((i) => i !== id) : prev.length >= MAX_COMPARE ? prev : [...prev, id];
      saveIds(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.filter((i) => i !== id);
      saveIds(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setIds([]);
    saveIds([]);
  }, []);

  return { ids, toggle, remove, clear, max: MAX_COMPARE };
}
