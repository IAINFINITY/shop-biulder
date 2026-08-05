/**
 * Sanitizacao dos valores interpolados no header `X-ProManager-Busca-Filtro`.
 *
 * O filtro e uma linguagem de consulta do ProManager, e o que entra nele vem do
 * corpo da requisicao. Nada do request deve chegar la sem passar por aqui —
 * inclusive os campos que hoje ja sao seguros por acidente, porque o risco real
 * e alguem adicionar um filtro novo amanha e esquecer da sanitizacao.
 *
 * A escolha e allowlist, nao escape: o parser do fornecedor e caixa-preta, e
 * recusar o que nao casa com o formato esperado nao depende de adivinhar como
 * ele trata aspas.
 */

const ITEM_NUMBER_PATTERN = /^[A-Z0-9._/-]{1,40}$/;

/** Codigo de produto (`ite_numero`). Devolve null quando nao serve. */
export function safeItemNumber(value: unknown): string | null {
  const clean = String(value ?? "").trim().toUpperCase();
  return ITEM_NUMBER_PATTERN.test(clean) ? clean : null;
}

/** Inteiro positivo para filtros numericos (`pes_id_cli`, `mun_cod_ibge`). */
export function safeNumericFilter(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null;
}

/**
 * Literal para comparacao entre aspas simples. Recusa o valor que ainda contenha
 * aspas ou quebra de linha depois de normalizado, em vez de tentar escapar.
 */
export function safeQuotedLiteral(value: unknown): string | null {
  const clean = String(value ?? "").trim();
  if (!clean || /['"\r\n]/.test(clean)) return null;
  return clean;
}
