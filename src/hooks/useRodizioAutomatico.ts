import { useEffect, useRef } from "react";

export type RodizioAutomatico = {
  /** Ha o que girar. Com um slide so, nada deve acontecer. */
  ativo: boolean;
  /** Alguem esta lendo — cursor em cima ou foco dentro. */
  pausado: boolean;
  intervaloMs: number;
  /**
   * Muda a cada troca de slide e zera a contagem.
   *
   * Sem isto, clicar na seta para voltar e ler dava o tempo que sobrasse do
   * ciclo anterior — as vezes menos de um segundo. Com ele, todo slide comeca
   * com a janela inteira, tenha chegado sozinho ou por clique.
   */
  reiniciarEm: unknown;
  avancar: () => void;
};

/**
 * O rodizio de um carrossel, separado da tela que o usa.
 *
 * Estava dentro do `StoreHeroBanner`, enrolado no embla, e por isso nao havia
 * como testar sem layout de verdade. Aqui e so relogio: da para provar com
 * tempo falso que a pausa realmente segura e que a contagem reinicia.
 */
export function useRodizioAutomatico({
  ativo,
  pausado,
  intervaloMs,
  reiniciarEm,
  avancar,
}: RodizioAutomatico): void {
  // A funcao entra por `ref` para o efeito nao depender dela: quem chama passa
  // uma arrow nova a cada render, e isso refaria o intervalo o tempo todo —
  // com o relogio zerando junto, o slide nunca viraria.
  const avancarRef = useRef(avancar);
  avancarRef.current = avancar;

  useEffect(() => {
    if (!ativo || pausado) return;

    const id = setInterval(() => avancarRef.current(), intervaloMs);
    return () => clearInterval(id);
  }, [ativo, pausado, intervaloMs, reiniciarEm]);
}
