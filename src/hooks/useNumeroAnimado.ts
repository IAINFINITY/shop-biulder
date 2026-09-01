import { useEffect, useRef, useState } from "react";
import { DURACAO_PADRAO_MS, progressoDaAnimacao, valorNaAnimacao } from "@/lib/numeroAnimado";

/**
 * O número subindo de 0 até o valor real.
 *
 * A conta está em `numeroAnimado.ts`, testada. Aqui fica só o
 * `requestAnimationFrame` e a leitura da preferência do sistema.
 *
 * ## `prefers-reduced-motion` não é detalhe
 *
 * O painel abre com dez cartões. Dez números subindo ao mesmo tempo é bastante
 * movimento na tela, e para quem tem sensibilidade vestibular isso passa de
 * enfeite a problema. Com a preferência ligada a duração vira zero, o
 * `progressoDaAnimacao` devolve 1 no primeiro quadro e o valor final aparece
 * direto — sem ramo separado, sem risco de os dois caminhos divergirem.
 */
export function useNumeroAnimado(alvo: number, duracaoMs = DURACAO_PADRAO_MS): number {
  const [valor, setValor] = useState(() => (temMovimentoReduzido() ? alvo : 0));
  const quadroRef = useRef<number | null>(null);

  useEffect(() => {
    const duracao = temMovimentoReduzido() ? 0 : duracaoMs;
    const inicio = performance.now();

    const passo = (agora: number) => {
      const progresso = progressoDaAnimacao(agora - inicio, duracao);
      setValor(valorNaAnimacao(alvo, progresso));
      if (progresso < 1) quadroRef.current = requestAnimationFrame(passo);
    };

    quadroRef.current = requestAnimationFrame(passo);
    return () => {
      if (quadroRef.current !== null) cancelAnimationFrame(quadroRef.current);
    };
  }, [alvo, duracaoMs]);

  return valor;
}

/**
 * `matchMedia` pode não existir — jsdom nos testes, e navegador antigo.
 *
 * O padrão na dúvida é "sem movimento reduzido", que é o comportamento normal;
 * o contrário faria a animação sumir em toda máquina onde a consulta falhasse.
 */
function temMovimentoReduzido(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
