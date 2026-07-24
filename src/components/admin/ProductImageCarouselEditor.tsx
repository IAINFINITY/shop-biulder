import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

type Props = {
  urls: string[];
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAt: (index: number) => Promise<void>;
  onMoveAt: (from: number, to: number) => void;
};

export function ProductImageCarouselEditor({
  urls,
  uploading,
  fileInputRef,
  onFileChange,
  onRemoveAt,
  onMoveAt,
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
        <span className="text-xs text-muted-foreground">{urls.length}/5 imagens</span>
      </div>

      <div className="relative mx-auto w-full max-w-[32rem] overflow-hidden rounded-xl border border-border bg-background">
        {urls.length === 0 ? (
          <div className="flex aspect-[5/4] items-center justify-center bg-background p-4">
            <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
          </div>
        ) : urls.length === 1 ? (
          <div className="relative aspect-[5/4] bg-background p-3">
            <span className="absolute left-2 top-2 z-10 rounded-md bg-foreground/80 px-1.5 py-0.5 text-[10px] font-semibold text-background shadow-sm">
              Capa
            </span>
            <img src={urls[0]} alt="" className="h-full w-full object-contain p-1" />
          </div>
        ) : (
          <Carousel className="w-full" opts={{ loop: true }} setApi={setApi}>
            <CarouselContent className="-ml-0">
              {urls.map((src, i) => (
                <CarouselItem key={`${src}-${i}`} className="basis-full pl-0">
                  <div className="relative aspect-[5/4] bg-background p-3">
                    {i === 0 && (
                      <span className="absolute left-2 top-2 z-10 rounded-md bg-foreground/80 px-1.5 py-0.5 text-[10px] font-semibold text-background shadow-sm">
                        Capa
                      </span>
                    )}
                    <img src={src} alt="" className="h-full w-full object-contain p-1" />
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

      {urls.length > 0 && (
        <div className="mx-auto flex w-full justify-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {urls.map((src, index) => {
            const isFirst = index === 0;
            const isLast = index === urls.length - 1;

            return (
              <div key={`${src}-${index}`} className="w-[9.5rem] shrink-0 overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm sm:w-[10.5rem] lg:w-[11.5rem]">
                <div className="relative aspect-square bg-muted/20">
                  <img src={src} alt="" className="h-full w-full object-contain p-1.5" />

                  <div className="absolute left-2 top-2 rounded-md bg-foreground/80 px-1.5 py-0.5 text-[10px] font-semibold text-background shadow-sm">
                    {isFirst ? "Capa" : `Foto ${index + 1}`}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1 border-t border-border/70 bg-background p-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 rounded-md shadow-sm"
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
                    className="h-7 w-7 rounded-md shadow-sm"
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
                    className="h-7 w-7 rounded-md shadow-sm"
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
          disabled={uploading || urls.length >= 5}
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Enviando..." : "Adicionar foto"}
        </Button>
        {urls.length >= 5 && <span className="text-xs text-muted-foreground">Máximo de 5 imagens</span>}
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
