import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PRODUCT_IMAGE_MIN_SIZE,
  PRODUCT_IMAGE_TARGET_HEIGHT,
  PRODUCT_IMAGE_TARGET_WIDTH,
} from "@/lib/productImageNormalization";
import {
  PRODUCT_IMAGE_FIT_LABELS,
  PRODUCT_MAX_IMAGES,
  type ProductImageFit,
} from "@/lib/products";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

/** Fotos por produto. Mantido num valor compartilhado para nao divergir da tela de admin. */
const MAX_IMAGENS = PRODUCT_MAX_IMAGES;

// Tamanhos aproximados dos tres lugares onde a capa aparece no catalogo.
const CONTEXT_PREVIEWS = [
  { label: "Card do catálogo", className: "h-[11rem] w-[8.8rem]" },
  { label: "Miniatura", className: "h-20 w-16" },
  { label: "Busca", className: "h-[3.4rem] w-11" },
] as const;

type Props = {
  urls: string[];
  alts: string[];
  imageFit: ProductImageFit;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAt: (index: number) => Promise<void>;
  onMoveAt: (from: number, to: number) => void;
  onAltChange: (index: number, alt: string) => void;
  onImageFitChange: (fit: ProductImageFit) => void;
};

export function ProductImageCarouselEditor({
  urls,
  alts,
  imageFit,
  uploading,
  fileInputRef,
  onFileChange,
  onRemoveAt,
  onMoveAt,
  onAltChange,
  onImageFitChange,
}: Props) {
  const [api, setApi] = useState<CarouselApi>();
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSlideIndex(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  useEffect(() => {
    if (urls.length === 0) {
      setSlideIndex(0);
      return;
    }
    if (slideIndex >= urls.length) {
      const next = urls.length - 1;
      setSlideIndex(next);
      api?.scrollTo(next);
    }
  }, [urls.length, slideIndex, api]);

  const safeIndex = urls.length > 0 ? Math.min(slideIndex, urls.length - 1) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium">Imagens do produto</Label>
        <span className="text-xs text-muted-foreground">{urls.length}/{MAX_IMAGENS} imagens</span>
      </div>

      {/* A especificacao fica na tela, e nao num documento a parte: quem sobe a
          foto precisa saber o que entregar no momento em que esta entregando. */}
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Como enviar a foto
        </p>
        <ul className="mt-2 space-y-1 text-xs leading-5 text-foreground">
          <li>
            <span className="font-medium">
              {PRODUCT_IMAGE_TARGET_WIDTH} × {PRODUCT_IMAGE_TARGET_HEIGHT} px
            </span>{" "}
            (4:5 retrato) · mínimo {PRODUCT_IMAGE_MIN_SIZE} px no menor lado
          </li>
          <li>
            <span className="font-medium">Capa sempre em fundo branco puro</span> ou PNG transparente — é ela que
            aparece na grade e na busca
          </li>
          <li>
            Produto ocupando <span className="font-medium">~85% do quadro</span>: margem sobrando faz o produto
            parecer pequeno no card
          </li>
          <li>Fotos com cenário entram a partir da foto 2, dentro da página do produto</li>
        </ul>
      </div>

      {/* Decide entre encaixar a foto por dentro da moldura ou preenche-la: e o
          que impede a foto ambientada de aparecer com faixas vazias em volta. */}
      <div className="rounded-2xl border border-border/70 bg-background p-3">
        <Label className="text-[0.8125rem] font-medium">Como esta foto deve preencher a moldura</Label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(Object.keys(PRODUCT_IMAGE_FIT_LABELS) as ProductImageFit[]).map((fit) => (
            <button
              key={fit}
              type="button"
              onClick={() => onImageFitChange(fit)}
              aria-pressed={imageFit === fit}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left text-xs leading-5 transition-colors",
                imageFit === fit
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border/70 bg-background text-muted-foreground hover:border-primary/40",
              )}
            >
              <span className="block font-medium text-foreground">
                {fit === "contain" ? "Packshot" : "Ambientada"}
              </span>
              <span className="block">
                {fit === "contain"
                  ? "Produto recortado, fundo branco ou transparente."
                  : "A foto já tem cenário e deve preencher todo o quadro."}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[32rem] overflow-hidden rounded-xl border border-border bg-background">
        {urls.length === 0 ? (
          <div className="flex aspect-[4/5] items-center justify-center bg-background p-4">
            <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
          </div>
        ) : urls.length === 1 ? (
          <div className="relative aspect-[4/5] bg-background p-1.5">
            <span className="absolute left-2 top-2 z-10 rounded-md bg-foreground/80 px-1.5 py-0.5 text-[0.625rem] font-semibold text-background shadow-sm">
              Capa
            </span>
            <img src={urls[0]} alt="" className={cn("h-full w-full", imageFit === "cover" ? "object-cover" : "object-contain p-1")} />
          </div>
        ) : (
          <Carousel className="w-full" opts={{ loop: true }} setApi={setApi}>
            <CarouselContent className="-ml-0">
              {urls.map((src, i) => (
                <CarouselItem key={`${src}-${i}`} className="basis-full pl-0">
                  <div className="relative aspect-[4/5] bg-background p-1.5">
                    {i === 0 && (
                      <span className="absolute left-2 top-2 z-10 rounded-md bg-foreground/80 px-1.5 py-0.5 text-[0.625rem] font-semibold text-background shadow-sm">
                        Capa
                      </span>
                    )}
                    <img src={src} alt="" className={cn("h-full w-full", imageFit === "cover" ? "object-cover" : "object-contain p-1")} />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-2 h-8 w-8 border-0 bg-background/90 shadow-md" />
            <CarouselNext className="right-2 h-8 w-8 border-0 bg-background/90 shadow-md" />
          </Carousel>
        )}

        {urls.length > 1 && (
          <span className="absolute bottom-2 right-2 rounded-md bg-background/90 px-2 py-0.5 text-xs text-muted-foreground shadow-sm">
            {safeIndex + 1} / {urls.length}
          </span>
        )}
        {urls.length === 1 && (
          <span className="absolute bottom-2 right-2 rounded-md bg-background/90 px-2 py-0.5 text-xs text-muted-foreground shadow-sm">
            1 / 1
          </span>
        )}
      </div>

      {/* A capa nos tres tamanhos reais em que o cliente vai encontra-la. Ver o
          recorte no contexto evita descobrir o problema so depois de publicar. */}
      {urls.length > 0 ? (
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Como a capa vai aparecer
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            {CONTEXT_PREVIEWS.map((preview) => (
              <div key={preview.label} className="space-y-1.5">
                <div
                  className={cn(
                    "overflow-hidden rounded-lg border border-border/70 bg-background",
                    preview.className,
                  )}
                >
                  <img
                    src={urls[0]}
                    alt=""
                    className={cn(
                      "h-full w-full",
                      imageFit === "cover" ? "object-cover" : "object-contain p-1",
                    )}
                  />
                </div>
                <p className="text-center text-[0.625rem] leading-4 text-muted-foreground">{preview.label}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {urls.length > 0 && (
        <div className="mx-auto flex w-full justify-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {urls.map((src, index) => {
            const isFirst = index === 0;
            const isLast = index === urls.length - 1;

            return (
              <div key={`${src}-${index}`} className="w-[9.5rem] shrink-0 overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm sm:w-[10.5rem] lg:w-[11.5rem]">
                <div className="relative aspect-square bg-muted/20">
                  <img
                    src={src}
                    alt=""
                    className={cn("h-full w-full p-1.5", imageFit === "cover" ? "object-cover p-0" : "object-contain")}
                  />

                  <div className="absolute left-2 top-2 rounded-md bg-foreground/80 px-1.5 py-0.5 text-[0.625rem] font-semibold text-background shadow-sm">
                    {isFirst ? "Capa" : `Foto ${index + 1}`}
                  </div>
                </div>

                <div className="border-t border-border/70 bg-background p-1.5">
                  <Input
                    value={alts[index] ?? ""}
                    onChange={(event) => onAltChange(index, event.target.value)}
                    maxLength={120}
                    placeholder={isFirst ? "Descreva a capa" : `Descreva a foto ${index + 1}`}
                    className="h-8 rounded-lg border-border/70 bg-background text-[0.6875rem]"
                    aria-label={`Descrição da foto ${index + 1}`}
                  />
                </div>

                <div className="flex items-center justify-between gap-1 border-t border-border/70 bg-background p-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-9 sm:h-7 w-9 sm:w-7 rounded-md shadow-sm"
                    disabled={uploading || isFirst}
                    onClick={() => onMoveAt(index, index - 1)}
                    aria-label={`Mover foto ${index + 1} para a esquerda`}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-9 sm:h-7 w-9 sm:w-7 rounded-md shadow-sm"
                    disabled={uploading || isLast}
                    onClick={() => onMoveAt(index, index + 1)}
                    aria-label={`Mover foto ${index + 1} para a direita`}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-9 sm:h-7 w-9 sm:w-7 rounded-md shadow-sm"
                    disabled={uploading}
                    onClick={async () => {
                      await onRemoveAt(index);
                    }}
                    aria-label={`Remover foto ${index + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || urls.length >= MAX_IMAGENS}
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Enviando..." : "Adicionar foto"}
        </Button>
        {urls.length >= MAX_IMAGENS && (
          <span className="text-xs text-muted-foreground">Máximo de {MAX_IMAGENS} imagens</span>
        )}
        {urls.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-destructive"
            disabled={uploading}
            onClick={async () => {
              await onRemoveAt(safeIndex);
            }}
          >
            <X className="h-3 w-3" /> Remover foto atual
          </Button>
        )}
      </div>
    </div>
  );
}
