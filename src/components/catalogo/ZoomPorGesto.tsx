import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Zoom por gesto na foto do produto — pinca, toque duplo e arraste.
 *
 * O que existia no celular era o zoom do desktop remendado para toque: um botao
 * ligava a ampliacao num fator fixo e o dedo arrastava o ponto ampliado. Fora do
 * habito de qualquer pessoa que ja abriu uma foto no telefone, e com o agravante
 * de o dedo cobrir justamente o trecho que ampliou.
 *
 * Aqui o gesto e o do sistema: pinca para escolher **quanto**, toque duplo para
 * ir e voltar, arraste para escolher **onde**. Nenhum controle na tela.
 *
 * O zoom vive num `transform`, e nao em `background-size`, porque `transform` e
 * composto pela GPU — a pinca acompanha o dedo em vez de recalcular layout a
 * cada quadro.
 */

/** Acima disto o navegador inventa pixel: a foto e entregue com 1280px. */
const ESCALA_MAX = 3;

/** Para onde o toque duplo leva. Fica no meio da faixa util. */
const ESCALA_DUPLO_TOQUE = 2.5;

/** Dois toques dentro desta janela contam como toque duplo. */
const JANELA_DUPLO_TOQUE_MS = 300;

type Ponto = { x: number; y: number };

function distancia(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function ZoomPorGesto({
  src,
  alt,
  className,
  imageClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const [desloc, setDesloc] = useState<Ponto>({ x: 0, y: 0 });

  const pinca = useRef<{ distancia: number; escala: number } | null>(null);
  const arraste = useRef<{ toque: Ponto; desloc: Ponto } | null>(null);
  const ultimoToque = useRef(0);

  /**
   * Nao deixa a foto sair da moldura.
   *
   * Com escala `e`, a imagem passa a ser `e` vezes maior que a area; a sobra de
   * cada lado e metade disso. Arrastar alem disso descolaria a foto da borda e
   * mostraria fundo vazio.
   */
  const limitar = useCallback((proximoDesloc: Ponto, proximaEscala: number): Ponto => {
    const area = areaRef.current?.getBoundingClientRect();
    if (!area) return proximoDesloc;
    const folgaX = Math.max(0, (area.width * (proximaEscala - 1)) / 2);
    const folgaY = Math.max(0, (area.height * (proximaEscala - 1)) / 2);
    return {
      x: Math.min(folgaX, Math.max(-folgaX, proximoDesloc.x)),
      y: Math.min(folgaY, Math.max(-folgaY, proximoDesloc.y)),
    };
  }, []);

  const voltarAoNormal = useCallback(() => {
    setEscala(1);
    setDesloc({ x: 0, y: 0 });
  }, []);

  /** Leva o ponto tocado para o centro, para o toque duplo ampliar onde se pediu. */
  const ampliarNoPonto = useCallback(
    (clientX: number, clientY: number) => {
      const area = areaRef.current?.getBoundingClientRect();
      if (!area) return;
      const doCentroX = clientX - (area.left + area.width / 2);
      const doCentroY = clientY - (area.top + area.height / 2);
      setEscala(ESCALA_DUPLO_TOQUE);
      setDesloc(
        limitar(
          { x: -doCentroX * (ESCALA_DUPLO_TOQUE - 1), y: -doCentroY * (ESCALA_DUPLO_TOQUE - 1) },
          ESCALA_DUPLO_TOQUE,
        ),
      );
    },
    [limitar],
  );

  // Listeners nativos, e nao `onTouchMove` do React.
  //
  // O React registra o handler de toque como **passivo**, e num handler passivo
  // `preventDefault()` nao faz nada — a pagina rolava por baixo da pinca. Com
  // `{ passive: false }` o gesto fica contido na foto.
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;

    const aoIniciar = (evento: TouchEvent) => {
      if (evento.touches.length === 2) {
        pinca.current = { distancia: distancia(evento.touches[0], evento.touches[1]), escala };
        arraste.current = null;
        return;
      }

      if (evento.touches.length !== 1) return;
      const toque = evento.touches[0];

      const agora = evento.timeStamp;
      if (agora - ultimoToque.current < JANELA_DUPLO_TOQUE_MS) {
        evento.preventDefault();
        ultimoToque.current = 0;
        if (escala > 1) voltarAoNormal();
        else ampliarNoPonto(toque.clientX, toque.clientY);
        return;
      }
      ultimoToque.current = agora;

      if (escala > 1) {
        arraste.current = { toque: { x: toque.clientX, y: toque.clientY }, desloc };
      }
    };

    const aoMover = (evento: TouchEvent) => {
      if (evento.touches.length === 2 && pinca.current) {
        evento.preventDefault();
        const atual = distancia(evento.touches[0], evento.touches[1]);
        const proxima = Math.min(
          ESCALA_MAX,
          Math.max(1, (pinca.current.escala * atual) / pinca.current.distancia),
        );
        setEscala(proxima);
        setDesloc((anterior) => limitar(anterior, proxima));
        return;
      }

      if (evento.touches.length === 1 && arraste.current && escala > 1) {
        // So aqui `preventDefault`: com a foto no tamanho normal o dedo tem de
        // continuar deslizando o carrossel e rolando a pagina.
        evento.preventDefault();
        const toque = evento.touches[0];
        setDesloc(
          limitar(
            {
              x: arraste.current.desloc.x + (toque.clientX - arraste.current.toque.x),
              y: arraste.current.desloc.y + (toque.clientY - arraste.current.toque.y),
            },
            escala,
          ),
        );
      }
    };

    const aoTerminar = (evento: TouchEvent) => {
      if (evento.touches.length < 2) pinca.current = null;
      if (evento.touches.length === 0) {
        arraste.current = null;
        // Pinca que voltou ao tamanho normal reencaixa a foto no centro.
        if (escala <= 1.01) voltarAoNormal();
      }
    };

    area.addEventListener("touchstart", aoIniciar, { passive: false });
    area.addEventListener("touchmove", aoMover, { passive: false });
    area.addEventListener("touchend", aoTerminar);
    area.addEventListener("touchcancel", aoTerminar);

    return () => {
      area.removeEventListener("touchstart", aoIniciar);
      area.removeEventListener("touchmove", aoMover);
      area.removeEventListener("touchend", aoTerminar);
      area.removeEventListener("touchcancel", aoTerminar);
    };
  }, [ampliarNoPonto, desloc, escala, limitar, voltarAoNormal]);

  const ampliado = escala > 1.01;

  return (
    <div
      ref={areaRef}
      className={cn(
        "relative flex h-full min-h-0 items-center justify-center overflow-hidden",
        // `touch-none` so com zoom: no tamanho normal o dedo precisa continuar
        // deslizando o carrossel por baixo.
        ampliado ? "touch-none" : "touch-pan-y",
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        width={1600}
        height={1600}
        draggable={false}
        className={cn("h-full w-full select-none object-contain", imageClassName)}
        style={{
          transform: `translate(${desloc.x}px, ${desloc.y}px) scale(${escala})`,
          // Sem transicao durante a pinca: animar faria a foto correr atras do
          // dedo. Voltar ao normal, sim, porque ali o gesto ja acabou.
          transition: pinca.current || arraste.current ? "none" : "transform 180ms ease-out",
        }}
      />

      {!ampliado ? (
        <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground/70 px-3 py-1.5 text-[0.6875rem] font-medium text-background">
          Toque duas vezes ou use dois dedos para ampliar
        </span>
      ) : null}
    </div>
  );
}
