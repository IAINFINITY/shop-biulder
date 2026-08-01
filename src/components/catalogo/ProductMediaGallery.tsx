import { ImageIcon } from "lucide-react";
import { ProductImageFrame } from "@/components/catalogo/ProductImageFrame";
import { ProductZoomImage } from "@/components/catalogo/ProductZoomImage";
import { TEXT } from "@/lib/typography";
import type { Product } from "@/lib/products";
import { getProductImageAlt } from "@/lib/products";
import { cn } from "@/lib/utils";

/**
 * Bloco de fotos da pagina do produto: tira de miniaturas na lateral e foto
 * grande ao lado.
 *
 * Mora aqui, e nao dentro da pagina, porque a previa do admin precisa mostrar
 * exatamente isto. Enquanto a previa remontava o bloco por conta propria, ela
 * dizia uma coisa e a loja mostrava outra — miniaturas embaixo em vez de ao
 * lado, outra proporcao, outro espacamento. Quem edita conferia num arranjo que
 * nao existe.
 *
 * E o mesmo principio da Shopify, que nao desenha uma previa: ela abre a loja
 * de verdade.
 *
 * A foto grande amplia no ponto do cursor — ver `ProductZoomImage`.
 */
export function ProductMediaGallery({
  product,
  urls,
  selectedIndex,
  onSelect,
  className,
}: {
  product: Product;
  urls: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}) {
  const selected = urls[selectedIndex] ?? urls[0];

  if (urls.length === 0) {
    return (
      <div className={cn("flex aspect-[4/5] w-full items-center justify-center rounded-[1.35rem] border border-border/70 bg-muted/20", className)}>
        <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    // `items-start`: sem isso o flex estica os dois itens ate a altura do mais
    // alto. Com muitas miniaturas a coluna lateral passa a foto, a moldura 4:5
    // nao acompanha, e a borda fica desenhada em volta de um vazio.
    <div className={cn("flex items-start gap-3", className)}>
      {urls.length > 1 ? (
        <div className="flex max-h-[35rem] w-[4.75rem] shrink-0 flex-col gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {urls.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              onClick={() => onSelect(index)}
              aria-label={`Ver imagem ${index + 1}`}
              aria-current={index === selectedIndex ? "true" : undefined}
              className={cn(
                "w-full shrink-0 overflow-hidden rounded-xl border transition-all",
                index === selectedIndex
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border/70 hover:border-primary/40",
              )}
            >
              <ProductImageFrame
                src={src}
                alt=""
                fit={product.image_fit}
                width={1280}
                height={1600}
                loading="lazy"
                className="aspect-[4/5]"
              />
            </button>
          ))}
        </div>
      ) : null}

      {/* Zoom no lugar do modal: o modal so existia porque a foto era pequena
          demais para se olhar de perto. Com 1280px de largura, ampliar dentro da
          propria moldura mostra mais detalhe sem tirar ninguem da pagina. */}
      <ProductZoomImage
        src={selected}
        alt={getProductImageAlt(product, selectedIndex)}
        fit={product.image_fit}
        className="w-full rounded-[1.35rem] border border-border/70"
      />
    </div>
  );
}
