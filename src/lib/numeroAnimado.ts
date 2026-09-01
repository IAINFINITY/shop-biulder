// A contagem que sobe nos números do painel.
//
// ## Por que a regra mora aqui
//
// Animação costuma nascer embolada com `requestAnimationFrame` dentro do
// componente, e aí não há como testar: o que se quer garantir — que termina
// exatamente no alvo, que nunca passa dele, que respeita quem pediu menos
// movimento — vira refém de um relógio de navegador.
//
// Aqui fica só a conta: dado quanto tempo passou, quanto vale o número agora. O
// `useNumeroAnimado` faz o `requestAnimationFrame` em volta.

/** Meio segundo: o bastante para o olho ver subindo, pouco para não atrasar leitura. */
export const DURACAO_PADRAO_MS = 550;

/**
 * O quanto da animação já passou, de 0 a 1.
 *
 * Duração zero ou negativa devolve 1 — "já terminou". É o que faz o caso de
 * movimento reduzido cair no valor final sem nenhum ramo extra no componente.
 */
export function progressoDaAnimacao(decorridoMs: number, duracaoMs: number): number {
  // A duração é conferida **antes** do tempo decorrido, e não depois: com as
  // duas em zero — que é o primeiro quadro de quem pediu movimento reduzido —
  // a ordem invertida devolvia 0 e o número aparecia zerado antes de saltar
  // para o valor certo. "Sem animação" tem de significar "já terminou".
  if (!Number.isFinite(duracaoMs) || duracaoMs <= 0) return 1;
  if (!Number.isFinite(decorridoMs) || decorridoMs <= 0) return 0;
  return Math.min(1, decorridoMs / duracaoMs);
}

/**
 * Desaceleração no fim (ease-out cúbica).
 *
 * Linear parece contador de posto: chega no alvo na mesma velocidade em que
 * saiu, e o fim não se lê como fim. Com a desaceleração, os últimos números
 * demoram mais e o olho acompanha onde parou.
 */
export function suavizar(progresso: number): number {
  const p = Math.min(1, Math.max(0, progresso));
  return 1 - Math.pow(1 - p, 3);
}

/**
 * Quanto o número vale neste instante da animação.
 *
 * Arredonda para inteiro quando o alvo é inteiro, e para centavos quando não é —
 * sem isso, um valor em reais tremia com quinze casas decimais durante a subida.
 *
 * No progresso 1 devolve **o alvo exato**, sem passar pela conta: `alvo *
 * suavizar(1)` daria 0.30000000000000004 em vez de 0,3 e o cartão terminaria
 * mostrando um centavo a menos que a fonte.
 */
export function valorNaAnimacao(alvo: number, progresso: number): number {
  if (!Number.isFinite(alvo)) return 0;
  if (progresso >= 1) return alvo;

  const bruto = alvo * suavizar(progresso);
  return Number.isInteger(alvo) ? Math.round(bruto) : Math.round(bruto * 100) / 100;
}
