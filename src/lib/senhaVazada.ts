/**
 * Consulta a base de senhas vazadas sem entregar a senha a ninguem.
 *
 * A §10 exige que signup, alteracao e reset consultem "blocklist de senhas
 * comuns, contextuais e comprometidas". As duas primeiras estao em
 * `src/lib/senha.ts`, numa lista local. Esta e a terceira.
 *
 * E a mesma §10 impoe o limite: *"a senha em claro ou hash completo NAO DEVE ser
 * enviado a terceiro"* e *"checagem remota deve usar protocolo de privacidade"*.
 *
 * ## Como o k-anonimato resolve
 *
 * 1. O navegador calcula o SHA-1 da senha **localmente** (Web Crypto).
 * 2. Manda apenas os **5 primeiros caracteres** do hash.
 * 3. Recebe de volta todos os sufixos que comecam com aqueles 5 — uma faixa de
 *    centenas de hashes.
 * 4. Procura o proprio sufixo **na propria maquina**.
 *
 * Ninguem no caminho — nem o nosso servidor, nem o HIBP — ve a senha nem o hash
 * inteiro. O que trafega identifica um conjunto grande demais para servir de
 * alguma coisa.
 *
 * ## Por que passa pelo nosso servidor
 *
 * Chamar `api.pwnedpasswords.com` direto do navegador exigiria abrir esse host no
 * `connect-src` da CSP. A rota propria mantem a CSP em `'self'` mais Supabase, e
 * o proxy nao ve nada alem do prefixo de 5 caracteres.
 *
 * ## Falha e sempre a favor de deixar passar
 *
 * Se a consulta cair, a senha e aceita. Recusar cadastro porque um servico de
 * terceiro esta fora do ar transformaria indisponibilidade externa em
 * indisponibilidade nossa — e as checagens de comprimento e lista local, que sao
 * as que mais barram, continuam valendo.
 */

/** Quantos caracteres do hash saem da maquina. Definido pela API do HIBP. */
export const TAMANHO_DO_PREFIXO = 5;

/**
 * SHA-1 da senha, em hexadecimal maiusculo.
 *
 * SHA-1 aqui nao e escolha de seguranca — e o formato que a base usa. A senha
 * nunca e **armazenada** assim; isto e so a chave de consulta.
 */
export async function hashSha1Hex(senha: string): Promise<string> {
  const bytes = new TextEncoder().encode(senha);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export type HashDividido = { prefixo: string; sufixo: string };

/** Separa o que sai da maquina do que fica nela. */
export function dividirHash(hex: string): HashDividido {
  const limpo = hex.trim().toUpperCase();
  return {
    prefixo: limpo.slice(0, TAMANHO_DO_PREFIXO),
    sufixo: limpo.slice(TAMANHO_DO_PREFIXO),
  };
}

/** Um prefixo so pode ser exatamente 5 caracteres hexadecimais. */
export function prefixoValido(valor: unknown): valor is string {
  return typeof valor === "string" && /^[0-9A-Fa-f]{5}$/.test(valor);
}

/**
 * Quantas vezes o sufixo aparece na faixa devolvida.
 *
 * A resposta do HIBP vem em linhas `SUFIXO:CONTAGEM`. Com o cabecalho de
 * preenchimento ativado, ela tambem traz linhas artificiais com contagem `0` —
 * elas existem para o tamanho da resposta nao denunciar nada, e precisam ser
 * ignoradas. Tratar `0` como vazamento recusaria senha boa.
 */
export function contarNoIntervalo(corpo: string, sufixo: string): number {
  const alvo = sufixo.trim().toUpperCase();
  if (!alvo) return 0;

  for (const linha of corpo.split(/\r?\n/)) {
    const [hash, contagem] = linha.trim().split(":");
    if (!hash || hash.toUpperCase() !== alvo) continue;
    const numero = Number.parseInt(contagem ?? "0", 10);
    return Number.isFinite(numero) ? numero : 0;
  }
  return 0;
}

export type ResultadoDeVazamento = {
  /** `true` quando a senha aparece em vazamento conhecido. */
  vazada: boolean;
  /** Quantas vezes. Zero quando nao apareceu ou quando a consulta falhou. */
  ocorrencias: number;
  /** `true` quando nao foi possivel consultar — a senha e aceita mesmo assim. */
  indisponivel: boolean;
};

const LIVRE: ResultadoDeVazamento = { vazada: false, ocorrencias: 0, indisponivel: false };
const INDISPONIVEL: ResultadoDeVazamento = { vazada: false, ocorrencias: 0, indisponivel: true };

/**
 * A senha esta em alguma base de vazamento?
 *
 * `buscarIntervalo` e injetado para o teste nao depender de rede — em producao e
 * a rota `/api/senha-vazada`.
 */
export async function verificarSenhaVazada(
  senha: string,
  buscarIntervalo: (prefixo: string) => Promise<string>,
): Promise<ResultadoDeVazamento> {
  if (!senha) return LIVRE;

  try {
    const { prefixo, sufixo } = dividirHash(await hashSha1Hex(senha));
    const corpo = await buscarIntervalo(prefixo);
    const ocorrencias = contarNoIntervalo(corpo, sufixo);
    return ocorrencias > 0 ? { vazada: true, ocorrencias, indisponivel: false } : LIVRE;
  } catch (erro) {
    console.warn("[senha-vazada] consulta indisponivel:", erro);
    return INDISPONIVEL;
  }
}

/** A frase mostrada quando a senha aparece em vazamento. */
export function mensagemDeVazamento(ocorrencias: number): string {
  return ocorrencias >= 1000
    ? "Essa senha apareceu em vazamentos públicos milhares de vezes. Escolha outra."
    : "Essa senha já apareceu em vazamentos públicos. Escolha outra.";
}
