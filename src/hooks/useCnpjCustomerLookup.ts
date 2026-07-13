import { useEffect, useRef, useState } from "react";
import { onlyDigits } from "@/lib/brazilianIds";

export type CnpjCustomerSuggestion = {
  name: string;
  company: string;
};

export type CnpjCustomerLookupStatus = "idle" | "loading" | "found" | "not_found" | "error";

type CnpjLookupResult = {
  found?: boolean;
  customer_name?: string | null;
  customer_company?: string | null;
};

export function useCnpjCustomerLookup(cnpj: string, active: boolean) {
  const [status, setStatus] = useState<CnpjCustomerLookupStatus>("idle");
  const [suggestion, setSuggestion] = useState<CnpjCustomerSuggestion | null>(null);
  const lastFetchedCnpjRef = useRef<string | null>(null);

  const cnpjDigits = onlyDigits(cnpj);
  const isComplete = cnpjDigits.length === 14;

  useEffect(() => {
    if (!active || !isComplete) {
      setStatus("idle");
      setSuggestion(null);
      lastFetchedCnpjRef.current = null;
      return;
    }

    if (lastFetchedCnpjRef.current === cnpjDigits) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setStatus("loading");
        const response = await fetch("/api/proxis-customer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cnpj: cnpjDigits }),
          signal: controller.signal,
        });

        if (!response.ok) {
          lastFetchedCnpjRef.current = cnpjDigits;
          setSuggestion(null);
          setStatus(response.status === 404 ? "not_found" : "error");
          return;
        }

        const data = (await response.json().catch(() => null)) as CnpjLookupResult | null;
        const found = Boolean(data?.found);
        const name = typeof data?.customer_name === "string" ? data.customer_name.trim() : "";
        const company = typeof data?.customer_company === "string" ? data.customer_company.trim() : "";

        lastFetchedCnpjRef.current = cnpjDigits;
        if (found && (name || company)) {
          setSuggestion({
            name: name || company,
            company: company || name,
          });
          setStatus("found");
          return;
        }

        setSuggestion(null);
        setStatus("not_found");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        lastFetchedCnpjRef.current = cnpjDigits;
        setSuggestion(null);
        setStatus("error");
      }
    }, 450);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [active, cnpjDigits, isComplete]);

  return {
    status,
    suggestion,
    isComplete,
    cnpjDigits,
  };
}
