import { useEffect, useState } from "react";
import { isValidCnpj, onlyDigits } from "@/lib/brazilianIds";

export type CnpjValidationStatus = "idle" | "checking" | "valid" | "invalid" | "error";

export type DocumentType = "cnpj" | null;

function detectDocumentType(digits: string): DocumentType {
  if (digits.length === 14) return "cnpj";
  return null;
}

/** O que a Receita devolve e nos interessa. */
export type DadosDoCnpj = {
  razaoSocial: string;
  nomeFantasia: string;
};

export function useCnpjValidation(cnpj: string, cnpjTouched: boolean) {
  const [status, setStatus] = useState<CnpjValidationStatus>("idle");
  const [dados, setDados] = useState<DadosDoCnpj | null>(null);

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
      setDados(null);
      return;
    }

    if (!isValidCnpj(digits)) {
      setStatus("invalid");
      setDados(null);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setStatus("checking");
        setDados(null);
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
          signal: controller.signal,
        });

        if (response.ok) {
          // O corpo da resposta era descartado: so o status decidia valido ou
          // nao. A razao social ja vem aqui, e e o que permite preencher a
          // empresa no cadastro sem pedir para a pessoa digitar de novo.
          //
          // Vem da Receita, e nao do nosso ERP. A consulta ao ERP por CNPJ
          // exige login desde a correcao de seguranca — e deve exigir mesmo:
          // sem isso, qualquer um levantava razao social e tabela de preco de
          // qualquer empresa. Dado publico da Receita nao tem esse problema.
          const corpo = await response.json().catch(() => null);
          setDados(
            corpo && typeof corpo === "object"
              ? {
                  razaoSocial: String((corpo as Record<string, unknown>).razao_social ?? "").trim(),
                  nomeFantasia: String((corpo as Record<string, unknown>).nome_fantasia ?? "").trim(),
                }
              : null,
          );
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

    /**
     * Consulta fora do ar **não** barra o cadastro.
     *
     * Barrava, e era um beco: o campo dizia "não foi possível consultar agora,
     * você pode preencher a empresa manualmente", a pessoa preenchia, clicava em
     * Continuar e levava "não foi possível validar o documento agora". A tela
     * prometia um caminho e o botão recusava.
     *
     * Deixar passar é o correto, e não uma concessão: o dígito verificador do
     * CNPJ já foi conferido aqui mesmo (`isValidCnpj`), e a razão social entra à
     * mão. A Receita, neste ponto, é conveniência — evita redigitação —, não
     * autorização. Nada que ela responde decide se a pessoa pode ou não comprar.
     *
     * E o custo de barrar caía sobre quem menos podia resolver: a BrasilAPI está
     * atrás de Cloudflare, e rede móvel usa CGNAT, então o IP compartilhado da
     * operadora bate em limite muito mais que o IP fixo de um escritório. Na
     * prática, quem tentava se cadastrar pelo celular era barrado; pelo
     * computador da empresa, não. Reproduzido em 19/08/2026 com 429, 403 e queda
     * de conexão — nos três, cadastro travado.
     */
    return null;
  };

  return {
    cnpjDigits: digits,
    docType,
    status,
    /** Razao social e nome fantasia, quando a Receita respondeu. */
    dados,
    isDocIncomplete,
    isDocComplete,
    shouldShowError,
    isDocInvalid,
    isDocError,
    isDocChecking,
    assertDocReady,
  };
}
