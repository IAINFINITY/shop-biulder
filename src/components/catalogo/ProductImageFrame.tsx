import { ImageIcon } from "lucide-react";
import type { ProductImageFit } from "@/lib/products";
import { cn } from "@/lib/utils";

/**
 * Moldura da foto de produto — sempre preenchida de ponta a ponta.
 *
 * Foto com fundo proprio dentro de um quadro com margem branca deixa uma emenda
 * visivel, e o produto parece recortado. Aqui nao ha margem: a foto vai de borda
 * a borda.
 *
 * Quem fecha o quadro e o upload, nao esta tela: a foto e entregue ao storage ja
 * em 4:5, com o entorno preenchido pela propria borda dela — ver
 * `productImageNormalization.ts`. Entao `object-cover` preenche sem cortar nada,
 * porque nao ha sobra para cortar. Fotos antigas, subidas antes disso, ainda
 * chegam em proporcao qualquer e sao ajustadas pelo `cover` ate passarem pelo
 * `scripts/normalize-stored-images.mjs`.
 */
export function ProductImageFrame({
  src,
  alt,
  fit = "cover",
  className,
  imageClassName,
  width,
  height,
  loading,
  fetchPriority,
  children,
}: {
  src: string | null | undefined;
  alt: string;
  /** `contain` fica para foto que nao pode perder nada nas bordas. */
  fit?: ProductImageFit;
  /** Classes da moldura: proporcao, raio e afins. */
  className?: string;
  imageClassName?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
  /** Repassado ao DOM como `fetchpriority` — ver a nota no `<img>`. */
  fetchPriority?: "high" | "low" | "auto";
  children?: React.ReactNode;
}) {
  const source = typeof src === "string" ? src.trim() : "";

  if (!source) {
    return (
      <div className={cn("relative flex items-center justify-center overflow-hidden bg-muted/20", className)}>
        <ImageIcon className="h-1/4 w-1/4 max-h-16 max-w-16 text-muted-foreground/30" />
        {children}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted/10", className)}>
      <img
        src={source}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        // Minusculo de proposito: o React 18 nao reconhece `fetchPriority` em
        // camelCase, avisa no console e nao emite o atributo. O React 19 passa a
        // aceitar as duas formas, entao isso pode voltar a ser camelCase quando
        // o projeto subir de versao.
        {...(fetchPriority ? { fetchpriority: fetchPriority } : {})}
        decoding="async"
        className={cn(
          "h-full w-full object-center",
          fit === "contain" ? "object-contain" : "object-cover",
          imageClassName,
        )}
      />
      {children}
    </div>
  );
}
