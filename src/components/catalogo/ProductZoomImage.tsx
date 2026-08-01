import { useCallback, useRef, useState } from "react";
import { ZoomIn } from "lucide-react";
import { ProductImageFrame } from "@/components/catalogo/ProductImageFrame";
import { PRODUCT_IMAGE_TARGET_WIDTH } from "@/lib/productImageNormalization";
import { TEXT } from "@/lib/typography";
import type { ProductImageFit } from "@/lib/products";
import { cn } from "@/lib/utils";

/**
 * Zoom na foto do produto, no ponto onde o mouse esta.
 *
 * A pesquisa da Baymard e direta: 56% das pessoas mexem nas fotos antes de
 * qualquer outra coisa na pagina do produto, e cerca de 11% das lojas oferecem
 * um zoom que nao serve. O que separa um do outro nao e o mecanismo — hover ou
 * clique funcionam igual — e sim a imagem ampliada sair **nitida**, e nao um
 * borrao esticado.
 *
 * Por isso o fator maximo aqui e calculado, nao escolhido: a foto e entregue com
 * 1280px de largura e aparece com cerca de 456px, entao acima de 2,8x o
 * navegador passaria a inventar pixel. `MAX_ZOOM` fica logo abaixo disso.
 *
 * O zoom acontece dentro da propria moldura, sem lupa flutuante nem painel ao
 * lado: nada muda de lugar na pagina, e o ponto ampliado e exatamente o que
 * esta sob o cursor.
 */

/** Largura tipica da foto na pagina do produto, usada para achar o teto de zoom. */
const DISPLAY_WIDTH = 456;

/** Acima disso o navegador amplia o arquivo e a nitidez cai — o oposto do zoom. */
const MAX_ZOOM = Math.floor((PRODUCT_IMAGE_TARGET_WIDTH / DISPLAY_WIDTH) * 10) / 10;

export function ProductZoomImage({
  src,
  alt,
  fit,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  fit?: ProductImageFit;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  const handleMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    // Posicao do cursor dentro da moldura, em porcentagem: e o mesmo sistema do
    // `transform-origin`, entao o ponto ampliado fica exatamente sob o cursor.
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setOrigin({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  }, []);

  const isZooming = origin !== null;

  return (
    <div
      ref={frameRef}
      // Sem tratamento especial para toque: `mousemove` nao dispara ali, entao
      // a camada ampliada simplesmente nunca aparece. Em tela sensivel ao toque
      // tambem nao faria sentido — o dedo cobriria o ponto ampliado.
      className={cn("group relative overflow-hidden", className)}
      onMouseMove={handleMove}
      onMouseLeave={() => setOrigin(null)}
    >
      <ProductImageFrame
        src={src}
        alt={alt}
        fit={fit}
        width={1280}
        height={1600}
        fetchPriority="high"
        className="aspect-[4/5]"
        imageClassName={cn(
          // A transicao fica so na entrada e na saida do zoom. Animar o
          // deslocamento faria a imagem correr atras do cursor.
          "transition-transform duration-200 ease-out will-change-transform",
          isZooming && "duration-100",
        )}
      />

      {/* Camada ampliada por cima: mantem a de baixo intacta, entao a troca
          entre normal e ampliado nao pisca. */}
      {src ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 bg-background transition-opacity duration-150",
            isZooming ? "opacity-100" : "opacity-0",
          )}
          style={{
            backgroundImage: `url(${src})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${MAX_ZOOM * 100}%`,
            backgroundPosition: origin ? `${origin.x}% ${origin.y}%` : "center",
          }}
        />
      ) : null}

      {src ? (
        <span
          className={cn(
            TEXT.caption,
            "pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/95 px-3 py-1.5 font-medium text-foreground shadow-sm transition-opacity",
            isZooming ? "opacity-0" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <ZoomIn className="h-3.5 w-3.5 text-primary" />
          Passe o mouse para ampliar
        </span>
      ) : null}
    </div>
  );
}
