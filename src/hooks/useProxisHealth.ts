import { useState, useEffect, useCallback, useRef } from "react";

type ProxisHealth = {
  connected: boolean;
  error: string | null;
  checking: boolean;
  lastCheck: Date | null;
  checkNow: () => void;
};

const POLL_INTERVAL_MS = 45_000;

export function useProxisHealth(): ProxisHealth {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch(`/api/proxis-health?_t=${Date.now()}`);
      if (res.status === 304) {
        if (mountedRef.current) {
          setLastCheck(new Date());
        }
        return;
      }
      const data = await res.json();
      if (mountedRef.current) {
        setConnected(!!data.connected);
        setError(data.error || null);
        setLastCheck(new Date());
      }
    } catch {
      if (mountedRef.current) {
        setConnected(false);
        setError("Falha ao consultar /api/proxis-health");
        setLastCheck(new Date());
      }
    } finally {
      if (mountedRef.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [check]);

  const checkNow = useCallback(() => {
    check();
  }, [check]);

  return { connected, error, checking, lastCheck, checkNow };
}
