import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical, ImageIcon, Trash2, Upload, X } from "lucide-react";
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

  /**
   * Arrastar para reordenar.
   *
   * As setas ‹ › ja faziam isso e continuam. Elas nao bastavam: quem administra
   * a loja relatou que so sabia trocar a ordem apagando a foto e subindo de
   * novo — ou seja, o recurso existia e nao foi encontrado. Arrastar e o gesto
   * que a pessoa tenta primeiro numa fila de miniaturas, e a instrucao logo
   * acima diz que da para fazer os dois.
   *
   * `origem` e o cartao que saiu do lugar; `sobre` e onde ele vai cair. Guardar
   * os dois e o que permite marcar o alvo enquanto o dedo/cursor esta no ar —
   * sem isso o arrasto acontece as cegas.
   *
   * HTML5 puro, sem biblioteca: sao tres eventos e a lista tem no maximo cinco
   * itens. Uma dependencia de drag-and-drop aqui seria maior que o problema.
   */
  const [origem, setOrigem] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);

  const encerrarArrasto = () => {
    setOrigem(null);
    setSobre(null);
  };

  const soltarEm = (destino: number) => {
    if (origem !== null && origem !== destino) onMoveAt(origem, destino);
    encerrarArrasto();
  };

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

      {urls.length > 1 && (
        // A instrucao fica junto das miniaturas, e nao num canto: e ali que a
        // pessoa esta olhando quando quer trocar a ordem.
        <p className="text-center text-[0.6875rem] text-muted-foreground">
          Arraste as fotos para trocar a ordem, ou use as setas ‹ › de cada uma. A primeira é a capa.
        </p>
      )}

      {urls.length > 0 && (
        <div className="mx-auto flex w-full justify-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {urls.map((src, index) => {
            const isFirst = index === 0;
            const isLast = index === urls.length - 1;
            const arrastando = origem === index;
            const alvo = sobre === index && origem !== null && origem !== index;

            return (
              <div
                key={`${src}-${index}`}
                onDragOver={(event) => {
                  // Sem o `preventDefault` o navegador recusa a area como
                  // destino e o `onDrop` nunca dispara.
                  if (origem === null) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (sobre !== index) setSobre(index);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  soltarEm(index);
                }}
                onDragEnd={encerrarArrasto}
                className={cn(
                  "w-[9.5rem] shrink-0 overflow-hidden rounded-lg border bg-background shadow-sm transition-all sm:w-[10.5rem] lg:w-[11.5rem]",
                  alvo ? "border-primary ring-2 ring-primary/40" : "border-border/70",
                  arrastando && "opacity-40",
                )}
              >
                <div
                  // So a area da imagem arrasta. O campo de descricao logo
                  // abaixo fica de fora de proposito: cartao inteiro arrastavel
                  // impede selecionar texto dentro do input.
                  draggable={!uploading && urls.length > 1}
                  onDragStart={(event) => {
                    setOrigem(index);
                    event.dataTransfer.effectAllowed = "move";
                    // Firefox so inicia o arrasto se houver algum dado no evento.
                    event.dataTransfer.setData("text/plain", String(index));
                  }}
                  className={cn(
                    "group relative aspect-square bg-muted/20",
                    urls.length > 1 && !uploading && "cursor-grab active:cursor-grabbing",
                  )}
                >
                  <img
                    src={src}
                    alt=""
                    className={cn("h-full w-full p-1.5", imageFit === "cover" ? "object-cover p-0" : "object-contain")}
                    // A imagem tem arrasto nativo proprio (virar link/arquivo),
                    // que competiria com o nosso e mostraria o fantasma errado.
                    draggable={false}
                  />

                  <div className="absolute left-2 top-2 rounded-md bg-foreground/80 px-1.5 py-0.5 text-[0.625rem] font-semibold text-background shadow-sm">
                    {isFirst ? "Capa" : `Foto ${index + 1}`}
                  </div>

                  {urls.length > 1 ? (
                    <div className="absolute right-2 top-2 rounded-md bg-foreground/70 p-1 text-background opacity-0 transition-opacity group-hover:opacity-100">
                      <GripVertical className="h-3.5 w-3.5" />
                    </div>
                  ) : null}
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
                    // O rotulo diz a posicao de destino, e nao "esquerda": e a
                    // ordem no site que importa, e "virar capa" e a acao que a
                    // pessoa mais procura aqui.
                    title={index === 1 ? "Tornar esta a capa" : `Mover para a posição ${index}`}
                    aria-label={index === 1 ? "Tornar esta foto a capa" : `Mover a foto ${index + 1} para a posição ${index}`}
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
                    title={`Mover para a posição ${index + 2}`}
                    aria-label={`Mover a foto ${index + 1} para a posição ${index + 2}`}
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
