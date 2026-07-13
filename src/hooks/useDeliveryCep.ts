import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "clinicplus_delivery_cep";

export type DeliveryCepData = {
  cep: string;
  city: string;
  state: string;
};

let cached: DeliveryCepData | null = null;
let lastRaw: string | null = null;

function readSnapshot(): DeliveryCepData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === lastRaw && cached !== null) return cached;
    if (!raw) {
      lastRaw = null;
      cached = null;
      return null;
    }
    cached = JSON.parse(raw) as DeliveryCepData;
    lastRaw = raw;
    return cached;
  } catch {
    lastRaw = null;
    cached = null;
    return null;
  }
}

function subscribe(callback: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export function useDeliveryCep() {
  const data = useSyncExternalStore(subscribe, readSnapshot, readSnapshot);

  const saveDeliveryCep = useCallback((value: DeliveryCepData) => {
    try {
      const raw = JSON.stringify(value);
      localStorage.setItem(STORAGE_KEY, raw);
      lastRaw = raw;
      cached = value;
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    } catch {
      // noop
    }
  }, []);

  const clearDeliveryCep = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      lastRaw = null;
      cached = null;
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    } catch {
      // noop
    }
  }, []);

  return {
    deliveryCep: data,
    saveDeliveryCep,
    clearDeliveryCep,
  };
}
