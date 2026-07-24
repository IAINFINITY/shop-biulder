import { useCallback, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ProductGalleryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  images: string[];
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
};

export function ProductGalleryModal({
  open,
  onOpenChange,
  title,
  images,
  selectedIndex,
  onSelectedIndexChange,
}: ProductGalleryModalProps) {
  const [zoomPoint, setZoomPoint] = useState({ x: 50, y: 50 });
  const [isZoomEnabled, setIsZoomEnabled] = useState(false);

  const selectedImage = images[selectedIndex] ?? images[0] ?? null;

  const handleMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isZoomEnabled) return;

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const nextX = ((event.clientX - rect.left) / rect.width) * 100;
    const nextY = ((event.clientY - rect.top) / rect.height) * 100;

    setZoomPoint({
      x: Math.min(100, Math.max(0, nextX)),
      y: Math.min(100, Math.max(0, nextY)),
    });
  }, [isZoomEnabled]);

  if (!selectedImage || images.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(88vh,760px)] w-[min(92vw,1120px)] max-w-[1120px] overflow-hidden rounded-[1.5rem] border-border/70 p-0">
        <DialogHeader className="border-b border-border/70 px-4 py-3 sm:px-5 sm:py-3.5">
          <DialogTitle className="text-left text-[1rem] font-black tracking-[-0.04em] text-foreground sm:text-[1.1rem]">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 xl:grid-cols-[180px_minmax(0,1fr)]">
          <div className="border-b border-border/70 bg-muted/20 p-3 xl:border-b-0 xl:border-r xl:p-3.5">
            <div className="flex gap-2 overflow-x-auto xl:h-full xl:flex-col xl:overflow-y-auto xl:pr-1">
              {images.map((src, index) => (
                <button
                  key={`${src}-${index}`}
                  type="button"
                  onClick={() => onSelectedIndexChange(index)}
                  className={cn(
                    "flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-background p-1.5 shadow-sm transition-all xl:h-[4.75rem] xl:w-full xl:max-w-[9rem]",
                    index === selectedIndex ? "border-primary ring-2 ring-primary/20" : "border-border/70 hover:border-primary/40",
                  )}
                  aria-label={`Ver imagem ${index + 1}`}
                >
                  <img src={src} alt="" width={240} height={240} loading="lazy" decoding="async" className="h-full w-full rounded-xl object-contain" />
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 bg-background p-3.5 xl:p-4">
            <div
              className="relative flex h-full min-h-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-[1.5rem] border border-border/70 bg-background"
              onMouseLeave={() => {
                setZoomPoint({ x: 50, y: 50 });
              }}
              onMouseMove={handleMove}
            >
              <img
                src={selectedImage}
                alt={title}
                width={1200}
                height={900}
                className="h-full w-full max-h-[68vh] object-contain p-3 transition-transform duration-200"
                style={{
                  transform: isZoomEnabled ? "scale(1.55)" : "scale(1)",
                  transformOrigin: `${zoomPoint.x}% ${zoomPoint.y}%`,
                }}
              />

              <button
                type="button"
                className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/95 px-3 py-2 text-[11px] font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
                onClick={() => setIsZoomEnabled((value) => !value)}
                aria-pressed={isZoomEnabled}
                aria-label={isZoomEnabled ? "Desativar zoom" : "Ativar zoom"}
              >
                <ZoomIn className="h-4 w-4" />
                {isZoomEnabled ? "Zoom ativo" : "Ampliar"}
              </button>

              {isZoomEnabled && (
                <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-border/70 bg-background/95 px-3 py-2 text-[11px] font-medium text-foreground shadow-sm">
                  Mova o mouse para ajustar
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
