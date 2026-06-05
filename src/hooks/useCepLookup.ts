import { useEffect, useState } from "react";
import { onlyDigits } from "@/lib/brazilianIds";
import type { AddressFormData } from "@/lib/address";

export type CepLookupStatus = "idle" | "loading" | "found" | "not_found" | "error";

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
};

function mapViaCepToPatch(cep: string, data: ViaCepResponse): Partial<AddressFormData> {
  return {
    cep,
    street: data.logradouro?.trim() || "",
    neighborhood: data.bairro?.trim() || "",
    city: data.localidade?.trim() || "",
    state: data.uf?.trim() || "",
    ibge: data.ibge?.trim() || "",
  };
}

export function useCepLookup(cep: string, onResolved?: (patch: Partial<AddressFormData>) => void) {
  const [status, setStatus] = useState<CepLookupStatus>("idle");

  const cepDigits = onlyDigits(cep);
  const isComplete = cepDigits.length === 8;

  useEffect(() => {
    if (!isComplete) {
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setStatus("loading");
        const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setStatus("error");
          return;
        }
        const data = (await response.json()) as ViaCepResponse;
        if (data.erro) {
          setStatus("not_found");
          return;
        }
        setStatus("found");
        onResolved?.(mapViaCepToPatch(cep, data));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatus("error");
      }
    }, 400);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [cepDigits, isComplete, cep, onResolved]);

  return { status, isComplete, cepDigits };
}
