import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const memoryStorage = new Map<string, string>();

const safeStorage: Storage = {
  get length() {
    try {
      return typeof window === "undefined" ? memoryStorage.size : window.localStorage.length;
    } catch {
      return memoryStorage.size;
    }
  },
  clear() {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.clear();
        return;
      }
    } catch {
      // Fall back to in-memory storage when browser storage is not available.
    }
    memoryStorage.clear();
  },
  getItem(key: string) {
    try {
      if (typeof window === "undefined") return memoryStorage.get(key) ?? null;
      return window.localStorage.getItem(key);
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },
  key(index: number) {
    try {
      if (typeof window === "undefined") return Array.from(memoryStorage.keys())[index] ?? null;
      return window.localStorage.key(index);
    } catch {
      return Array.from(memoryStorage.keys())[index] ?? null;
    }
  },
  removeItem(key: string) {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {
      // Fall back to in-memory storage when browser storage is not available.
    }
    memoryStorage.delete(key);
  },
  setItem(key: string, value: string) {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Fall back to in-memory storage when browser storage is not available.
    }
    memoryStorage.set(key, value);
  },
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: safeStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
