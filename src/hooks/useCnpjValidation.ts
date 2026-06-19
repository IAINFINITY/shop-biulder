import { useEffect, useState } from "react";
import { isValidCnpj, onlyDigits } from "@/lib/brazilianIds";

export type CnpjValidationStatus = "idle" | "checking" | "valid" | "invalid" | "error";

export function useCnpjValidation(cnpj: string, cnpjTouched: boolean) {
  const [status, setStatus] = useState<CnpjValidationStatus>("idle");

  const cnpjDigits = onlyDigits(cnpj);
  const isCnpjIncomplete = cnpjDigits.length > 0 && cnpjDigits.length < 14;
  const isCnpjComplete = cnpjDigits.length === 14;
  const shouldShowCnpjError = cnpjTouched || isCnpjComplete;
  const isCnpjInvalid = isCnpjComplete && status === "invalid";
  const isCnpjError = isCnpjComplete && status === "error";
  const isCnpjChecking = isCnpjComplete && status === "checking";

  useEffect(() => {
    if (!isCnpjComplete) {
      setStatus("idle");
      return;
    }

    if (!isValidCnpj(cnpjDigits)) {
      setStatus("invalid");
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setStatus("checking");
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`, {
          signal: controller.signal,
        });

        if (response.ok) {
          setStatus("valid");
          return;
        }

        if (response.status === 404) {
          setStatus("invalid");
          return;
        }

        setStatus("error");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatus("error");
      }
    }, 400);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [cnpjDigits, isCnpjComplete]);

  const assertCnpjReady = (): string | null => {
    if (cnpjDigits.length !== 14) return "CNPJ incompleto. Preencha 14 dígitos.";
    if (!isValidCnpj(cnpjDigits)) return "CNPJ inválido. Verifique o número informado.";
    if (status === "checking") return "Validando CNPJ...";
    if (status === "invalid") return "CNPJ inválido. Verifique o número informado.";
    if (status === "error") return "Não foi possível validar o CNPJ agora. Tente novamente.";
    return null;
  };

  return {
    cnpjDigits,
    status,
    isCnpjIncomplete,
    isCnpjComplete,
    shouldShowCnpjError,
    isCnpjInvalid,
    isCnpjError,
    isCnpjChecking,
    assertCnpjReady,
  };
}
