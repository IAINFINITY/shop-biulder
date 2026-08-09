/**
 * Dispositivo confiavel — a regra, pura e testavel.
 *
 * Resolve o atrito que o usuario relatou: sair e entrar pedia o codigo do
 * autenticador toda vez. Google e GitHub pedem uma vez e lembram do navegador; a
 * Microsoft recomenda lembrar por no minimo 30 dias.
 *
 * ## O que a §14 exige de um "remember me", e por que cada linha existe
 *
 * > "NAO DEVE transformar o cookie principal em bearer token permanente. Use
 * > credencial separada, revogavel, armazenada como hash, rotacionada a cada uso
 * > e com deteccao de replay."
 *
 * Ponto a ponto:
 *
 * - **credencial separada** — nao e o token de sessao. Vazar um nao entrega o
 *   outro, e revogar o dispositivo nao derruba a sessao.
 * - **armazenada como hash** — o banco guarda `sha256(token)`. Um dump do banco
 *   nao permite entrar como ninguem, do mesmo jeito que uma tabela de senhas
 *   bem-feita nao permite.
 * - **rotacionada a cada uso** — cada uso queima o token e emite outro. Reduz a
 *   janela em que uma copia velha vale alguma coisa.
 * - **deteccao de replay** — token ja usado que reaparece significa que existem
 *   duas copias. Ver `ehReplay`.
 *
 * E a §17 acrescenta o limite que define o desenho inteiro:
 *
 * > "Confianca de dispositivo NAO DEVE substituir MFA silenciosamente."
 *
 * Por isso o registro so acontece **depois** de a pessoa passar pelo codigo.
 * O dispositivo nunca dispensa o primeiro desafio — ele dispensa os proximos.
 *
 * ## Sem I/O aqui
 *
 * Nada neste arquivo le `process.env`, banco ou rede — a convencao do projeto
 * (`src/lib` puro, `api/` faz I/O). E o que permite testar replay e expiracao
 * sem subir servidor.
 */

/** Trinta dias, em milissegundos. Ver a recomendacao da Microsoft. */
export const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Quantos bytes de aleatoriedade o token carrega.
 *
 * 32 bytes = 256 bits. E uma credencial que substitui o segundo fator durante a
 * validade, entao adivinha-la precisa ser tao inviavel quanto adivinhar a chave
 * de sessao — nao "dificil o bastante para um formulario".
 */
export const BYTES_DO_TOKEN = 32;

export type RegistroDeDispositivo = {
  /** `sha256` do token em hexadecimal. O token cru nunca e guardado. */
  tokenHash: string;
  expiraEm: string;
  revogadoEm: string | null;
  /** Preenchido quando o token e trocado por outro. Ver `ehReplay`. */
  rotacionadoEm: string | null;
};

export type VeredictoDeDispositivo =
  | { valido: true }
  | { valido: false; motivo: "desconhecido" | "expirado" | "revogado" | "replay" };

/**
 * Este registro autoriza pular o desafio agora?
 *
 * A ordem das checagens nao e arbitraria: **replay antes de expirado**. Um token
 * rotacionado que volta e sinal de comprometimento, e essa informacao se perde se
 * a resposta for "expirou" so porque tambem passou da data. Quem chama precisa
 * poder distinguir para revogar a familia inteira.
 */
export function avaliarDispositivo(
  registro: RegistroDeDispositivo | null,
  agora: Date,
): VeredictoDeDispositivo {
  if (!registro) return { valido: false, motivo: "desconhecido" };
  if (registro.rotacionadoEm) return { valido: false, motivo: "replay" };
  if (registro.revogadoEm) return { valido: false, motivo: "revogado" };
  if (new Date(registro.expiraEm).getTime() <= agora.getTime()) {
    return { valido: false, motivo: "expirado" };
  }
  return { valido: true };
}

/**
 * Um token ja rotacionado reapareceu?
 *
 * Se o token foi trocado e alguem apresenta o antigo, existem **duas copias** em
 * circulacao — a legitima, que ja seguiu em frente, e outra. Nao da para saber
 * qual das duas esta na mao de quem; por isso a resposta certa nao e recusar so
 * esta tentativa, e sim revogar todos os dispositivos do usuario e obrigar o
 * codigo de novo.
 *
 * Sem isto, copiar o token uma vez daria acesso pelos 30 dias inteiros sem
 * ninguem perceber.
 */
export function ehReplay(registro: RegistroDeDispositivo | null): boolean {
  return Boolean(registro?.rotacionadoEm);
}

/** Quando um dispositivo registrado agora deve deixar de valer. */
export function calcularExpiracao(agora: Date): string {
  return new Date(agora.getTime() + VALIDADE_MS).toISOString();
}

/**
 * Rotulo legivel do aparelho, para o inventario da §17.
 *
 * Deliberadamente grosseiro. O objetivo e a pessoa reconhecer a linha ("ah, o
 * computador do escritorio") e conseguir revogar — nao identificar o aparelho
 * com precisao. Guardar `user-agent` inteiro seria colecionar dado de
 * rastreamento sem ganho para quem le a tela.
 *
 * E rotulo **nao e identidade**: a §12 lembra que mudanca de IP e user-agent sao
 * sinais de risco, nao vinculo. Quem autoriza e o token; isto so nomeia a linha.
 */
export function rotularDispositivo(userAgent: string | null | undefined): string {
  const ua = (userAgent ?? "").slice(0, 400);
  if (!ua) return "Aparelho desconhecido";

  const so =
    /Windows/i.test(ua) ? "Windows"
    : /iPhone|iPad|iOS/i.test(ua) ? "iPhone/iPad"
    : /Android/i.test(ua) ? "Android"
    : /Mac OS X|Macintosh/i.test(ua) ? "Mac"
    : /Linux/i.test(ua) ? "Linux"
    : null;

  // Ordem importa: Edge e Chrome se declaram como Safari, e Chrome tambem
  // aparece dentro do user-agent do Edge. Do mais especifico para o menos.
  const navegador =
    /Edg\//i.test(ua) ? "Edge"
    : /OPR\/|Opera/i.test(ua) ? "Opera"
    : /Chrome\//i.test(ua) ? "Chrome"
    : /Firefox\//i.test(ua) ? "Firefox"
    : /Safari\//i.test(ua) ? "Safari"
    : null;

  if (so && navegador) return `${navegador} no ${so}`;
  if (navegador) return navegador;
  if (so) return so;
  return "Aparelho desconhecido";
}
