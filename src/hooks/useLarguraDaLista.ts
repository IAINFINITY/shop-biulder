import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A largura da lista de conversas: arrastável e lembrada.
 *
 * ## Por que existe
 *
 * A coluna tinha `md:w-[330px]` fixo. Nomes de empresa aqui são longos de
 * verdade — "DERM NAT FARMACIA DE MANIPULACAO LTDA - EM RECUPERACAO JUDICIAL"
 * são 63 caracteres — e em 330px todo cliente vira reticências. Quem atende num
 * monitor grande tem espaço de sobra e não podia usá-lo; quem atende num
 * notebook queria o contrário.
 *
 * ⚠️ **Guardada no navegador, não no servidor.** É preferência de *tela*: a
 * mesma pessoa no notebook e no monitor de 27" quer larguras diferentes.
 * Sincronizar entre máquinas atrapalharia em vez de ajudar.
 *
 * ## ⚠️ Durante o arraste o React fica de fora
 *
 * A forma óbvia — `setLargura` a cada `pointermove` — re-renderiza o workspace
 * inteiro, e com ele a lista de conversas, a cada evento. Mouse de 1000 Hz
 * manda ~8 eventos por quadro de 60 Hz: são 8 renders para 1 quadro desenhado.
 *
 * Aqui o movimento escreve **direto no DOM** (a variável CSS abaixo) dentro de
 * um `requestAnimationFrame`, sem passar por estado. O React entra **uma vez**,
 * ao soltar. É a diferença entre um render por evento e um render por gesto.
 *
 * O mesmo vale para o `localStorage`: gravar a cada pixel seria escrita
 * síncrona no meio do gesto. Grava ao soltar.
 */

const CHAVE = "clinic-b2b:largura-lista-conversas";

/**
 * O arraste escreve nesta variavel CSS, e nao em `style.width`.
 *
 * ⚠️ E o que faz a largura valer **so do `md` para cima**. No celular a lista e
 * a tela inteira; um `width: 412px` cravado no elemento a deixaria estreita no
 * meio do nada, e sem forma de desfazer — o proprio puxador e `hidden md:block`,
 * entao ninguem conseguiria arrastar de volta.
 *
 * Com a variavel, quem decide se ela e usada e o CSS: `md:w-[var(--largura-lista)]`.
 */
export const VARIAVEL_DA_LARGURA = "--largura-lista";

/** Abaixo do mínimo o conteúdo some; acima do máximo o fio fica espremido. */
export const LARGURA_MINIMA = 260;
export const LARGURA_MAXIMA = 560;
export const LARGURA_PADRAO = 330;

const dentroDosLimites = (valor: number) => Math.min(LARGURA_MAXIMA, Math.max(LARGURA_MINIMA, valor));

function ler(): number {
  try {
    const cru = window.localStorage.getItem(CHAVE);
    const numero = cru == null ? NaN : Number(cru);
    // Valor gravado por uma versão antiga, ou lixo: cai no padrão em vez de
    // deixar a tela quebrada.
    if (!Number.isFinite(numero)) return LARGURA_PADRAO;
    return dentroDosLimites(numero);
  } catch {
    // Navegador com storage bloqueado: a largura vale só para esta sessão.
    return LARGURA_PADRAO;
  }
}

export function useLarguraDaLista() {
  const [largura, setLargura] = useState(LARGURA_PADRAO);
  const [arrastando, setArrastando] = useState(false);

  /** O `<aside>`. É nele que o arraste escreve, sem passar pelo React. */
  const alvo = useRef<HTMLElement | null>(null);
  const gesto = useRef({ x: 0, inicial: LARGURA_PADRAO, atual: LARGURA_PADRAO });

  // Só depois de montar: `localStorage` não existe na renderização do servidor
  // nem num jsdom limpo.
  useEffect(() => {
    setLargura(ler());
  }, []);

  const guardar = useCallback((valor: number) => {
    try {
      window.localStorage.setItem(CHAVE, String(valor));
    } catch {
      /* sem storage: a largura vale só para esta sessão */
    }
  }, []);

  const aoPegar = useCallback(
    (evento: React.PointerEvent) => {
      evento.preventDefault();
      const atual = alvo.current?.getBoundingClientRect().width ?? largura;
      gesto.current = { x: evento.clientX, inicial: atual, atual };
      setArrastando(true);
      (evento.target as HTMLElement).setPointerCapture?.(evento.pointerId);
    },
    [largura],
  );

  useEffect(() => {
    if (!arrastando) return;

    const elemento = alvo.current;
    let quadro = 0;
    let pendente = gesto.current.atual;

    const pintar = () => {
      quadro = 0;
      if (elemento) elemento.style.setProperty(VARIAVEL_DA_LARGURA, `${pendente}px`);
      gesto.current.atual = pendente;
    };

    const mover = (evento: PointerEvent) => {
      pendente = dentroDosLimites(gesto.current.inicial + (evento.clientX - gesto.current.x));
      if (!quadro) quadro = window.requestAnimationFrame(pintar);
    };

    const soltar = () => {
      if (quadro) {
        window.cancelAnimationFrame(quadro);
        pintar();
      }
      setArrastando(false);
      // Agora sim o React sabe — uma vez, no fim do gesto.
      setLargura(gesto.current.atual);
      guardar(gesto.current.atual);
    };

    window.addEventListener("pointermove", mover, { passive: true });
    window.addEventListener("pointerup", soltar);
    // `pointercancel` também solta: sem ele, um gesto interrompido pelo sistema
    // (a janela perdendo foco, o toque virando rolagem) deixaria a barra grudada
    // no cursor até o próximo clique.
    window.addEventListener("pointercancel", soltar);

    // Enquanto arrasta, o cursor não muda ao passar por cima de outra coisa e
    // nada é selecionado. Sem isto o gesto vira seleção de texto na lista assim
    // que o ponteiro sai da alça.
    const corpo = document.body.style;
    const cursorAntes = corpo.cursor;
    const selecaoAntes = corpo.userSelect;
    corpo.cursor = "col-resize";
    corpo.userSelect = "none";

    return () => {
      if (quadro) window.cancelAnimationFrame(quadro);
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      corpo.cursor = cursorAntes;
      corpo.userSelect = selecaoAntes;
    };
  }, [arrastando, guardar]);

  const aplicar = useCallback(
    (valor: number) => {
      const novo = dentroDosLimites(valor);
      setLargura(novo);
      guardar(novo);
      if (alvo.current) alvo.current.style.setProperty(VARIAVEL_DA_LARGURA, `${novo}px`);
      return novo;
    },
    [guardar],
  );

  /** Volta ao padrão — o duplo clique na barra. */
  const reiniciar = useCallback(() => aplicar(LARGURA_PADRAO), [aplicar]);

  /** Teclado: a barra precisa funcionar sem mouse. */
  const aoTeclar = useCallback(
    (evento: React.KeyboardEvent) => {
      if (evento.key !== "ArrowLeft" && evento.key !== "ArrowRight") return;
      evento.preventDefault();
      const passo = evento.shiftKey ? 40 : 10;
      aplicar(largura + (evento.key === "ArrowRight" ? passo : -passo));
    },
    [aplicar, largura],
  );

  return { largura, arrastando, alvo, aoPegar, aoTeclar, reiniciar };
}
