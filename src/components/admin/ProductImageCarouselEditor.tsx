import { useEffect, useState } from "react";
import { ImageIcon, Upload, X } from "lucide-react";
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
  onRemoveAt: (index: number) => void;
};

export function ProductImageCarouselEditor({
  urls,
  uploading,
  fileInputRef,
  onFileChange,
  onRemoveAt,
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
      api.scrollTo(next);
    }
  }, [urls.length, slideIndex, api]);

  const safeIndex = urls.length > 0 ? Math.min(slideIndex, urls.length - 1) : 0;

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Imagens do produto</Label>

      <div className="relative max-w-sm overflow-hidden rounded-xl border border-border bg-background">
        {urls.length === 0 ? (
          <div className="flex aspect-[4/3] items-center justify-center bg-background p-6">
            <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
          </div>
        ) : urls.length === 1 ? (
          <div className="relative aspect-[4/3] bg-background p-4">
            <span className="absolute left-2 top-2 z-10 rounded-md bg-foreground/80 px-1.5 py-0.5 text-[10px] font-semibold text-background shadow-sm">
              Capa
            </span>
            <img src={urls[0]} alt="" className="h-full w-full object-contain" />
          </div>
        ) : (
          <Carousel className="w-full" opts={{ loop: true }} setApi={setApi}>
            <CarouselContent className="-ml-0">
              {urls.map((src, i) => (
                <CarouselItem key={`${src}-${i}`} className="basis-full pl-0">
                  <div className="relative aspect-[4/3] bg-background p-4">
                    {i === 0 && (
                      <span className="absolute left-2 top-2 z-10 rounded-md bg-foreground/80 px-1.5 py-0.5 text-[10px] font-semibold text-background shadow-sm">
                        Capa
                      </span>
                    )}
                    <img src={src} alt="" className="h-full w-full object-contain" />
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
            {safeIndex + 1} / 5
          </span>
        )}
        {urls.length === 1 && (
          <span className="absolute bottom-2 right-2 rounded-md bg-background/90 px-2 py-0.5 text-xs text-muted-foreground shadow-sm">
            1 / 5
          </span>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => fileInputRef.current.click()}
          disabled={uploading || urls.length >= 5}
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Enviando..." : "Adicionar foto"}
        </Button>
        {urls.length >= 5 && (
          <span className="text-xs text-muted-foreground">Máximo de 5 imagens</span>
        )}
        {urls.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-destructive"
            disabled={uploading}
            onClick={() => onRemoveAt(safeIndex)}
          >
            <X className="h-3 w-3" /> Remover esta foto
          </Button>
        )}
      </div>
    </div>
  );
}
