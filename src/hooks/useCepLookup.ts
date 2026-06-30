import { useEffect, useRef, useState } from "react";
import { onlyDigits } from "@/lib/brazilianIds";
import { formatCep, type AddressFormData } from "@/lib/address";

export type CepLookupStatus = "idle" | "loading" | "found" | "not_found" | "error";

type ViaCepResponse = {
  erro: boolean;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
};

function mapViaCepToPatch(cep: string, data: ViaCepResponse): Partial<AddressFormData> {
  return {
    cep,
    street: data.logradouro.trim() || "",
    neighborhood: data.bairro.trim() || "",
    city: data.localidade.trim() || "",
    state: data.uf.trim() || "",
    ibge: data.ibge.trim() || "",
  };
}

export function useCepLookup(cep: string, onResolved: (patch: Partial<AddressFormData>) => void) {
  const [status, setStatus] = useState<CepLookupStatus>("idle");
  const onResolvedRef = useRef(onResolved);
  const lastFetchedCepRef = useRef<string | null>(null);

  useEffect(() => {
    onResolvedRef.current = onResolved;
  }, [onResolved]);

  const cepDigits = onlyDigits(cep);
  const isComplete = cepDigits.length === 8;

  useEffect(() => {
    if (!isComplete) {
      lastFetchedCepRef.current = null;
      setStatus("idle");
      return;
    }

    if (lastFetchedCepRef.current === cepDigits) {
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
          lastFetchedCepRef.current = cepDigits;
          setStatus("error");
          return;
        }
        const data = (await response.json()) as ViaCepResponse;
        if (data.erro) {
          lastFetchedCepRef.current = cepDigits;
          setStatus("not_found");
          return;
        }
        lastFetchedCepRef.current = cepDigits;
        setStatus("found");
        onResolvedRef.current?.(mapViaCepToPatch(formatCep(cepDigits), data));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        lastFetchedCepRef.current = cepDigits;
        setStatus("error");
      }
    }, 400);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [cepDigits, isComplete]);

  return { status, isComplete, cepDigits };
}
