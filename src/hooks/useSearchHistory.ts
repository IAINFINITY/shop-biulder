import { useState, useCallback } from "react";

const SEARCH_HISTORY_KEY = "clinicplus_search_history";
const MAX_HISTORY = 5;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveHistory(terms: string[]) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(terms));
  } catch {
    /* ignore */
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>(loadHistory);

  const add = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const next = [trimmed, ...prev.filter((t) => t !== trimmed)].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const remove = useCallback((term: string) => {
    setHistory((prev) => {
      const next = prev.filter((t) => t !== term);
      saveHistory(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  return { history, add, remove, clear };
}
