import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRodizioAutomatico } from "@/hooks/useRodizioAutomatico";

const INTERVALO = 5500;

function montar(inicial: { pausado?: boolean; ativo?: boolean; reiniciarEm?: unknown } = {}) {
  const avancar = vi.fn();
  const view = renderHook(
    (props: { pausado: boolean; ativo: boolean; reiniciarEm: unknown }) =>
      useRodizioAutomatico({ ...props, intervaloMs: INTERVALO, avancar }),
    {
      initialProps: {
        pausado: inicial.pausado ?? false,
        ativo: inicial.ativo ?? true,
        reiniciarEm: inicial.reiniciarEm ?? 0,
      },
    },
  );
  return { avancar, view };
}

describe("useRodizioAutomatico", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("avança sozinho enquanto ninguém está lendo", () => {
    const { avancar } = montar();
    vi.advanceTimersByTime(INTERVALO * 2);
    expect(avancar).toHaveBeenCalledTimes(2);
  });

  it("para de avançar quando pausa", () => {
    // O relato que originou isto: segurar o mouse para ler e o banner virar
    // assim mesmo.
    const { avancar, view } = montar();
    view.rerender({ pausado: true, ativo: true, reiniciarEm: 0 });

    vi.advanceTimersByTime(INTERVALO * 3);
    expect(avancar).not.toHaveBeenCalled();
  });

  it("volta a avançar quando o cursor sai", () => {
    const { avancar, view } = montar({ pausado: true });
    vi.advanceTimersByTime(INTERVALO * 2);
    expect(avancar).not.toHaveBeenCalled();

    view.rerender({ pausado: false, ativo: true, reiniciarEm: 0 });
    vi.advanceTimersByTime(INTERVALO);
    expect(avancar).toHaveBeenCalledTimes(1);
  });

  it("ao despausar, dá a janela inteira e não o que sobrou", () => {
    // Se a contagem continuasse de onde parou, soltar o mouse podia virar o
    // slide quase na hora — exatamente o incômodo que a pausa existe para
    // evitar.
    const { avancar, view } = montar();
    vi.advanceTimersByTime(INTERVALO - 200);

    view.rerender({ pausado: true, ativo: true, reiniciarEm: 0 });
    vi.advanceTimersByTime(INTERVALO * 2);
    view.rerender({ pausado: false, ativo: true, reiniciarEm: 0 });

    vi.advanceTimersByTime(INTERVALO - 1);
    expect(avancar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(avancar).toHaveBeenCalledTimes(1);
  });

  it("trocar de slide reinicia a contagem", () => {
    // Clicar na seta para voltar e ler precisa dar a janela inteira, e não o
    // resto do ciclo anterior.
    const { avancar, view } = montar();
    vi.advanceTimersByTime(INTERVALO - 200);

    view.rerender({ pausado: false, ativo: true, reiniciarEm: 1 });
    vi.advanceTimersByTime(INTERVALO - 1);
    expect(avancar).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(avancar).toHaveBeenCalledTimes(1);
  });

  it("com um slide só não roda relógio nenhum", () => {
    const { avancar } = montar({ ativo: false });
    vi.advanceTimersByTime(INTERVALO * 5);
    expect(avancar).not.toHaveBeenCalled();
  });

  it("não reinicia a contagem a cada render", () => {
    // A função `avancar` chega nova a cada render de quem usa o hook. Se ela
    // entrasse nas dependências do efeito, o intervalo seria refeito sempre e
    // o slide nunca viraria — o carrossel ficaria parado sem ninguém entender.
    const { avancar, view } = montar();
    for (let i = 0; i < 20; i += 1) {
      vi.advanceTimersByTime(INTERVALO / 20);
      view.rerender({ pausado: false, ativo: true, reiniciarEm: 0 });
    }
    expect(avancar).toHaveBeenCalledTimes(1);
  });
});
