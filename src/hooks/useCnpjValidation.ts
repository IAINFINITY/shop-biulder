import { useEffect, useState } from "react";
import { isValidCnpj, onlyDigits } from "@/lib/brazilianIds";

export type CnpjValidationStatus = "idle" | "checking" | "valid" | "invalid" | "error";

export type DocumentType = "cnpj" | null;

function detectDocumentType(digits: string): DocumentType {
  if (digits.length === 14) return "cnpj";
  return null;
}

export function useCnpjValidation(cnpj: string, cnpjTouched: boolean) {
  const [status, setStatus] = useState<CnpjValidationStatus>("idle");

  const digits = onlyDigits(cnpj);
  const docType = detectDocumentType(digits);
  const isDocIncomplete = digits.length > 0 && (docType === "cnpj" && digits.length < 14);
  const isDocComplete = docType === "cnpj" && digits.length === 14;
  const shouldShowError = cnpjTouched || isDocComplete;
  const isDocInvalid = isDocComplete && status === "invalid";
  const isDocError = isDocComplete && status === "error";
  const isDocChecking = isDocComplete && status === "checking";

  const requiredLength = 14;

  useEffect(() => {
    if (!isDocComplete) {
      setStatus("idle");
      return;
    }

    if (!isValidCnpj(digits)) {
      setStatus("invalid");
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setStatus("checking");
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
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
  }, [digits, isDocComplete, docType]);

  const assertDocReady = (): string | null => {
    if (digits.length < requiredLength || !docType) {
      return "CNPJ incompleto. Preencha 14 dígitos.";
    }
    if (!isValidCnpj(digits)) return "CNPJ inválido. Verifique o número informado.";
    if (status === "checking") return "Validando documento...";
    if (status === "invalid") return "CNPJ inválido. Verifique o número informado.";
    if (status === "error") return "Não foi possível validar o documento agora. Tente novamente.";
    return null;
  };

  return {
    cnpjDigits: digits,
    docType,
    status,
    isDocIncomplete,
    isDocComplete,
    shouldShowError,
    isDocInvalid,
    isDocError,
    isDocChecking,
    assertDocReady,
  };
}
